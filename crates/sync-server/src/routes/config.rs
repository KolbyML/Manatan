use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use tracing::info;

use crate::error::SyncError;
use crate::state::SyncState;
use crate::types::SyncConfig;

pub fn router() -> Router<SyncState> {
    Router::new()
        .route("/", get(get_config))
        .route("/", put(set_config))
}

async fn get_config(State(state): State<SyncState>) -> Json<SyncConfig> {
    info!("[CONFIG] Config retrieved");
    Json(state.get_sync_config())
}

async fn set_config(
    State(state): State<SyncState>,
    Json(config): Json<SyncConfig>,
) -> Result<Json<SyncConfig>, SyncError> {
    info!("[CONFIG] Config updated - sync settings: progress={}, metadata={}, content={}, files={}",
          config.ln_progress, config.ln_metadata, config.ln_content, config.ln_files);
    state.set_sync_config(&config)?;
    Ok(Json(config))
}