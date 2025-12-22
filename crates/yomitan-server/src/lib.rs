use axum::{
    Router,
    routing::{get, post},
};
use std::{path::PathBuf, sync::Arc};
use tower_http::{cors::CorsLayer, limit::RequestBodyLimitLayer};
use tracing::{error, info};

pub mod handlers;
pub mod import;
pub mod lookup;
pub mod state;

use handlers::{import_handler, list_dictionaries_handler, lookup_handler};
use lookup::LookupService;
use state::AppState;

// This zip file must exist in your assets folder or be compiled in.
// Ensure the path is correct relative to this file.
const PREBAKED_DICT: &[u8] = include_bytes!("../assets/JMdict_english.zip");

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

    let app_state_clone = state.app.clone();

    // Background task to load or import dictionary
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        let needs_import = {
            let db = app_state_clone.inner.read().expect("lock");
            db.dictionaries.is_empty()
        };

        if needs_import {
            info!("📦 [Yomitan] No saved state. Setting LOADING flag and importing...");
            app_state_clone.set_loading(true);

            // Note: PREBAKED_DICT is used here.
            // If you get file not found errors during compile, ensure JMdict_english.zip is in crates/mangatan-yomitan-server/
            match import::import_zip(&app_state_clone, PREBAKED_DICT) {
                Ok(msg) => info!("✅ [Yomitan] Prebake Success: {}", msg),
                Err(e) => error!("❌ [Yomitan] Prebake Failed: {}", e),
            }

            app_state_clone.set_loading(false);
        } else {
            info!("ℹ️ [Yomitan] State loaded from disk. Ready.");
        }
    });

    Router::new()
        .route("/lookup", get(lookup_handler))
        .route("/dictionaries", get(list_dictionaries_handler))
        .route("/import", post(import_handler))
        .layer(CorsLayer::permissive())
        .layer(RequestBodyLimitLayer::new(250 * 1024 * 1024))
        .with_state(state)
}
