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
    info!("[MERGE] Starting sync operation...");
    ensure_backend(&state).await?;

    // Apply config if provided
    if let Some(config) = req.config {
        state.set_sync_config(&config)?;
        info!("[MERGE] Config updated - sync settings: progress={}, metadata={}, content={}, files={}",
              config.ln_progress, config.ln_metadata, config.ln_content, config.ln_files);
    }

    let device_id = state.get_device_id();
    let local_payload = req.payload;
    
    // Log local data summary
    let local_progress_count = local_payload.ln_progress.len();
    let local_metadata_count = local_payload.ln_metadata.len();
    
    // FIX 1: Removed .as_ref().map(...).unwrap_or(0). 
    // These fields are HashMaps, so they always exist (even if empty).
    let local_content_count = local_payload.ln_content.len();
    let local_files_count = local_payload.ln_files.len();
    
    info!("[MERGE] Local data: {} progress, {} metadata, {} content entries, {} files", 
          local_progress_count, local_metadata_count, local_content_count, local_files_count);

    // Pull remote data
    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    info!("[MERGE] Downloading remote data from Google Drive...");
    let remote_result = backend.pull().await?;

    let (merged_payload, conflicts, etag) = if let Some((remote_payload, remote_etag)) = remote_result {
        let remote_progress_count = remote_payload.ln_progress.len();
        let remote_metadata_count = remote_payload.ln_metadata.len();
        
        // FIX 2: Same fix for remote payload
        let remote_content_count = remote_payload.ln_content.len();
        
        info!("[MERGE] Remote data downloaded: {} progress, {} metadata, {} content entries",
              remote_progress_count, remote_metadata_count, remote_content_count);

        let remote_device_id = remote_payload.device_id.clone();

        // Check if same device
        if remote_device_id == device_id {
            info!("[MERGE] Same device detected ({}), will overwrite remote", device_id);
            (local_payload.clone(), vec![], Some(remote_etag))
        } else {
            info!("[MERGE] Different device detected. Local device: {}, Remote device: {}", device_id, remote_device_id);
            info!("[MERGE] Merging payloads...");
            let (merged, conflicts) = merge_payloads(local_payload, remote_payload, &device_id);
            
            let merged_progress = merged.ln_progress.len();
            let merged_metadata = merged.ln_metadata.len();
            info!("[MERGE] Merge complete: {} progress entries, {} metadata entries, {} conflicts", 
                  merged_progress, merged_metadata, conflicts.len());
            
            (merged, conflicts, Some(remote_etag))
        }
    } else {
        info!("[MERGE] No remote data found, using local data only");
        (local_payload, vec![], None)
    };

    drop(gdrive);

    // Push merged data
    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    info!("[MERGE] Uploading merged data to Google Drive...");
    let push_result = backend.push(&merged_payload, etag.as_deref()).await?;

    match push_result {
        PushResult::Success { etag: new_etag } => {
            info!("[MERGE] Upload successful! New etag: {}", new_etag);
            state.set_last_etag(&new_etag)?;
        }
        PushResult::Conflict { remote_etag } => {
            return Err(SyncError::Conflict(format!(
                "[MERGE] Conflict detected! Expected etag: {:?}, got: {}",
                etag, remote_etag
            )));
        }
    }

    let now = chrono::Utc::now().timestamp_millis();
    state.set_last_sync(now)?;

    let final_progress = merged_payload.ln_progress.len();
    let final_metadata = merged_payload.ln_metadata.len();
    info!("[MERGE] ========== SYNC COMPLETE ==========");
    info!("[MERGE] Timestamp: {}", now);
    info!("[MERGE] Total entries: {} progress, {} metadata", final_progress, final_metadata);
    info!("[MERGE] Conflicts resolved: {}", conflicts.len());
    info!("[MERGE] ==================================");

    Ok(Json(MergeResponse {
        payload: merged_payload,
        sync_timestamp: now,
        files_to_upload: vec![],
        files_to_download: vec![],
        conflicts,
    }))
}

async fn pull_handler(State(state): State<SyncState>) -> Result<Json<Option<SyncPayload>>, SyncError> {
    info!("[PULL] Starting pull operation...");
    ensure_backend(&state).await?;

    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    info!("[PULL] Downloading from Google Drive...");
    let result = backend.pull().await?;

    match &result {
        Some((payload, etag)) => {
            let progress_count = payload.ln_progress.len();
            let metadata_count = payload.ln_metadata.len();
            info!("[PULL] Downloaded: {} progress, {} metadata entries, etag: {}", 
                  progress_count, metadata_count, etag);
        }
        None => {
            info!("[PULL] No remote data found");
        }
    }

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
    info!("[PUSH] Starting push operation...");
    
    let payload_size = req.payload.ln_progress.len();
    let metadata_size = req.payload.ln_metadata.len();
    info!("[PUSH] Pushing: {} progress, {} metadata entries", payload_size, metadata_size);
    
    ensure_backend(&state).await?;

    let gdrive = state.google_drive.read().await;
    let backend = gdrive.as_ref().ok_or(SyncError::NotAuthenticated)?;

    info!("[PUSH] Uploading to Google Drive...");
    let result = backend.push(&req.payload, req.etag.as_deref()).await?;

    match result {
        PushResult::Success { etag } => {
            let now = chrono::Utc::now().timestamp_millis();
            state.set_last_sync(now)?;
            state.set_last_etag(&etag)?;
            
            info!("[PUSH] Upload successful! Timestamp: {}, etag: {}", now, etag);
            
            Ok(Json(PushResponse {
                success: true,
                etag,
                sync_timestamp: now,
            }))
        }
        PushResult::Conflict { remote_etag } => Err(SyncError::Conflict(format!(
            "[PUSH] Conflict detected! Remote etag: {}",
            remote_etag
        ))),
    }
}

