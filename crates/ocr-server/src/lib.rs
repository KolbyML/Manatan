pub mod handlers;
pub mod jobs;
pub mod logic;
pub mod merge;
pub mod state;

use std::path::PathBuf;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use state::AppState;

/// Creates the OCR Router.
pub fn create_router(cache_dir: PathBuf) -> Router {
    let state = AppState::new(cache_dir);

    // Spawn the job worker if you want strict concurrency,
    // or we just spawn tasks per request (handled in handlers).

    Router::new()
        .route("/", get(handlers::status_handler))
        .route("/ocr", get(handlers::ocr_handler))
        .route("/preprocess-chapter", post(handlers::preprocess_handler))
        .route("/purge-cache", post(handlers::purge_cache_handler))
        .route("/export-cache", get(handlers::export_cache_handler))
        .route("/import-cache", post(handlers::import_cache_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB limit for imports
        .with_state(state)
}
