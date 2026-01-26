use std::{path::PathBuf, sync::Arc};

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use tower_http::{cors::CorsLayer, limit::RequestBodyLimitLayer};

pub mod handlers;
pub mod deinflector;
pub mod import;
pub mod lookup;
pub mod state;

use handlers::{
    import_handler, install_defaults_handler, install_language_handler, list_dictionaries_handler,
    lookup_handler, manage_dictionaries_handler, reset_db_handler, unload_handler,
};
use lookup::LookupService;
use state::AppState;

#[derive(Clone)]
pub struct ServerState {
    pub app: AppState,
    pub lookup: Arc<LookupService>,
}

pub fn create_router(data_dir: PathBuf) -> Router {
    let state = ServerState {
        app: AppState::new(data_dir),
        lookup: Arc::new(LookupService::new()),
    };

    let limit = 1024 * 1024 * 1024;

    Router::new()
        .route("/lookup", get(lookup_handler))
        .route("/dictionaries", get(list_dictionaries_handler))
        .route("/import", post(import_handler))
        .route("/reset", post(reset_db_handler))
        .route("/manage", post(manage_dictionaries_handler))
        .route("/install-defaults", post(install_defaults_handler))
        .route("/install-language", post(install_language_handler))
        .route("/unload", post(unload_handler))
        .layer(CorsLayer::permissive())
        .layer(DefaultBodyLimit::max(limit))
        .layer(RequestBodyLimitLayer::new(limit))
        .with_state(state)
}
