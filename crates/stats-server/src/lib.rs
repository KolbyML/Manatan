pub mod handlers;
pub mod sessions;
pub mod state;

use axum::{routing::{get, post}, Router};
use rusqlite::params;
use serde::{Deserialize, Serialize};

pub use state::StatsDb;

/// Represents a cached OCR result from the database
/// This matches the structure stored in ocr_cache table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedOcrResult {
    pub context: String,
    pub data: Vec<OcrResultEntry>,
}

/// Individual OCR text block with bounding box
/// Matches the OcrResult structure from ocr-server/src/logic.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResultEntry {
    pub text: String,
    #[serde(rename = "tightBoundingBox")]
    pub tight_bounding_box: BoundingBox,
    #[serde(rename = "isMerged", skip_serializing_if = "Option::is_none")]
    pub is_merged: Option<bool>,
    #[serde(rename = "forcedOrientation", skip_serializing_if = "Option::is_none")]
    pub forced_orientation: Option<String>,
}

/// Bounding box coordinates (normalized 0.0-1.0)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Create the stats-server router with all endpoints
pub fn create_router(stats_db: StatsDb) -> Router {
    Router::new()
        .route("/page-view", post(handlers::page_view_handler))
        .route("/chapters", get(handlers::export_chapter_stats_handler))
        .route("/series", get(handlers::export_series_stats_handler))
        .route("/raw", get(handlers::export_raw_page_views_handler))
        .with_state(stats_db)
}

/// Get cached OCR result from SQLite database
/// Returns None if not found or on error
pub fn get_ocr_cache(stats_db: &StatsDb, page_url: &str) -> Option<CachedOcrResult> {
    let conn = stats_db.pool.get().ok()?;
    
    let result = conn.query_row(
        "SELECT context, ocr_json FROM ocr_cache WHERE page_url = ?1",
        params![page_url],
        |row| {
            let context: String = row.get(0)?;
            let ocr_json: String = row.get(1)?;
            Ok((context, ocr_json))
        },
    );
    
    match result {
        Ok((context, ocr_json)) => {
            // Parse the JSON array of OCR results
            let data: Vec<OcrResultEntry> = serde_json::from_str(&ocr_json).ok()?;
            Some(CachedOcrResult { context, data })
        }
        Err(_) => None,
    }
}

/// Store OCR result in SQLite database
/// Concatenates all text blocks and calculates total length for stats
pub fn set_ocr_cache(
    stats_db: &StatsDb,
    page_url: &str,
    context: &str,
    ocr_results: &[OcrResultEntry],
) -> Result<(), rusqlite::Error> {
    let conn = stats_db.pool.get().expect("Failed to get connection");
    
    // Serialize OCR results to JSON
    let ocr_json = serde_json::to_string(ocr_results)
        .unwrap_or_else(|_| "[]".to_string());
    
    // Concatenate all text blocks for stats/search
    let text_concat: String = ocr_results
        .iter()
        .map(|r| r.text.as_str())
        .collect::<Vec<_>>()
        .join("");
    
    let text_length = text_concat.chars().count() as i64;
    let created_at = sessions::unix_now();  // Unix epoch seconds
    
    conn.execute(
        "INSERT OR REPLACE INTO ocr_cache (page_url, context, ocr_json, text_concat, text_length, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![page_url, context, ocr_json, text_concat, text_length, created_at],
    )?;
    
    Ok(())
}

/// Get chapter page count from SQLite
pub fn get_chapter_pages(stats_db: &StatsDb, chapter_path: &str) -> Option<usize> {
    let conn = stats_db.pool.get().ok()?;
    conn.query_row(
        "SELECT total_pages FROM chapters WHERE chapter_path = ?1",
        params![chapter_path],
        |row| row.get::<_, i64>(0),
    )
    .ok()
    .map(|v| v as usize)
}

/// Store chapter page count in SQLite
pub fn set_chapter_pages(
    stats_db: &StatsDb,
    chapter_path: &str,
    total_pages: usize,
) -> Result<(), rusqlite::Error> {
    let conn = stats_db.pool.get().expect("Failed to get connection");
    let now = sessions::unix_now();  // Unix epoch seconds
    conn.execute(
        "INSERT OR REPLACE INTO chapters (chapter_path, total_pages, created_at) VALUES (?1, ?2, ?3)",
        params![chapter_path, total_pages as i64, now],
    )?;
    Ok(())
}
