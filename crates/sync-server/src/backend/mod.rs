pub mod google_drive;

use crate::error::SyncError;
use crate::types::SyncPayload;
use async_trait::async_trait;

/// Result of a push operation
#[derive(Debug)]
pub enum PushResult {
    Success { etag: String },
    Conflict { remote_etag: String },
}

/// OAuth flow information
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthFlow {
    pub auth_url: String,
    pub state: String,
}

/// Authentication status
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub connected: bool,
    pub backend: String,
    pub email: Option<String>,
    pub last_sync: Option<i64>,
}

/// Trait for sync storage backends
#[async_trait]
pub trait SyncBackend: Send + Sync {
    /// Pull sync data from remote storage
    /// Returns (payload, etag) or None if no data exists
    async fn pull(&self) -> Result<Option<(SyncPayload, String)>, SyncError>;

    /// Push sync data to remote storage
    /// Uses etag for optimistic locking (If-Match)
    async fn push(&self, data: &SyncPayload, etag: Option<&str>) -> Result<PushResult, SyncError>;

    /// Check if authenticated
    async fn is_authenticated(&self) -> bool;

    /// Get user info (email, etc.)
    async fn get_user_info(&self) -> Result<Option<String>, SyncError>;

    /// Start authentication flow
    fn start_auth(&self, redirect_uri: &str) -> Result<AuthFlow, SyncError>;

    /// Complete authentication with authorization code
    async fn complete_auth(&mut self, code: &str, redirect_uri: &str) -> Result<(), SyncError>;

    /// Disconnect (clear tokens)
    async fn disconnect(&mut self) -> Result<(), SyncError>;

    /// Refresh access token
    async fn refresh_token(&mut self) -> Result<(), SyncError>;
}