use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, RwLock,
    },
    time::{Duration, Instant},
};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::{Deserialize, Serialize};
use tracing::info;
use wordbase_api::{dict::yomitan::GlossaryTag, DictionaryId, Record};

pub type DbPool = Pool<SqliteConnectionManager>;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DictionaryData {
    pub id: DictionaryId,
    pub name: String,
    pub priority: i64,
    pub enabled: bool,
    pub styles: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub dictionaries: Arc<RwLock<HashMap<DictionaryId, DictionaryData>>>,
    pub next_dict_id: Arc<RwLock<i64>>,
    pub pool: DbPool,
    pub data_dir: PathBuf,
    pub loading: Arc<AtomicBool>,
    startup_instant: Instant,
}

#[cfg(test)]
const IMPORT_STARTUP_GUARD: Duration = Duration::from_millis(50);
#[cfg(not(test))]
const IMPORT_STARTUP_GUARD: Duration = Duration::from_secs(30);

#[derive(Clone, Serialize, Deserialize)]
pub struct StoredRecord {
    pub dictionary_id: DictionaryId,
    pub record: Record,
    pub term_tags: Option<Vec<GlossaryTag>>,
    pub reading: Option<String>,
    #[serde(default)]
    pub headword: Option<String>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        if !data_dir.exists() {
            let _ = std::fs::create_dir_all(&data_dir);
        }
        let db_path = data_dir.join("yomitan.db");
        let manager = SqliteConnectionManager::file(&db_path);

        let pool = Pool::new(manager).expect("Failed to create DB pool");

        let conn = pool.get().expect("Failed to get DB connection");

        // 1. Initialize Tables
        // CHANGED: Disabled WAL, changed json to BLOB
        conn.execute_batch(
            "PRAGMA journal_mode = DELETE;
             PRAGMA synchronous = NORMAL;
             
             CREATE TABLE IF NOT EXISTS dictionaries (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                enabled BOOLEAN DEFAULT 1,
                styles TEXT
             );

             CREATE TABLE IF NOT EXISTS terms (
                term TEXT NOT NULL,
                dictionary_id INTEGER NOT NULL,
                json BLOB NOT NULL
             );
             
             CREATE INDEX IF NOT EXISTS idx_term ON terms(term);
             CREATE INDEX IF NOT EXISTS idx_dict_term ON terms(dictionary_id);
             
             CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT
             );",
        )
        .expect("Failed to initialize database tables");

        // Migration: Add styles column if it doesn't exist (ignore errors for existing columns)
        let _ = conn.execute("ALTER TABLE dictionaries ADD COLUMN styles TEXT", []);

        // Create kanji tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS kanji (
                character TEXT NOT NULL,
                dictionary_id INTEGER NOT NULL,
                onyomi TEXT,
                kunyomi TEXT,
                tags TEXT,
                meanings TEXT,
                stats TEXT,
                PRIMARY KEY (character, dictionary_id)
            );

            CREATE TABLE IF NOT EXISTS kanji_meta (
                character TEXT NOT NULL,
                dictionary_id INTEGER NOT NULL,
                meta_type TEXT NOT NULL,
                data TEXT,
                PRIMARY KEY (character, dictionary_id, meta_type)
            );

            CREATE INDEX IF NOT EXISTS idx_kanji_character ON kanji(character);
            CREATE INDEX IF NOT EXISTS idx_kanji_meta_character ON kanji_meta(character);",
        )
        .ok();

        // 2. Load Dictionaries from DB
        let mut dicts = HashMap::new();
        let mut max_id = 0;

        {
            let mut stmt = conn
                .prepare("SELECT id, name, priority, enabled, styles FROM dictionaries")
                .unwrap();
            let rows = stmt
                .query_map([], |row| {
                    Ok(DictionaryData {
                        id: DictionaryId(row.get(0)?),
                        name: row.get(1)?,
                        priority: row.get(2)?,
                        enabled: row.get(3)?,
                        styles: row.get(4)?,
                    })
                })
                .unwrap();

            for row in rows {
                if let Ok(d) = row {
                    if d.id.0 > max_id {
                        max_id = d.id.0;
                    }
                    dicts.insert(d.id, d);
                }
            }
        }

        info!(
            "📂 [Yomitan] Database initialized. Loaded {} dictionaries.",
            dicts.len()
        );

        Self {
            dictionaries: Arc::new(RwLock::new(dicts)),
            next_dict_id: Arc::new(RwLock::new(max_id + 1)),
            pool,
            data_dir,
            loading: Arc::new(AtomicBool::new(false)),
            startup_instant: Instant::now(),
        }
    }

    pub fn set_loading(&self, val: bool) {
        self.loading.store(val, Ordering::SeqCst);
    }

    pub fn is_loading(&self) -> bool {
        self.loading.load(Ordering::Relaxed)
    }

    pub fn is_import_startup_guard_active(&self) -> bool {
        self.startup_instant.elapsed() < IMPORT_STARTUP_GUARD
    }

    pub fn import_startup_guard_remaining_secs(&self) -> u64 {
        IMPORT_STARTUP_GUARD
            .saturating_sub(self.startup_instant.elapsed())
            .as_secs()
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    use super::AppState;

    fn test_data_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "manatan-yomitan-state-test-{}-{}-{}",
            name,
            std::process::id(),
            nanos
        ))
    }

    #[test]
    fn startup_guard_is_active_immediately() {
        let dir = test_data_dir("startup-active");
        let state = AppState::new(dir.clone());

        assert!(state.is_import_startup_guard_active());

        drop(state);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn startup_guard_expires_after_duration() {
        let dir = test_data_dir("startup-expire");
        let state = AppState::new(dir.clone());

        std::thread::sleep(Duration::from_millis(80));
        assert!(!state.is_import_startup_guard_active());

        drop(state);
        let _ = fs::remove_dir_all(dir);
    }
}
