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
    let cache_key = logic::get_cache_key(&params.url);

    if let Some(entry) = state.cache.read().expect("lock").get(&cache_key) {
        state.requests_processed.fetch_add(1, Ordering::Relaxed);
        return Ok(Json(entry.data.clone()));
    }

    // 2. Process
    match logic::fetch_and_process(&params.url, params.user, params.pass).await {
        Ok(data) => {
            state.requests_processed.fetch_add(1, Ordering::Relaxed);

            {
                let mut w = state.cache.write().expect("lock");
                w.insert(
                    cache_key,
                    CacheEntry {
                        context: params.context,
                        data: data.clone(),
                    },
                );
            }

            state.save_cache();
            Ok(Json(data))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct JobRequest {
    base_url: String,
    user: Option<String>,
    pass: Option<String>,
    context: String,
    pages: Option<Vec<String>>,
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
            .cloned() // Copy the JobProgress struct (current, total)
    };

    if let Some(p) = progress {
        return Json(serde_json::json!({
            "status": "processing",
            "progress": p.current, // <-- Pass these to frontend
            "total": p.total       // <-- Pass these to frontend
        }));
    }

    let first_page_url = format!("{}0", req.base_url);
    let cache_key = logic::get_cache_key(&first_page_url);

    let is_cached = {
        state
            .cache
            .read()
            .expect("lock poisoned")
            .contains_key(&cache_key)
    };

    if is_cached {
        Json(serde_json::json!({ "status": "processed" }))
    } else {
        Json(serde_json::json!({ "status": "idle" }))
    }
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
    let mut cache = state.cache.write().expect("lock");
    cache.clear();

    drop(cache);

    state.save_cache();
    Json(serde_json::json!({ "status": "cleared" }))
}

pub async fn export_cache_handler(
    State(state): State<AppState>,
) -> Json<std::collections::HashMap<String, CacheEntry>> {
    let cache = state.cache.read().expect("lock");
    Json(cache.clone())
}

pub async fn import_cache_handler(
    State(state): State<AppState>,
    Json(data): Json<std::collections::HashMap<String, CacheEntry>>,
) -> Json<serde_json::Value> {
    let mut added = 0;

    {
        let mut cache = state.cache.write().expect("lock");
        for (k, v) in data {
            if !cache.contains_key(&k) {
                cache.insert(k, v);
                added += 1;
            }
        }
    } // Drop lock

    if added > 0 {
        state.save_cache();
    }
    Json(serde_json::json!({ "message": "Import successful", "added": added }))
}
