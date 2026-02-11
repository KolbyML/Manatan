use axum::{
    extract::{Query, State},
    http::{HeaderMap, header::USER_AGENT},
    response::{IntoResponse, Redirect},
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
        .route("/disconnect", get(disconnect).post(disconnect))
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

async fn auth_status(State(state): State<SyncState>) -> Result<impl IntoResponse, SyncError> {
    // 1. Get a WRITE lock so we can modify the backend state and refresh tokens
    let mut gdrive = state.google_drive.write().await;

    // 2. If backend is not initialized (e.g., server restarted), try to initialize it from DB
    if gdrive.is_none() {
        let access_token = state.get_access_token();
        let refresh_token = state.get_refresh_token();
        
        if access_token.is_some() && refresh_token.is_some() {
            tracing::info!("[AUTH] Found existing tokens, initializing backend");
            let mut backend = GoogleDriveBackend::new(state.clone());
            // If initialization fails, we just don't set the backend
            if let Ok(_) = backend.initialize().await {
                *gdrive = Some(backend);
            }
        }
    }

    // 3. Check authentication status and get email
    let mut did_refresh = false;
    let (connected, email) = if let Some(backend) = gdrive.as_mut() {
        let is_auth = backend.is_authenticated().await;
        
        let mut user_email = if is_auth {
            backend.get_user_info().await.ok().flatten()
        } else {
            None
        };

        // 4. AUTO-REFRESH: If authenticated but email is missing, the token likely expired.
        if is_auth && user_email.is_none() {
            tracing::info!("[AUTH] Token likely expired (no email), attempting refresh...");
            if let Ok(_) = backend.refresh_token().await {
                // Try to get email again with the new token
                user_email = backend.get_user_info().await.ok().flatten();
                if user_email.is_some() {
                    did_refresh = true;
                    tracing::info!("[AUTH] Token refreshed successfully, email: {:?}", user_email);
                }
            }
        }

        (is_auth, user_email)
    } else {
        // Fallback: Check if tokens exist in DB even if backend isn't ready
        let has_tokens = state.get_access_token().is_some() && state.get_refresh_token().is_some();
        (has_tokens, None)
    };

    let config = state.get_sync_config();

    let response = Json(AuthStatusResponse {
        connected,
        backend: format!("{:?}", config.backend).to_lowercase(),
        email,
        last_sync: state.get_last_sync(),
        device_id: state.get_device_id(),
    });

    let mut headers = axum::http::HeaderMap::new();
    if did_refresh {
        headers.insert(
            "x-manatan-toast",
            axum::http::HeaderValue::from_static("Restart the app to apply the new setting."),
        );
        headers.insert(
            "x-manatan-toast-variant",
            axum::http::HeaderValue::from_static("info"),
        );
    }

    Ok((headers, response))
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
    // Store the redirect_uri to use in the callback (it must match exactly)
    state.set_auth_redirect_uri(&req.redirect_uri)?;
    
    let backend = GoogleDriveBackend::new(state.clone());
    let auth_flow = backend.start_auth(&req.redirect_uri)?;

    // Store backend for later (write lock)
    *state.google_drive.write().await = Some(backend);

    Ok(Json(auth_flow))
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: String,
    pub state: Option<String>,
}

async fn google_callback(
    State(state): State<SyncState>,
    headers: HeaderMap,
    Query(query): Query<CallbackQuery>,
) -> Result<Redirect, SyncError> {
    let ua = headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let is_android = ua.contains("Android");

    let success_target = if is_android {
        format!(
            "manatan://launch?url={}",
            urlencoding::encode("http://127.0.0.1:4568/settings/sync")
        )
    } else {
        "/settings/sync".to_string()
    };

    match handle_callback(state, query.code, query.state).await {
        Ok(_) => Ok(Redirect::to(&success_target)),
        Err(e) => {
            tracing::warn!("[AUTH] Google callback failed: {e}");
            let user_message = e.user_message();
            let error_message = urlencoding::encode(&user_message);
            if is_android {
                let target = format!(
                    "manatan://launch?url={}",
                    urlencoding::encode(&format!("http://127.0.0.1:4568/settings/sync?error={error_message}"))
                );
                Ok(Redirect::to(&target))
            } else {
                Ok(Redirect::to(&format!("/settings/sync?error={error_message}")))
            }
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallbackPostBody {
    pub code: String,
    pub state: Option<String>,
    pub redirect_uri: String,
}

#[derive(Serialize)]
pub struct CallbackResponse {
    pub success: bool,
    pub message: String,
}

async fn google_callback_post(
    State(state): State<SyncState>,
    Json(body): Json<CallbackPostBody>,
) -> Result<Json<CallbackResponse>, SyncError> {
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
    if let Some(received) = &received_state {
        if let Some(stored) = state.get_auth_state() {
            if received != &stored {
                return Err(SyncError::OAuthError("State mismatch".to_string()));
            }
        }
    }

    let Some(redirect_uri) = state.get_auth_redirect_uri() else {
        return Err(SyncError::OAuthError("No stored redirect_uri found".to_string()));
    };

    let mut gdrive = state.google_drive.write().await;
    let backend = gdrive.get_or_insert_with(|| GoogleDriveBackend::new(state.clone()));

    backend.complete_auth(&code, &redirect_uri).await?;

    let _ = state.clear_auth_redirect_uri();

    let mut config = state.get_sync_config();
    config.backend = crate::types::SyncBackendType::GoogleDrive;
    state.set_sync_config(&config)?;

    Ok(())
}

async fn disconnect(State(state): State<SyncState>) -> Result<Json<CallbackResponse>, SyncError> {
    let mut gdrive = state.google_drive.write().await;

    if let Some(backend) = gdrive.as_mut() {
        backend.disconnect().await?;
    } else {
        // If backend is not currently initialized, we still need to clear any
        // persisted OAuth tokens from the sync state database.
        state.clear_tokens()?;
    }

    *gdrive = None;
    let _ = state.clear_auth_state();
    let _ = state.clear_auth_code_verifier();
    let _ = state.clear_auth_redirect_uri();

    let mut config = state.get_sync_config();
    config.backend = crate::types::SyncBackendType::None;
    state.set_sync_config(&config)?;

    Ok(Json(CallbackResponse {
        success: true,
        message: "Disconnected from sync backend".to_string(),
    }))
}
