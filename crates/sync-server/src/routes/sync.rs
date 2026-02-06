use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use tracing::{debug, info};

use crate::backend::google_drive::GoogleDriveBackend;
use crate::backend::{PushResult, SyncBackend};
use crate::error::SyncError;
use crate::merge::merge_payloads;
use crate::state::SyncState;
use crate::types::{MergeRequest, MergeResponse, SyncPayload};

pub fn router() -> Router<SyncState> {
    Router::new()
        .route("/merge", post(merge_handler))
        .route("/pull", get(pull_handler))
        .route("/push", post(push_handler))
}

async fn ensure_backend(state: &SyncState) -> Result<(), SyncError> {
    let mut gdrive = state.google_drive.write().await;

    if gdrive.is_none() {
        let access_token = state.get_access_token();
        let refresh_token = state.get_refresh_token();

        if access_token.is_some() && refresh_token.is_some() {
            let mut backend = GoogleDriveBackend::new(state.clone());
            backend.initialize().await?;
            *gdrive = Some(backend);
        } else {
            return Err(SyncError::NotAuthenticated);
        }
    }

    // Refresh token before operations
    if let Some(backend) = gdrive.as_mut() {
        if let Err(e) = backend.refresh_token().await {
            debug!("Token refresh failed (may be okay): {}", e);
        }
    }

    Ok(())
}

async fn merge_handler(
    State(state): State<SyncState>,
    Json(req): Json<MergeRequest>,
) -> Result<Json<MergeResponse>, SyncError> {
    ensure_backend(&state).await?;

    // Apply config if provided
    if let Some(config) = req.config {
        state.set_sync_config(&config)?;
    }

    let device_id = state.get_device_id();
    let local_payload = req.payload;

    // Pull remote data
    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    let remote_result = backend.pull().await?;

    let (merged_payload, conflicts, etag) = if let Some((remote_payload, etag)) = remote_result {
        info!(
            "Merging local ({} books) with remote ({} books)",
            local_payload.ln_progress.len(),
            remote_payload.ln_progress.len()
        );

        let remote_device_id = remote_payload.device_id.clone();

        // Check if same device
        if remote_device_id == device_id {
            debug!("Same device, overwriting remote");
            (local_payload.clone(), vec![], Some(etag))
        } else {
            let (merged, conflicts) = merge_payloads(local_payload, remote_payload, &device_id);
            (merged, conflicts, Some(etag))
        }
    } else {
        info!("No remote data, using local");
        (local_payload, vec![], None)
    };

    drop(gdrive);

    // Push merged data
    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    let push_result = backend.push(&merged_payload, etag.as_deref()).await?;

    match push_result {
        PushResult::Success { etag: new_etag } => {
            state.set_last_etag(&new_etag)?;
        }
        PushResult::Conflict { remote_etag } => {
            return Err(SyncError::Conflict(format!(
                "Remote was modified. Expected etag: {:?}, got: {}",
                etag, remote_etag
            )));
        }
    }

    let now = chrono::Utc::now().timestamp_millis();
    state.set_last_sync(now)?;

    info!(
        "Sync complete. {} progress entries, {} metadata entries",
        merged_payload.ln_progress.len(),
        merged_payload.ln_metadata.len()
    );

    Ok(Json(MergeResponse {
        payload: merged_payload,
        sync_timestamp: now,
        files_to_upload: vec![],
        files_to_download: vec![],
        conflicts,
    }))
}

async fn pull_handler(State(state): State<SyncState>) -> Result<Json<Option<SyncPayload>>, SyncError> {
    ensure_backend(&state).await?;

    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    let result = backend.pull().await?;

    Ok(Json(result.map(|(payload, _)| payload)))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushRequest {
    pub payload: SyncPayload,
    pub etag: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResponse {
    pub success: bool,
    pub etag: String,
    pub sync_timestamp: i64,
}

async fn push_handler(
    State(state): State<SyncState>,
    Json(req): Json<PushRequest>,
) -> Result<Json<PushResponse>, SyncError> {
    ensure_backend(&state).await?;

    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    let result = backend.push(&req.payload, req.etag.as_deref()).await?;

    match result {
        PushResult::Success { etag } => {
            let now = chrono::Utc::now().timestamp_millis();
            state.set_last_sync(now)?;
            state.set_last_etag(&etag)?;

            Ok(Json(PushResponse {
                success: true,
                etag,
                sync_timestamp: now,
            }))
        }
        PushResult::Conflict { remote_etag } => Err(SyncError::Conflict(format!(
            "Remote was modified. Remote etag: {}",
            remote_etag
        ))),
    }
}