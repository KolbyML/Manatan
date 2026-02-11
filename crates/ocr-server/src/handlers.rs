use std::sync::atomic::Ordering;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use futures::StreamExt;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{info, warn};

use crate::{
    jobs,
    language::OcrLanguage,
    logic,
    state::{AppState, CacheEntry},
};

#[derive(Deserialize)]
pub struct OcrRequest {
    pub url: String,
    pub user: Option<String>,
    pub pass: Option<String>,
    #[serde(default, rename = "base_url", alias = "baseUrl")]
    pub base_url: Option<String>,
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
    let chapter_key = params
        .base_url
        .as_ref()
        .map(|base| logic::get_cache_key(base, Some(language)));
    info!("OCR Handler: Incoming request for cache_key={}", cache_key);

    info!("OCR Handler: Checking cache...");
    if let Some(entry) = state.get_cache_entry(&cache_key) {
        info!("OCR Handler: Cache HIT for cache_key={}", cache_key);
        if let Some(chapter_key) = chapter_key.as_deref() {
            state.insert_chapter_cache(chapter_key, &cache_key);
        }
        state.requests_processed.fetch_add(1, Ordering::Relaxed);
        return Ok(Json(entry.data));
    }

    // Back-compat: older versions included sourceId in the cache key.
    // Try to find a matching entry and promote it to the normalized key.
    if let Some((_legacy_key, legacy_entry)) = state.get_cache_entry_sourceid_variant(&cache_key) {
        info!(
            "OCR Handler: Cache HIT via sourceId variant for cache_key={}",
            cache_key
        );
        if let Some(chapter_key) = chapter_key.as_deref() {
            state.insert_chapter_cache(chapter_key, &cache_key);
        }
        state.insert_cache_entry(&cache_key, &legacy_entry);
        state.requests_processed.fetch_add(1, Ordering::Relaxed);
        return Ok(Json(legacy_entry.data));
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

            if let Some(chapter_key) = chapter_key.as_deref() {
                state.insert_chapter_cache(chapter_key, &cache_key);
            }

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

#[derive(Deserialize)]
pub struct ChapterStatusQuery {
    pub base_url: String,
    pub user: Option<String>,
    pub pass: Option<String>,
    pub language: Option<OcrLanguage>,
}

#[derive(Deserialize)]
pub struct ChapterStatusBatchItem {
    pub base_url: String,
    pub pages: Option<Vec<String>>,
    pub language: Option<OcrLanguage>,
}

#[derive(Deserialize)]
pub struct ChapterStatusBatchRequest {
    pub chapters: Vec<ChapterStatusBatchItem>,
    pub user: Option<String>,
    pub pass: Option<String>,
    pub language: Option<OcrLanguage>,
}

async fn chapter_status(state: &AppState, req: JobRequest) -> Json<serde_json::Value> {
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

    let mut cached_count = 0usize;
    let mut total_expected = 0usize;
    if let Some(page_list) = req.pages.as_ref() {
        if page_list.is_empty() {
            return Json(serde_json::json!({
                "status": "idle",
                "cached_count": 0,
                "total_expected": 0
            }));
        }
        let mut cached_keys = Vec::new();
        for page in page_list {
            let cache_key = logic::get_cache_key(page, Some(language));
            if state.has_cache_entry(&cache_key)
                || state.has_cache_entry_prefix(&format!("{cache_key}?sourceId="))
                || state.has_cache_entry_prefix(&format!("{cache_key}&sourceId="))
            {
                cached_count += 1;
                cached_keys.push(cache_key);
            }
        }
        if cached_count > 0 {
            total_expected = page_list.len();
            state.set_chapter_pages(&job_key, total_expected);
            for cache_key in cached_keys {
                state.insert_chapter_cache(&job_key, &cache_key);
            }
        }
    } else {
        cached_count = state.count_chapter_cache(&job_key);
        if cached_count > 0 {
            if let Some((page_count, _)) = state.get_chapter_progress(&job_key) {
                total_expected = page_count;
            } else if let Some(page_count) = state.get_chapter_pages(&job_key) {
                total_expected = page_count;
            }
        }
    }

    // If we have cached pages but don't yet know how many pages exist in the chapter,
    // resolve the total page count via the REST chapter pages endpoint and persist it.
    // This commonly happens when pages were OCR'd on-demand (per-page) rather than via
    // a preprocess job that supplies the full page list.
    if cached_count > 0 && total_expected == 0 {
        match logic::resolve_total_pages_from_graphql(&req.base_url, req.user.clone(), req.pass.clone()).await {
            Ok(page_count) if page_count > 0 => {
                total_expected = page_count;
                state.set_chapter_pages(&job_key, total_expected);
            }
            Ok(_) => {}
            Err(err) => {
                warn!(
                    base_url = req.base_url,
                    error = %err,
                    "failed to resolve total pages for chapter"
                );
            }
        }
    }

    if total_expected > 0 && cached_count >= total_expected {
        return Json(serde_json::json!({
            "status": "processed",
            "cached_count": cached_count,
            "total_expected": total_expected
        }));
    }

    Json(serde_json::json!({
        "status": "idle",
        "cached_count": cached_count,
        "total_expected": total_expected
    }))
}

pub async fn is_chapter_preprocessed_handler(
    State(state): State<AppState>,
    Json(req): Json<JobRequest>,
) -> Json<serde_json::Value> {
    chapter_status(&state, req).await
}

pub async fn is_chapter_preprocessed_get_handler(
    State(state): State<AppState>,
    Query(req): Query<ChapterStatusQuery>,
) -> Json<serde_json::Value> {
    chapter_status(
        &state,
        JobRequest {
            base_url: req.base_url,
            user: req.user,
            pass: req.pass,
            context: "Check Status".to_string(),
            pages: None,
            add_space_on_merge: None,
            language: req.language,
        },
    )
    .await
}

pub async fn is_chapters_preprocessed_handler(
    State(state): State<AppState>,
    Json(req): Json<ChapterStatusBatchRequest>,
) -> Json<HashMap<String, serde_json::Value>> {
    let results = Arc::new(Mutex::new(HashMap::new()));
    let user = req.user.clone();
    let pass = req.pass.clone();
    let default_language = req.language;

    let concurrency_limit = 4;
    futures::stream::iter(req.chapters)
        .for_each_concurrent(concurrency_limit, |item| {
            let state = state.clone();
            let results = results.clone();
            let user = user.clone();
            let pass = pass.clone();
            async move {
                let language = item.language.or(default_language);
                let Json(value) = chapter_status(
                    &state,
                    JobRequest {
                        base_url: item.base_url.clone(),
                        user: user.clone(),
                        pass: pass.clone(),
                        context: "Batch Status".to_string(),
                        pages: item.pages,
                        add_space_on_merge: None,
                        language,
                    },
                )
                .await;
                let mut locked = results.lock().expect("lock poisoned");
                locked.insert(item.base_url, value);
            }
        })
        .await;

    let out = results.lock().expect("lock poisoned").clone();
    Json(out)
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

#[derive(Deserialize)]
pub struct DeleteChapterRequest {
    pub base_url: String,
    pub delete_data: Option<bool>,
    pub language: Option<OcrLanguage>,
}

pub async fn delete_chapter_handler(
    State(state): State<AppState>,
    Json(req): Json<DeleteChapterRequest>,
) -> Json<serde_json::Value> {
    let language = req.language.unwrap_or_default();
    let chapter_key = logic::get_cache_key(&req.base_url, Some(language));
    let delete_data = req.delete_data.unwrap_or(true);

    // If a job is currently tracked, drop the progress entry.
    // This doesn't cancel the underlying task, but keeps status checks consistent.
    {
        let mut locked = state.active_chapter_jobs.write().expect("lock poisoned");
        locked.remove(&chapter_key);
    }

    let (chapter_cache_rows, chapter_pages_rows, ocr_cache_rows) =
        state.delete_chapter_ocr(&chapter_key, delete_data);

    Json(serde_json::json!({
        "status": "deleted",
        "chapter_cache_rows": chapter_cache_rows,
        "chapter_pages_rows": chapter_pages_rows,
        "ocr_cache_rows": ocr_cache_rows,
        "delete_data": delete_data,
    }))
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
