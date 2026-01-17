pub mod handlers;
pub mod jobs;
pub mod logic;
pub mod merge;
pub mod state;

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use mangatan_stats_server::StatsDb;
use state::AppState;

/// Creates the OCR Router.
pub fn create_router(stats_db: StatsDb) -> Router {
    let state = AppState::new(stats_db);

    // Spawn the job worker if you want strict concurrency,
    // or we just spawn tasks per request (handled in handlers).

    Router::new()
        .route("/", get(handlers::status_handler))
        .route("/ocr", get(handlers::ocr_handler))
        .route(
            "/is-chapter-preprocessed",
            post(handlers::is_chapter_preprocessed_handler),
        )
        .route("/preprocess-chapter", post(handlers::preprocess_handler))
        .route("/purge-cache", post(handlers::purge_cache_handler))
        .route("/export-cache", get(handlers::export_cache_handler))
        .route("/import-cache", post(handlers::import_cache_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB limit for imports
        .with_state(state)
}
