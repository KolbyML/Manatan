use std::sync::atomic::Ordering;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use tracing::{info, warn};

use crate::{jobs, logic, state::AppState};

#[derive(Deserialize)]
pub struct OcrRequest {
    pub url: String,
    pub user: Option<String>,
    pub pass: Option<String>,
    #[serde(default = "default_context")]
    pub context: String,
}

fn default_context() -> String {
    "No Context".to_string()
}

// --- Handlers ---

pub async fn status_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "running",
        "backend": "Rust (mangatan-ocr-server)",
        "requests_processed": state.requests_processed.load(Ordering::Relaxed),
        "active_jobs": state.active_jobs.load(Ordering::Relaxed),
    }))
}

pub async fn ocr_handler(
    State(state): State<AppState>,
    Query(params): Query<OcrRequest>,
) -> Result<Json<Vec<crate::logic::OcrResult>>, (StatusCode, String)> {
    let cache_key = logic::get_cache_key(&params.url);
    info!("OCR Handler: Incoming request for cache_key={}", cache_key);

    info!("OCR Handler: Attempting to check cache...");
    if let Some(cached) = mangatan_stats_server::get_ocr_cache(&state.stats_db, &cache_key) {
        info!("OCR Handler: Cache HIT for cache_key={}", cache_key);
        state.requests_processed.fetch_add(1, Ordering::Relaxed);
        // Convert CachedOcrResult back to OcrResult
        let results: Vec<crate::logic::OcrResult> = cached
            .data
            .into_iter()
            .map(|r| crate::logic::OcrResult {
                text: r.text,
                tight_bounding_box: crate::logic::BoundingBox {
                    x: r.tight_bounding_box.x,
                    y: r.tight_bounding_box.y,
                    width: r.tight_bounding_box.width,
                    height: r.tight_bounding_box.height,
                },
                is_merged: r.is_merged,
                forced_orientation: r.forced_orientation,
            })
            .collect();
        return Ok(Json(results));
    }
    info!(
        "OCR Handler: Cache MISS for cache_key={}. Starting processing.",
        cache_key
    );

    let result =
        logic::fetch_and_process(&params.url, params.user.clone(), params.pass.clone()).await;

    match result {
        Ok(data) => {
            state.requests_processed.fetch_add(1, Ordering::Relaxed);
            info!(
                "OCR Handler: Processing successful for cache_key={}",
                cache_key
            );

            // Convert OcrResult to OcrResultEntry for storage
            let entries: Vec<mangatan_stats_server::OcrResultEntry> = data
                .iter()
                .map(|r| mangatan_stats_server::OcrResultEntry {
                    text: r.text.clone(),
                    tight_bounding_box: mangatan_stats_server::BoundingBox {
                        x: r.tight_bounding_box.x,
                        y: r.tight_bounding_box.y,
                        width: r.tight_bounding_box.width,
                        height: r.tight_bounding_box.height,
                    },
                    is_merged: r.is_merged,
                    forced_orientation: r.forced_orientation.clone(),
                })
                .collect();

            info!("OCR Handler: Storing in SQLite cache...");
            let _ = mangatan_stats_server::set_ocr_cache(&state.stats_db, &cache_key, &params.context, &entries);
            info!("OCR Handler: Cache store complete.");

            Ok(Json(data))
        }
        Err(e) => {
            warn!(
                "OCR Handler: Processing FAILED for cache_key={}: {}",
                cache_key, e
            );
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

#[derive(Deserialize)]
pub struct JobRequest {
    pub base_url: String,
    pub user: Option<String>,
    pub pass: Option<String>,
    pub context: String,
    pub pages: Option<Vec<String>>,
}

pub async fn is_chapter_preprocessed_handler(
    State(state): State<AppState>,
    Json(req): Json<JobRequest>,
) -> Json<serde_json::Value> {
    let progress = {
        state
            .active_chapter_jobs
            .read()
            .expect("lock poisoned")
            .get(&req.base_url)
            .cloned()
    };

    if let Some(p) = progress {
        return Json(serde_json::json!({
            "status": "processing",
            "progress": p.current,
            "total": p.total
        }));
    }

    let chapter_base_path = logic::get_cache_key(&req.base_url);

    let total = mangatan_stats_server::get_chapter_pages(&state.stats_db, &chapter_base_path);

    let total = match total {
        Some(total) => total,
        None => {
            match logic::resolve_total_pages_from_graphql(&req.base_url, req.user, req.pass).await {
                Ok(total) => {
                    let _ = mangatan_stats_server::set_chapter_pages(&state.stats_db, &chapter_base_path, total);
                    total
                }
                Err(e) => {
                    warn!(
                        "is_chapter_preprocessed_handler: Failed GraphQL fallback: {}",
                        e
                    );
                    return Json(serde_json::json!({ "status": "idle" }));
                }
            }
        }
    };

    // Count cached pages for this chapter by checking each page
    // This is a simplified approach - we count pages 0 to total-1
    let mut cached_count = 0;
    for page_num in 0..total {
        let page_key = format!("{}/{}", chapter_base_path, page_num);
        if mangatan_stats_server::get_ocr_cache(&state.stats_db, &page_key).is_some() {
            cached_count += 1;
        }
    }

    if cached_count >= total {
        return Json(
            serde_json::json!({ "status": "processed", "cached_count": cached_count, "total_expected": total }),
        );
    }
    Json(
        serde_json::json!({ "status": "idle", "cached_count": cached_count, "total_expected": total }),
    )
}

pub async fn preprocess_handler(
    State(state): State<AppState>,
    Json(req): Json<JobRequest>,
) -> Json<serde_json::Value> {
    let pages = match req.pages {
        Some(p) => p,
        None => return Json(serde_json::json!({ "error": "No pages provided" })),
    };

    let is_processing = {
        state
            .active_chapter_jobs
            .read()
            .expect("lock poisoned")
            .contains_key(&req.base_url)
    };

    if is_processing {
        return Json(serde_json::json!({ "status": "already_processing" }));
    }

    let state_clone = state.clone();
    tokio::spawn(async move {
        jobs::run_chapter_job(
            state_clone,
            req.base_url,
            pages,
            req.user,
            req.pass,
            req.context,
        )
        .await;
    });

    Json(serde_json::json!({ "status": "started" }))
}

pub async fn purge_cache_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    // Purge OCR cache using direct SQL
    let conn = state.stats_db.pool.get().expect("Failed to get connection");
    let deleted = conn.execute("DELETE FROM ocr_cache", []).unwrap_or(0);
    Json(serde_json::json!({ "status": "cleared", "deleted": deleted }))
}

#[derive(serde::Serialize)]
pub struct ExportCacheEntry {
    pub context: String,
    pub data: Vec<mangatan_stats_server::OcrResultEntry>,
}

pub async fn export_cache_handler(
    State(state): State<AppState>,
) -> Json<std::collections::HashMap<String, ExportCacheEntry>> {
    let conn = state.stats_db.pool.get().expect("Failed to get connection");
    let mut stmt = conn.prepare("SELECT page_url, context, ocr_json FROM ocr_cache").expect("prepare failed");
    
    let mut result: std::collections::HashMap<String, ExportCacheEntry> = std::collections::HashMap::new();
    
    let rows = stmt.query_map([], |row| {
        let page_url: String = row.get(0)?;
        let context: String = row.get(1)?;
        let ocr_json: String = row.get(2)?;
        Ok((page_url, context, ocr_json))
    }).expect("query failed");
    
    for row in rows.flatten() {
        let (page_url, context, ocr_json) = row;
        if let Ok(data) = serde_json::from_str::<Vec<mangatan_stats_server::OcrResultEntry>>(&ocr_json) {
            result.insert(page_url, ExportCacheEntry { context, data });
        }
    }
    
    Json(result)
}

#[derive(serde::Deserialize)]
pub struct ImportCacheEntry {
    pub context: String,
    pub data: Vec<mangatan_stats_server::OcrResultEntry>,
}

pub async fn import_cache_handler(
    State(state): State<AppState>,
    Json(data): Json<std::collections::HashMap<String, ImportCacheEntry>>,
) -> Json<serde_json::Value> {
    let mut added = 0;

    for (page_url, entry) in data {
        // Check if already exists
        if mangatan_stats_server::get_ocr_cache(&state.stats_db, &page_url).is_none() {
            let _ = mangatan_stats_server::set_ocr_cache(&state.stats_db, &page_url, &entry.context, &entry.data);
            added += 1;
        }
    }

    Json(serde_json::json!({ "message": "Import successful", "added": added }))
}
