use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::sessions;
use crate::state::StatsDb;

// === Page View Handler ===

#[derive(Deserialize)]
pub struct PageViewRequest {
    pub page_url: String,
    pub context: String,
}

pub async fn page_view_handler(
    State(stats_db): State<StatsDb>,
    Json(payload): Json<PageViewRequest>,
) -> StatusCode {
    let timestamp = sessions::unix_now();
    let conn = match stats_db.pool.get() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to get DB connection: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    };
    
    match sessions::process_page_view(&conn, &payload.page_url, &payload.context, timestamp) {
        Ok(session_id) => {
            tracing::debug!(
                "Page view recorded: url={}, context={}, session_id={}",
                payload.page_url, payload.context, session_id
            );
            StatusCode::OK
        }
        Err(e) => {
            tracing::error!("Failed to record page view: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

// === Stats Export Handlers ===

#[derive(Serialize)]
pub struct ChapterStats {
    pub context: String,
    pub total_reading_seconds: i64,
    pub total_pages: i64,
    pub total_characters: i64,
    pub first_read: i64,
    pub last_read: i64,
}

pub async fn export_chapter_stats_handler(
    State(stats_db): State<StatsDb>,
) -> Json<Vec<ChapterStats>> {
    let conn = match stats_db.pool.get() {
        Ok(c) => c,
        Err(_) => return Json(vec![]),
    };
    
    let mut stmt = match conn.prepare(
        "SELECT 
            context,
            SUM(reading_time_seconds) AS total_reading_seconds,
            SUM(pages_viewed) AS total_pages,
            SUM(total_characters) AS total_characters,
            MIN(started_at) AS first_read,
            MAX(last_page_at) AS last_read
         FROM reading_sessions
         GROUP BY context
         ORDER BY first_read DESC"
    ) {
        Ok(s) => s,
        Err(_) => return Json(vec![]),
    };
    
    let results = stmt.query_map([], |row| {
        Ok(ChapterStats {
            context: row.get(0)?,
            total_reading_seconds: row.get(1)?,
            total_pages: row.get(2)?,
            total_characters: row.get(3)?,
            first_read: row.get(4)?,
            last_read: row.get(5)?,
        })
    });
    
    match results {
        Ok(rows) => Json(rows.filter_map(|r| r.ok()).collect()),
        Err(_) => Json(vec![]),
    }
}

#[derive(Serialize)]
pub struct SeriesStats {
    pub series: String,
    pub chapters_read: i64,
    pub total_reading_seconds: i64,
    pub total_characters: i64,
    pub avg_seconds_per_chapter: f64,
}

pub async fn export_series_stats_handler(
    State(stats_db): State<StatsDb>,
) -> Json<Vec<SeriesStats>> {
    let conn = match stats_db.pool.get() {
        Ok(c) => c,
        Err(_) => return Json(vec![]),
    };
    
    // Extract series from context (format: "Series Name / Chapter N")
    // Use SUBSTR to get everything before " / "
    let mut stmt = match conn.prepare(
        "SELECT 
            CASE 
                WHEN INSTR(context, ' / ') > 0 
                THEN SUBSTR(context, 1, INSTR(context, ' / ') - 1)
                ELSE context
            END AS series,
            COUNT(DISTINCT context) AS chapters_read,
            SUM(reading_time_seconds) AS total_reading_seconds,
            SUM(total_characters) AS total_characters,
            AVG(reading_time_seconds) AS avg_seconds_per_chapter
         FROM reading_sessions
         GROUP BY series
         ORDER BY total_reading_seconds DESC"
    ) {
        Ok(s) => s,
        Err(_) => return Json(vec![]),
    };
    
    let results = stmt.query_map([], |row| {
        Ok(SeriesStats {
            series: row.get(0)?,
            chapters_read: row.get(1)?,
            total_reading_seconds: row.get(2)?,
            total_characters: row.get(3)?,
            avg_seconds_per_chapter: row.get(4)?,
        })
    });
    
    match results {
        Ok(rows) => Json(rows.filter_map(|r| r.ok()).collect()),
        Err(_) => Json(vec![]),
    }
}

#[derive(Serialize)]
pub struct PageViewRecord {
    pub id: i64,
    pub session_id: Option<i64>,
    pub timestamp: i64,
    pub page_url: String,
    pub context: Option<String>,
}

pub async fn export_raw_page_views_handler(
    State(stats_db): State<StatsDb>,
) -> Json<Vec<PageViewRecord>> {
    let conn = match stats_db.pool.get() {
        Ok(c) => c,
        Err(_) => return Json(vec![]),
    };
    
    let mut stmt = match conn.prepare(
        "SELECT id, session_id, timestamp, page_url, context
         FROM page_views
         ORDER BY timestamp DESC
         LIMIT 1000"  // Limit to prevent huge responses
    ) {
        Ok(s) => s,
        Err(_) => return Json(vec![]),
    };
    
    let results = stmt.query_map([], |row| {
        Ok(PageViewRecord {
            id: row.get(0)?,
            session_id: row.get(1)?,
            timestamp: row.get(2)?,
            page_url: row.get(3)?,
            context: row.get(4)?,
        })
    });
    
    match results {
        Ok(rows) => Json(rows.filter_map(|r| r.ok()).collect()),
        Err(_) => Json(vec![]),
    }
}
