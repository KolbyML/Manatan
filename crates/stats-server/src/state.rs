use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;
use tracing::info;

pub type DbPool = Pool<SqliteConnectionManager>;

#[derive(Clone)]
pub struct StatsDb {
    pub pool: DbPool,
}

impl StatsDb {
    pub fn new(data_dir: PathBuf) -> Self {
        // 1. Ensure data_dir exists
        std::fs::create_dir_all(&data_dir).expect("Failed to create data directory");

        // 2. Create database path
        let db_path = data_dir.join("stats.db");
        info!("Opening stats database at {:?}", db_path);

        // 3. Create connection manager and pool
        let manager = SqliteConnectionManager::file(&db_path);
        let pool = Pool::builder()
            .max_size(10)
            .build(manager)
            .expect("Failed to create database pool");

        // 4. Initialize database schema
        let conn = pool.get().expect("Failed to get connection for schema init");

        // Set WAL mode for better concurrent access
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;",
        )
        .expect("Failed to set pragmas");

        // Create page_views table (raw events WITH session linking for text reconstruction)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS page_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                timestamp INTEGER NOT NULL,
                page_url TEXT NOT NULL,
                context TEXT,
                FOREIGN KEY (session_id) REFERENCES reading_sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp);
            CREATE INDEX IF NOT EXISTS idx_page_views_context ON page_views(context);
            CREATE INDEX IF NOT EXISTS idx_page_views_url ON page_views(page_url);
            CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);",
        )
        .expect("Failed to create page_views table");

        // Create ocr_cache table (NO SIZE LIMIT - grows unlimited, supports future pruning)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS ocr_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_url TEXT NOT NULL UNIQUE,
                context TEXT,
                ocr_json TEXT NOT NULL,
                text_concat TEXT NOT NULL,
                text_length INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_ocr_cache_url ON ocr_cache(page_url);
            CREATE INDEX IF NOT EXISTS idx_ocr_cache_context ON ocr_cache(context);
            CREATE INDEX IF NOT EXISTS idx_ocr_cache_created_at ON ocr_cache(created_at);",
        )
        .expect("Failed to create ocr_cache table");

        // Create chapters table (replaces chapter_pages_map HashMap)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS chapters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chapter_path TEXT NOT NULL UNIQUE,
                total_pages INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_chapters_path ON chapters(chapter_path);",
        )
        .expect("Failed to create chapters table");

        // Create reading_sessions table (pre-computed with AFK adjustment)
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS reading_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                context TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                last_page_at INTEGER NOT NULL,
                reading_time_seconds INTEGER NOT NULL DEFAULT 0,
                pages_viewed INTEGER NOT NULL DEFAULT 1,
                total_characters INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_context ON reading_sessions(context);
            CREATE INDEX IF NOT EXISTS idx_sessions_active ON reading_sessions(is_active);
            CREATE INDEX IF NOT EXISTS idx_sessions_started ON reading_sessions(started_at);
            CREATE INDEX IF NOT EXISTS idx_sessions_ended ON reading_sessions(ended_at);",
        )
        .expect("Failed to create reading_sessions table");

        info!("Stats database initialized with 4 tables");

        Self { pool }
    }
}
