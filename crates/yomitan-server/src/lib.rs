use std::{path::PathBuf, sync::Arc};

use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{get, post},
};
use tower_http::{cors::CorsLayer, limit::RequestBodyLimitLayer};
use tracing::{error, info};

pub mod handlers;
pub mod deinflector;
pub mod import;
pub mod lookup;
pub mod state;

use handlers::{
    import_handler, install_defaults_handler, list_dictionaries_handler, lookup_handler,
    manage_dictionaries_handler, reset_db_handler, unload_handler,
};
use lookup::LookupService;
use state::AppState;

pub static PREBAKED_DICT: &[u8] = include_bytes!("../assets/JMdict_english.zip");

#[derive(Clone)]
pub struct ServerState {
    pub app: AppState,
    pub lookup: Arc<LookupService>,
}

pub fn create_router(data_dir: PathBuf, auto_install: bool) -> Router {
    let state = ServerState {
        app: AppState::new(data_dir),
        lookup: Arc::new(LookupService::new()),
    };

    let app_state_clone = state.app.clone();

    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        let needs_import = {
            let dicts = app_state_clone.dictionaries.read().expect("lock");
            dicts.is_empty()
        };

        if needs_import {
            if auto_install {
                info!("📦 [Yomitan] Auto-Install Enabled: Importing default dictionary...");
                app_state_clone.set_loading(true);

                match import::import_zip(&app_state_clone, PREBAKED_DICT) {
                    Ok(msg) => info!("✅ [Yomitan] Prebake Success: {}", msg),
                    Err(e) => error!("❌ [Yomitan] Prebake Failed: {}", e),
                }

                app_state_clone.set_loading(false);
            } else {
                info!("ℹ️ [Yomitan] Auto-Install Disabled. Waiting for user action.");
            }
        } else {
            info!("ℹ️ [Yomitan] State loaded from disk. Ready.");
        }
    });

    let limit = 1024 * 1024 * 1024;

    Router::new()
        .route("/lookup", get(lookup_handler))
        .route("/dictionaries", get(list_dictionaries_handler))
        .route("/import", post(import_handler))
        .route("/reset", post(reset_db_handler))
        .route("/manage", post(manage_dictionaries_handler))
        .route("/install-defaults", post(install_defaults_handler))
        .route("/unload", post(unload_handler))
        .layer(CorsLayer::permissive())
        .layer(DefaultBodyLimit::max(limit))
        .layer(RequestBodyLimitLayer::new(limit))
        .with_state(state)
}
