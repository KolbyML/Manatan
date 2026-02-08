use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use tracing::warn;

#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Not authenticated with sync backend")]
    NotAuthenticated,

    #[error("OAuth error: {0}")]
    OAuthError(String),

    #[error("Google Drive error: {0}")]
    DriveError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sled::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Sync conflict: {0}")]
    Conflict(String),

    #[error("Upload incomplete: {uploaded}/{total} bytes")]
    UploadIncomplete { uploaded: u64, total: u64 },

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

impl SyncError {
    pub fn user_message(&self) -> String {
        match self {
            SyncError::OAuthError(_) => {
                "Google Drive authentication failed. Please reconnect and try again.".to_string()
            }
            SyncError::DriveError(_) => {
                "Google Drive request failed. Please try again later.".to_string()
            }
            _ => self.to_string(),
        }
    }
}

impl IntoResponse for SyncError {
    fn into_response(self) -> Response {
        let (status, error_type) = match &self {
            SyncError::NotAuthenticated => (StatusCode::UNAUTHORIZED, "not_authenticated"),
            SyncError::OAuthError(_) => (StatusCode::BAD_REQUEST, "oauth_error"),
            SyncError::DriveError(_) => (StatusCode::BAD_GATEWAY, "drive_error"),
            SyncError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            SyncError::UploadIncomplete { .. } => {
                (StatusCode::PARTIAL_CONTENT, "upload_incomplete")
            }
            SyncError::FileNotFound(_) => (StatusCode::NOT_FOUND, "file_not_found"),
            SyncError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };

        if matches!(&self, SyncError::OAuthError(_) | SyncError::DriveError(_)) {
            warn!("Sync request failed [{}]: {}", error_type, self);
        }

        let body = Json(json!({
            "error": error_type,
            "message": self.user_message(),
        }));

        (status, body).into_response()
    }
}
