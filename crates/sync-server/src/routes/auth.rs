use axum::{
    extract::{Query, State},
    response::Redirect,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::backend::google_drive::GoogleDriveBackend;
use crate::backend::{AuthFlow, SyncBackend};
use crate::error::SyncError;
use crate::state::SyncState;

pub fn router() -> Router<SyncState> {
    Router::new()
        .route("/status", get(auth_status))
        .route("/google/start", post(google_start))
        .route("/google/callback", get(google_callback))
        .route("/google/callback", post(google_callback_post))
        .route("/disconnect", post(disconnect))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatusResponse {
    pub connected: bool,
    pub backend: String,
    pub email: Option<String>,
    pub last_sync: Option<i64>,
    pub device_id: String,
}

async fn auth_status(State(state): State<SyncState>) -> Result<Json<AuthStatusResponse>, SyncError> {
    let gdrive = state.google_drive.read().await;

    let (connected, email) = if let Some(backend) = gdrive.as_ref() {
        let is_auth = backend.is_authenticated().await;
        let email = if is_auth {
            backend.get_user_info().await.ok().flatten()
        } else {
            None
        };
        (is_auth, email)
    } else {
        // Check if tokens exist even if backend not initialized
        let has_tokens = state.get_access_token().is_some() && state.get_refresh_token().is_some();
        (has_tokens, None)
    };

    let config = state.get_sync_config();

    Ok(Json(AuthStatusResponse {
        connected,
        backend: format!("{:?}", config.backend).to_lowercase(),
        email,
        last_sync: state.get_last_sync(),
        device_id: state.get_device_id(),
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAuthRequest {
    pub redirect_uri: String,
}

async fn google_start(
    State(state): State<SyncState>,
    Json(req): Json<StartAuthRequest>,
) -> Result<Json<AuthFlow>, SyncError> {
    let backend = GoogleDriveBackend::new(state.clone());
    let auth_flow = backend.start_auth(&req.redirect_uri)?;

    // Store backend for later
    *state.google_drive.write().await = Some(backend);

    Ok(Json(auth_flow))
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

#[derive(Serialize)]
pub struct CallbackResponse {
    pub success: bool,
    pub message: String,
}

async fn google_callback(
    State(state): State<SyncState>,
    Query(query): Query<CallbackQuery>,
) -> Result<Redirect, SyncError> {
    match handle_callback(state, query.code, query.state).await {
        Ok(_) => Ok(Redirect::to("/settings/sync")),
        Err(e) => Ok(Redirect::to(&format!("/settings/sync?error={}", urlencoding::encode(&e.to_string())))),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallbackPostBody {
    pub code: String,
    pub state: Option<String>,
    pub redirect_uri: String,
}

async fn google_callback_post(
    State(state): State<SyncState>,
    Json(body): Json<CallbackPostBody>,
) -> Result<Json<CallbackResponse>, SyncError> {
    // Verify state if provided
    if let Some(received_state) = &body.state {
        if let Some(stored_state) = state.get_auth_state() {
            if received_state != &stored_state {
                return Err(SyncError::OAuthError("State mismatch".to_string()));
            }
        }
    }

    let mut gdrive = state.google_drive.write().await;

    let backend = gdrive.get_or_insert_with(|| GoogleDriveBackend::new(state.clone()));

    backend.complete_auth(&body.code, &body.redirect_uri).await?;

    // Update config to use Google Drive
    let mut config = state.get_sync_config();
    config.backend = crate::types::SyncBackendType::GoogleDrive;
    state.set_sync_config(&config)?;

    Ok(Json(CallbackResponse {
        success: true,
        message: "Successfully connected to Google Drive".to_string(),
    }))
}

async fn handle_callback(
    state: SyncState,
    code: String,
    received_state: Option<String>,
) -> Result<(), SyncError> {
    // Verify state
    if let Some(received) = &received_state {
        if let Some(stored) = state.get_auth_state() {
            if received != &stored {
                return Err(SyncError::OAuthError("State mismatch".to_string()));
            }
        }
    }

    let mut gdrive = state.google_drive.write().await;

    let backend = gdrive.get_or_insert_with(|| GoogleDriveBackend::new(state.clone()));

    // Use a default redirect URI for GET callback
    let redirect_uri = format!(
        "http://localhost:4568/api/sync/auth/google/callback"
    );

    backend.complete_auth(&code, &redirect_uri).await?;

    // Update config
    let mut config = state.get_sync_config();
    config.backend = crate::types::SyncBackendType::GoogleDrive;
    state.set_sync_config(&config)?;

    Ok(())
}

async fn disconnect(State(state): State<SyncState>) -> Result<Json<CallbackResponse>, SyncError> {
    let mut gdrive = state.google_drive.write().await;

    if let Some(backend) = gdrive.as_mut() {
        backend.disconnect().await?;
    }

    *gdrive = None;

    // Update config
    let mut config = state.get_sync_config();
    config.backend = crate::types::SyncBackendType::None;
    state.set_sync_config(&config)?;

    Ok(Json(CallbackResponse {
        success: true,
        message: "Disconnected from sync backend".to_string(),
    }))
}