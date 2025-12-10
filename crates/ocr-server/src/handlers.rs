use std::{collections::hash_map::Entry, fs, sync::atomic::Ordering};

use axum::{
    Json,
    extract::{Multipart, Query, State},
    http::StatusCode,
};
use serde::Deserialize;

use crate::{
    jobs, logic,
    state::{AppState, CacheEntry},
};

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
    // FIX: Used expect instead of unwrap
    let cache_size = state.cache.read().expect("cache lock poisoned").len();
    Json(serde_json::json!({
        "status": "running",
        "backend": "Rust (mangatan-ocr-server)",
        "requests_processed": state.requests_processed.load(Ordering::Relaxed),
        "items_in_cache": cache_size,
        "active_jobs": state.active_jobs.load(Ordering::Relaxed),
    }))
}

pub async fn ocr_handler(
    State(state): State<AppState>,
    Query(params): Query<OcrRequest>,
) -> Result<Json<Vec<crate::logic::OcrResult>>, (StatusCode, String)> {
    // 1. Cache Check
    {
        // FIX: Used expect instead of unwrap
        let reader = state.cache.read().expect("cache lock poisoned");
        if let Some(entry) = reader.get(&params.url) {
            return Ok(Json(entry.data.clone()));
        }
    }

    tracing::info!("[OCR] Processing: {}", params.url);

    // 2. Process
    let results = logic::fetch_and_process(&params.url, params.user, params.pass)
        .await
        // FIX: Inlined format argument
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Error: {e}")))?;

    // 3. Update State
    state.requests_processed.fetch_add(1, Ordering::Relaxed);
    {
        // FIX: Used expect instead of unwrap
        let mut writer = state.cache.write().expect("cache lock poisoned");
        writer.insert(
            params.url,
            CacheEntry {
                context: params.context,
                data: results.clone(),
            },
        );
    }
    state.save_cache();

    Ok(Json(results))
}

pub async fn purge_cache_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    // FIX: Used expect instead of unwrap
    let mut writer = state.cache.write().expect("cache lock poisoned");
    let count = writer.len();
    writer.clear();
    drop(writer);
    state.save_cache();
    Json(serde_json::json!({ "status": "success", "removed": count }))
}

pub async fn export_cache_handler(State(state): State<AppState>) -> Result<Vec<u8>, StatusCode> {
    if state.cache_path.exists() {
        fs::read(&state.cache_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn import_cache_handler(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Json<serde_json::Value> {
    let mut added = 0;

    // FIX: Collapsed if statements
    while let Ok(Some(field)) = multipart.next_field().await {
        if let Ok(bytes) = field.bytes().await
            && let Ok(json) = serde_json::from_slice::<
                std::collections::HashMap<String, serde_json::Value>,
            >(&bytes)
        {
            // FIX: Used expect instead of unwrap
            let mut writer = state.cache.write().expect("cache lock poisoned");

            for (k, v) in json {
                // FIX: Used Entry API to avoid double lookup (contains_key + insert)
                if let Entry::Vacant(e) = writer.entry(k) {
                    // Handle simple array vs object format
                    if let Ok(data) =
                        serde_json::from_value::<Vec<crate::logic::OcrResult>>(v.clone())
                    {
                        e.insert(CacheEntry {
                            context: "Imported".into(),
                            data,
                        });
                        added += 1;
                    } else if let Ok(entry) = serde_json::from_value::<CacheEntry>(v) {
                        e.insert(entry);
                        added += 1;
                    }
                }
            }
        }
    }

    if added > 0 {
        state.save_cache();
    }
    Json(serde_json::json!({ "message": "Import successful", "added": added }))
}

#[derive(Deserialize)]
pub struct JobRequest {
    base_url: String,
    user: Option<String>,
    pass: Option<String>,
    context: String,
}

pub async fn preprocess_handler(
    State(state): State<AppState>,
    Json(req): Json<JobRequest>,
) -> Json<serde_json::Value> {
    tokio::spawn(jobs::run_chapter_job(
        state,
        req.base_url,
        req.user,
        req.pass,
        req.context,
    ));
    Json(serde_json::json!({ "status": "accepted", "message": "Job started" }))
}
