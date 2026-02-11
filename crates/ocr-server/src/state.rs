use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{atomic::AtomicUsize, Arc, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::logic::OcrResult;

#[derive(Clone, Copy, Serialize, Debug)]
pub struct JobProgress {
    pub current: usize,
    pub total: usize,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
    pub cache_dir: PathBuf,
    pub active_jobs: Arc<AtomicUsize>,
    pub requests_processed: Arc<AtomicUsize>,
    pub active_chapter_jobs: Arc<RwLock<HashMap<String, JobProgress>>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CacheEntry {
    pub context: String,
    pub data: Vec<OcrResult>,
}

pub type DbPool = Pool<SqliteConnectionManager>;

// Struct for the legacy persistent state (cache and metadata)
#[derive(Serialize, Deserialize, Default)]
struct PersistentState {
    cache: HashMap<String, CacheEntry>,
    chapter_pages_map: HashMap<String, usize>,
}

impl AppState {
    pub fn new(cache_dir: PathBuf) -> Self {
        if !cache_dir.exists() {
            let _ = std::fs::create_dir_all(&cache_dir);
        }

        let db_path = cache_dir.join("ocr-cache.db");
        let manager = SqliteConnectionManager::file(&db_path);
        let pool = Pool::new(manager).expect("Failed to create OCR DB pool");
        let mut conn = pool.get().expect("Failed to get OCR DB connection");

        conn.execute_batch(
            "PRAGMA journal_mode = DELETE;
             PRAGMA synchronous = NORMAL;

             CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT
             );

             CREATE TABLE IF NOT EXISTS ocr_cache (
                cache_key TEXT PRIMARY KEY,
                context TEXT NOT NULL,
                data BLOB NOT NULL,
                created_at INTEGER NOT NULL,
                last_processed_at INTEGER NOT NULL,
                last_accessed_at INTEGER NOT NULL,
                access_count INTEGER NOT NULL
             );

             CREATE INDEX IF NOT EXISTS idx_ocr_cache_accessed
                ON ocr_cache(last_accessed_at);

             CREATE TABLE IF NOT EXISTS chapter_cache (
                chapter_key TEXT NOT NULL,
                cache_key TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (chapter_key, cache_key)
             );

             CREATE INDEX IF NOT EXISTS idx_chapter_cache_chapter
                ON chapter_cache(chapter_key);

             CREATE TABLE IF NOT EXISTS chapter_pages (
                chapter_key TEXT PRIMARY KEY,
                page_count INTEGER NOT NULL,
                processed_count INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                last_accessed_at INTEGER NOT NULL
             );

             CREATE INDEX IF NOT EXISTS idx_chapter_pages_accessed
                ON chapter_pages(last_accessed_at);",
        )
        .expect("Failed to initialize OCR cache database");

        let _ = conn.execute(
            "ALTER TABLE chapter_pages ADD COLUMN processed_count INTEGER NOT NULL DEFAULT 0",
            [],
        );

        migrate_legacy_cache(&mut conn, &cache_dir);

        Self {
            pool,
            cache_dir,
            active_jobs: Arc::new(AtomicUsize::new(0)),
            requests_processed: Arc::new(AtomicUsize::new(0)),
            active_chapter_jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl AppState {
    pub fn cache_len(&self) -> usize {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for cache_len");
            return 0;
        };
        conn.query_row("SELECT COUNT(*) FROM ocr_cache", [], |row| {
            row.get::<_, i64>(0)
        })
        .map(|count| count as usize)
        .unwrap_or(0)
    }

    pub fn has_cache_entry(&self, cache_key: &str) -> bool {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for has_cache_entry");
            return false;
        };
        conn.query_row(
            "SELECT 1 FROM ocr_cache WHERE cache_key = ? LIMIT 1",
            params![cache_key],
            |_| Ok(()),
        )
        .optional()
        .map(|v| v.is_some())
        .unwrap_or(false)
    }

    pub fn has_cache_entry_prefix(&self, prefix: &str) -> bool {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for has_cache_entry_prefix");
            return false;
        };
        let like_pattern = format!("{}%", prefix);
        conn.query_row(
            "SELECT 1 FROM ocr_cache WHERE cache_key LIKE ? LIMIT 1",
            params![like_pattern],
            |_| Ok(()),
        )
        .optional()
        .map(|v| v.is_some())
        .unwrap_or(false)
    }

    pub fn insert_chapter_cache(&self, chapter_key: &str, cache_key: &str) {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for insert_chapter_cache");
            return;
        };
        let now = now_unix();
        let _ = conn.execute(
            "INSERT OR IGNORE INTO chapter_cache (chapter_key, cache_key, created_at) VALUES (?, ?, ?)",
            params![chapter_key, cache_key, now],
        );
    }

    pub fn count_chapter_cache(&self, chapter_key: &str) -> usize {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for count_chapter_cache");
            return 0;
        };
        conn.query_row(
            "SELECT COUNT(*) FROM chapter_cache WHERE chapter_key = ?",
            params![chapter_key],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count as usize)
        .unwrap_or(0)
    }

    pub fn get_cache_entry(&self, cache_key: &str) -> Option<CacheEntry> {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for get_cache_entry");
            return None;
        };

        let entry = conn
            .query_row(
                "SELECT context, data FROM ocr_cache WHERE cache_key = ?",
                params![cache_key],
                |row| {
                    let context: String = row.get(0)?;
                    let data_blob: Vec<u8> = row.get(1)?;
                    let data = serde_json::from_slice(&data_blob).unwrap_or_default();
                    Ok(CacheEntry { context, data })
                },
            )
            .optional()
            .unwrap_or(None);

        if entry.is_some() {
            let now = now_unix();
            let _ = conn.execute(
                "UPDATE ocr_cache
                 SET last_accessed_at = ?, access_count = access_count + 1
                 WHERE cache_key = ?",
                params![now, cache_key],
            );
        }

        entry
    }

    pub fn get_cache_entry_sourceid_variant(
        &self,
        cache_key: &str,
    ) -> Option<(String, CacheEntry)> {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for get_cache_entry_sourceid_variant");
            return None;
        };

        let like_q = format!("{}?sourceId=%", cache_key);
        let like_amp = format!("{}&sourceId=%", cache_key);

        let row = conn
            .query_row(
                "SELECT cache_key, context, data FROM ocr_cache WHERE cache_key LIKE ? OR cache_key LIKE ? LIMIT 1",
                params![like_q, like_amp],
                |row| {
                    let key: String = row.get(0)?;
                    let context: String = row.get(1)?;
                    let data_blob: Vec<u8> = row.get(2)?;
                    let data = serde_json::from_slice(&data_blob).unwrap_or_default();
                    Ok((key, CacheEntry { context, data }))
                },
            )
            .optional()
            .unwrap_or(None);

        if let Some((ref key, _)) = row {
            let now = now_unix();
            let _ = conn.execute(
                "UPDATE ocr_cache
                 SET last_accessed_at = ?, access_count = access_count + 1
                 WHERE cache_key = ?",
                params![now, key],
            );
        }

        row
    }

    pub fn insert_cache_entry(&self, cache_key: &str, entry: &CacheEntry) {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for insert_cache_entry");
            return;
        };
        let now = now_unix();
        let data_blob = serde_json::to_vec(&entry.data).unwrap_or_default();
        let _ = conn.execute(
            "INSERT INTO ocr_cache
                (cache_key, context, data, created_at, last_processed_at, last_accessed_at, access_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(cache_key) DO UPDATE SET
                context = excluded.context,
                data = excluded.data,
                last_processed_at = excluded.last_processed_at,
                last_accessed_at = excluded.last_accessed_at,
                access_count = ocr_cache.access_count + 1",
            params![
                cache_key,
                entry.context.as_str(),
                data_blob,
                now,
                now,
                now,
                1i64
            ],
        );
    }

    pub fn clear_cache(&self) {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for clear_cache");
            return;
        };
        let _ = conn.execute("DELETE FROM ocr_cache", []);
        let _ = conn.execute("DELETE FROM chapter_cache", []);
        let _ = conn.execute("DELETE FROM chapter_pages", []);
    }

    pub fn delete_chapter_ocr(
        &self,
        chapter_key: &str,
        delete_data: bool,
    ) -> (usize, usize, usize) {
        let Ok(mut conn) = self.pool.get() else {
            warn!("Failed to get DB connection for delete_chapter_ocr");
            return (0, 0, 0);
        };

        let tx = match conn.transaction() {
            Ok(tx) => tx,
            Err(err) => {
                warn!("Failed to start delete transaction: {err}");
                return (0, 0, 0);
            }
        };

        let mut cache_keys = Vec::<String>::new();
        if delete_data {
            let mut stmt =
                match tx.prepare("SELECT cache_key FROM chapter_cache WHERE chapter_key = ?") {
                    Ok(stmt) => stmt,
                    Err(err) => {
                        warn!("Failed to prepare chapter_cache select: {err}");
                        return (0, 0, 0);
                    }
                };

            if let Ok(rows) = stmt.query_map(params![chapter_key], |row| row.get::<_, String>(0)) {
                for row in rows.flatten() {
                    cache_keys.push(row);
                }
            }
        }

        let chapter_cache_rows = tx
            .execute(
                "DELETE FROM chapter_cache WHERE chapter_key = ?",
                params![chapter_key],
            )
            .unwrap_or(0) as usize;

        let chapter_pages_rows = tx
            .execute(
                "DELETE FROM chapter_pages WHERE chapter_key = ?",
                params![chapter_key],
            )
            .unwrap_or(0) as usize;

        let mut ocr_cache_rows = 0usize;
        if delete_data {
            for cache_key in cache_keys {
                // Delete exact cache_key plus common variants that include sourceId query params.
                // This mirrors the prefix matching used in chapter_status().
                let like_q = format!("{}?sourceId=%", cache_key);
                let like_amp = format!("{}&sourceId=%", cache_key);

                let deleted = tx
                    .execute(
                        "DELETE FROM ocr_cache WHERE cache_key = ? OR cache_key LIKE ? OR cache_key LIKE ?",
                        params![cache_key, like_q, like_amp],
                    )
                    .unwrap_or(0);
                ocr_cache_rows += deleted as usize;
            }
        }

        if let Err(err) = tx.commit() {
            warn!("Failed to commit delete transaction: {err}");
            return (0, 0, 0);
        }

        (chapter_cache_rows, chapter_pages_rows, ocr_cache_rows)
    }

    pub fn export_cache(&self) -> HashMap<String, CacheEntry> {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for export_cache");
            return HashMap::new();
        };
        let mut out = HashMap::new();
        let mut stmt = match conn.prepare("SELECT cache_key, context, data FROM ocr_cache") {
            Ok(stmt) => stmt,
            Err(err) => {
                warn!("Failed to prepare export_cache: {err}");
                return out;
            }
        };

        if let Ok(rows) = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let context: String = row.get(1)?;
            let data_blob: Vec<u8> = row.get(2)?;
            let data = serde_json::from_slice(&data_blob).unwrap_or_default();
            Ok((key, CacheEntry { context, data }))
        }) {
            for row in rows.flatten() {
                out.insert(row.0, row.1);
            }
        }

        out
    }

    pub fn import_cache(&self, data: HashMap<String, CacheEntry>) -> usize {
        let Ok(mut conn) = self.pool.get() else {
            warn!("Failed to get DB connection for import_cache");
            return 0;
        };

        let now = now_unix();
        let tx = match conn.transaction() {
            Ok(tx) => tx,
            Err(err) => {
                warn!("Failed to start import transaction: {err}");
                return 0;
            }
        };
        let mut added = 0;
        for (key, entry) in data {
            let data_blob = serde_json::to_vec(&entry.data).unwrap_or_default();
            if let Ok(changes) = tx.execute(
                "INSERT OR IGNORE INTO ocr_cache
                    (cache_key, context, data, created_at, last_processed_at, last_accessed_at, access_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![key, entry.context, data_blob, now, now, now, 1i64],
            ) {
                if changes > 0 {
                    added += 1;
                }
            }
        }
        let _ = tx.commit();
        added
    }

    pub fn get_chapter_pages(&self, chapter_key: &str) -> Option<usize> {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for get_chapter_pages");
            return None;
        };
        let count = conn
            .query_row(
                "SELECT page_count FROM chapter_pages WHERE chapter_key = ?",
                params![chapter_key],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .unwrap_or(None);

        if count.is_some() {
            let now = now_unix();
            let _ = conn.execute(
                "UPDATE chapter_pages SET last_accessed_at = ? WHERE chapter_key = ?",
                params![now, chapter_key],
            );
        }

        count.map(|val| val as usize)
    }

    pub fn get_chapter_progress(&self, chapter_key: &str) -> Option<(usize, usize)> {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for get_chapter_progress");
            return None;
        };
        let progress = conn
            .query_row(
                "SELECT page_count, processed_count FROM chapter_pages WHERE chapter_key = ?",
                params![chapter_key],
                |row| {
                    let page_count: i64 = row.get(0)?;
                    let processed_count: i64 = row.get(1)?;
                    Ok((page_count, processed_count))
                },
            )
            .optional()
            .unwrap_or(None);

        if progress.is_some() {
            let now = now_unix();
            let _ = conn.execute(
                "UPDATE chapter_pages SET last_accessed_at = ? WHERE chapter_key = ?",
                params![now, chapter_key],
            );
        }

        progress
            .map(|(page_count, processed_count)| (page_count as usize, processed_count as usize))
    }

    pub fn set_chapter_pages(&self, chapter_key: &str, page_count: usize) {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for set_chapter_pages");
            return;
        };
        let now = now_unix();
        let _ = conn.execute(
            "INSERT INTO chapter_pages (chapter_key, page_count, processed_count, created_at, last_accessed_at)
             VALUES (?, ?, 0, ?, ?)
             ON CONFLICT(chapter_key) DO UPDATE SET
                page_count = excluded.page_count,
                last_accessed_at = excluded.last_accessed_at",
            params![chapter_key, page_count as i64, now, now],
        );
    }

    pub fn set_chapter_progress(
        &self,
        chapter_key: &str,
        page_count: usize,
        processed_count: usize,
    ) {
        let Ok(conn) = self.pool.get() else {
            warn!("Failed to get DB connection for set_chapter_progress");
            return;
        };
        let now = now_unix();
        let _ = conn.execute(
            "INSERT INTO chapter_pages (chapter_key, page_count, processed_count, created_at, last_accessed_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(chapter_key) DO UPDATE SET
                page_count = excluded.page_count,
                processed_count = excluded.processed_count,
                last_accessed_at = excluded.last_accessed_at",
            params![chapter_key, page_count as i64, processed_count as i64, now, now],
        );
    }
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn migrate_legacy_cache(conn: &mut rusqlite::Connection, cache_dir: &Path) {
    let migrated: Option<String> = conn
        .query_row(
            "SELECT value FROM metadata WHERE key = 'legacy_json_migrated'",
            [],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None);

    if migrated.as_deref() == Some("1") {
        return;
    }

    let cache_path = cache_dir.join("ocr-cache.json");
    if !cache_path.exists() {
        return;
    }

    let file = match std::fs::File::open(&cache_path) {
        Ok(file) => file,
        Err(err) => {
            warn!("Failed to open legacy cache file: {err}");
            return;
        }
    };

    let persistent_state: PersistentState = match serde_json::from_reader(file) {
        Ok(state) => state,
        Err(err) => {
            warn!("Failed to deserialize legacy cache file: {err}");
            return;
        }
    };

    let now = now_unix();
    let tx = match conn.transaction() {
        Ok(tx) => tx,
        Err(err) => {
            warn!("Failed to start migration transaction: {err}");
            return;
        }
    };

    let mut imported = 0;
    for (key, entry) in persistent_state.cache {
        let data_blob = serde_json::to_vec(&entry.data).unwrap_or_default();
        if let Ok(changes) = tx.execute(
            "INSERT OR IGNORE INTO ocr_cache
                (cache_key, context, data, created_at, last_processed_at, last_accessed_at, access_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![key, entry.context, data_blob, now, now, now, 1i64],
        ) {
            if changes > 0 {
                imported += 1;
            }
        }
    }

    for (key, count) in persistent_state.chapter_pages_map {
        let _ = tx.execute(
            "INSERT OR IGNORE INTO chapter_pages
                (chapter_key, page_count, created_at, last_accessed_at)
             VALUES (?, ?, ?, ?)",
            params![key, count as i64, now, now],
        );
    }

    let _ = tx.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ('legacy_json_migrated', '1')",
        [],
    );

    if tx.commit().is_ok() {
        let _ = std::fs::remove_file(&cache_path);
        info!("Migrated {} legacy OCR cache entries into SQLite", imported);
    }
}
