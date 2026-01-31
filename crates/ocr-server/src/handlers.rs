use std::sync::atomic::Ordering;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use tracing::{info, warn};

use crate::{
    jobs, logic,
    language::OcrLanguage,
    state::{AppState, CacheEntry},
};

#[derive(Deserialize)]
pub struct OcrRequest {
    pub url: String,
    pub user: Option<String>,
    pub pass: Option<String>,
    #[serde(default = "default_context")]
    pub context: String,
    pub add_space_on_merge: Option<bool>,
    pub language: Option<OcrLanguage>,
}

fn default_context() -> String {
    "No Context".to_string()
}

// --- Handlers ---

pub async fn status_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let cache_size = state.cache_len();
    Json(serde_json::json!({
        "status": "running",
        "backend": "Rust (manatan-ocr-server)",
        "requests_processed": state.requests_processed.load(Ordering::Relaxed),
        "items_in_cache": cache_size,
        "active_jobs": state.active_jobs.load(Ordering::Relaxed),
    }))
}

pub async fn ocr_handler(
    State(state): State<AppState>,
    Query(params): Query<OcrRequest>,
) -> Result<Json<Vec<crate::logic::OcrResult>>, (StatusCode, String)> {
    let language = params.language.unwrap_or_default();
    let cache_key = logic::get_cache_key(&params.url, Some(language));
    info!("OCR Handler: Incoming request for cache_key={}", cache_key);

    info!("OCR Handler: Checking cache...");
    if let Some(entry) = state.get_cache_entry(&cache_key) {
        info!("OCR Handler: Cache HIT for cache_key={}", cache_key);
        state.requests_processed.fetch_add(1, Ordering::Relaxed);
        return Ok(Json(entry.data));
    }
    info!(
        "OCR Handler: Cache MISS for cache_key={}. Starting processing.",
        cache_key
    );

    let result = logic::fetch_and_process(
        &params.url,
        params.user.clone(),
        params.pass.clone(),
        params.add_space_on_merge,
        language,
    )
    .await;

    match result {
        Ok(data) => {
            state.requests_processed.fetch_add(1, Ordering::Relaxed);
            info!(
                "OCR Handler: Processing successful for cache_key={}",
                cache_key
            );

            info!("OCR Handler: Writing cache entry to DB...");
            state.insert_cache_entry(
                &cache_key,
                &CacheEntry {
                    context: params.context,
                    data: data.clone(),
                },
            );
            info!("OCR Handler: Cache write complete.");

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
    pub add_space_on_merge: Option<bool>,
    pub language: Option<OcrLanguage>,
}

pub async fn is_chapter_preprocessed_handler(
    State(state): State<AppState>,
    Json(req): Json<JobRequest>,
) -> Json<serde_json::Value> {
    let language = req.language.unwrap_or_default();
    let job_key = logic::get_cache_key(&req.base_url, Some(language));
    let progress = {
        state
            .active_chapter_jobs
            .read()
            .expect("lock poisoned")
            .get(&job_key)
            .cloned()
    };

    if let Some(p) = progress {
        return Json(serde_json::json!({
            "status": "processing",
            "progress": p.current,
            "total": p.total
        }));
    }

    let chapter_base_path = job_key;

    let total = state.get_chapter_pages(&chapter_base_path);

    let total = match total {
        Some(total) => total,
        None => {
            match logic::resolve_total_pages_from_graphql(&req.base_url, req.user, req.pass).await {
                Ok(total) => {
                    state.set_chapter_pages(&chapter_base_path, total);
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

    let cached_count = state.count_cached_for_prefix(&chapter_base_path);
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
    let language = req.language.unwrap_or_default();
    let pages = match req.pages {
        Some(p) => p,
        None => return Json(serde_json::json!({ "error": "No pages provided" })),
    };

    let is_processing = {
        state
            .active_chapter_jobs
            .read()
            .expect("lock poisoned")
            .contains_key(&logic::get_cache_key(&req.base_url, Some(language)))
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
            req.add_space_on_merge,
            language,
        )
        .await;
    });

    Json(serde_json::json!({ "status": "started" }))
}

pub async fn purge_cache_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    state.clear_cache();
    Json(serde_json::json!({ "status": "cleared" }))
}

pub async fn export_cache_handler(
    State(state): State<AppState>,
) -> Json<std::collections::HashMap<String, CacheEntry>> {
    Json(state.export_cache())
}

pub async fn import_cache_handler(
    State(state): State<AppState>,
    Json(data): Json<std::collections::HashMap<String, CacheEntry>>,
) -> Json<serde_json::Value> {
    let added = state.import_cache(data);
    Json(serde_json::json!({ "message": "Import successful", "added": added }))
}
