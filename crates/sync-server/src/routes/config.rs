use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};

use crate::error::SyncError;
use crate::state::SyncState;
use crate::types::SyncConfig;

pub fn router() -> Router<SyncState> {
    Router::new()
        .route("/", get(get_config))
        .route("/", put(set_config))
}

async fn get_config(State(state): State<SyncState>) -> Json<SyncConfig> {
    Json(state.get_sync_config())
}

async fn set_config(
    State(state): State<SyncState>,
    Json(config): Json<SyncConfig>,
) -> Result<Json<SyncConfig>, SyncError> {
    state.set_sync_config(&config)?;
    Ok(Json(config))
}