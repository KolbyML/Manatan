use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        Arc, RwLock,
        atomic::{AtomicBool, Ordering},
    },
};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::{Deserialize, Serialize};
use tracing::info;
use wordbase_api::{DictionaryId, Record, dict::yomitan::GlossaryTag};

pub type DbPool = Pool<SqliteConnectionManager>;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DictionaryData {
    pub id: DictionaryId,
    pub name: String,
    pub priority: i64,
    pub enabled: bool,
}

#[derive(Clone)]
pub struct AppState {
    pub dictionaries: Arc<RwLock<HashMap<DictionaryId, DictionaryData>>>,
    pub next_dict_id: Arc<RwLock<i64>>,
    pub pool: DbPool,
    pub data_dir: PathBuf,
    pub loading: Arc<AtomicBool>,
}

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
                enabled BOOLEAN DEFAULT 1
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

        // 2. Load Dictionaries from DB
        let mut dicts = HashMap::new();
        let mut max_id = 0;

        {
            let mut stmt = conn
                .prepare("SELECT id, name, priority, enabled FROM dictionaries")
                .unwrap();
            let rows = stmt
                .query_map([], |row| {
                    Ok(DictionaryData {
                        id: DictionaryId(row.get(0)?),
                        name: row.get(1)?,
                        priority: row.get(2)?,
                        enabled: row.get(3)?,
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
        }
    }

    pub fn set_loading(&self, val: bool) {
        self.loading.store(val, Ordering::SeqCst);
    }

    pub fn is_loading(&self) -> bool {
        self.loading.load(Ordering::Relaxed)
    }
}
