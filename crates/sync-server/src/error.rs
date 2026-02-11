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
    fn oauth_detail(message: &str) -> Option<String> {
        let raw = message
            .strip_prefix("Token exchange failed:")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(message)
            .trim();

        if raw.is_empty() {
            return None;
        }

        if let Ok(json) = serde_json::from_str::<serde_json::Value>(raw) {
            let error = json
                .get("error")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            let description = json
                .get("error_description")
                .or_else(|| json.get("message"))
                .and_then(|value| value.as_str())
                .unwrap_or_default();

            if !error.is_empty() && !description.is_empty() {
                return Some(format!("{error}: {description}"));
            }
            if !error.is_empty() {
                return Some(error.to_string());
            }
            if !description.is_empty() {
                return Some(description.to_string());
            }
        }

        Some(raw.to_string())
    }

    pub fn user_message(&self) -> String {
        match self {
            SyncError::OAuthError(message) => {
                let message_lower = message.to_lowercase();

                if message.contains("Missing or invalid bearer token") {
                    return "Google OAuth broker rejected the request token. Ensure MANATAN_GOOGLE_OAUTH_BROKER_TOKEN matches the broker's MANATAN_BROKER_TOKEN.".to_string();
                }

                if message_lower.contains("invalid_client")
                    || message_lower.contains("unauthorized_client")
                {
                    return "Google OAuth client mismatch. Set MANATAN_GDRIVE_CLIENT_ID to the same value as the broker GOOGLE_CLIENT_ID, then reconnect.".to_string();
                }

                if message_lower.contains("redirect_uri_mismatch") {
                    return "Google OAuth redirect URI mismatch. Ensure the broker OAuth client allows http://127.0.0.1:4568/api/sync/auth/google/callback.".to_string();
                }

                if message_lower.contains("invalid_grant") {
                    return "Google rejected the authorization code. Try reconnecting, and verify MANATAN_GDRIVE_CLIENT_ID matches the broker GOOGLE_CLIENT_ID.".to_string();
                }

                if message_lower.contains("no refresh token") {
                    return "Google did not return a refresh token. Remove Manatan app access from your Google account security settings, then reconnect.".to_string();
                }

                if let Some(detail) = Self::oauth_detail(message) {
                    return format!("Google Drive authentication failed: {detail}");
                }

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
