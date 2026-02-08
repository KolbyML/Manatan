use crate::backend::google_drive::GoogleDriveBackend;
use crate::types::SyncConfig;
use sled::Db;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

const DB_KEY_DEVICE_ID: &[u8] = b"device_id";
const DB_KEY_ACCESS_TOKEN: &[u8] = b"google_access_token";
const DB_KEY_REFRESH_TOKEN: &[u8] = b"google_refresh_token";
const DB_KEY_LAST_SYNC: &[u8] = b"last_sync_timestamp";
const DB_KEY_LAST_ETAG: &[u8] = b"last_sync_etag";
const DB_KEY_SYNC_CONFIG: &[u8] = b"sync_config";
const DB_KEY_AUTH_STATE: &[u8] = b"oauth_state";
const DB_KEY_AUTH_REDIRECT_URI: &[u8] = b"oauth_redirect_uri";
const DB_KEY_AUTH_CODE_VERIFIER: &[u8] = b"oauth_code_verifier";

#[derive(Clone)]
pub struct SyncState {
    pub db: Db,
    pub data_dir: PathBuf,
    pub google_drive: Arc<RwLock<Option<GoogleDriveBackend>>>,
}

impl SyncState {
    pub fn new(data_dir: PathBuf) -> Self {
        let sync_dir = data_dir.join("sync");
        std::fs::create_dir_all(&sync_dir).expect("Failed to create sync directory");

        let db_path = sync_dir.join("sync.db");
        let db = sled::open(db_path).expect("Failed to open sync database");

        // Ensure device ID exists
        if db.get(DB_KEY_DEVICE_ID).ok().flatten().is_none() {
            let device_id = uuid::Uuid::new_v4().to_string();
            db.insert(DB_KEY_DEVICE_ID, device_id.as_bytes())
                .expect("Failed to generate device ID");
        }

        let state = Self {
            db,
            data_dir: sync_dir,
            google_drive: Arc::new(RwLock::new(None)),
        };

        // Try to initialize Google Drive if tokens exist
        let access_token = state.get_access_token();
        let refresh_token = state.get_refresh_token();
        if access_token.is_some() && refresh_token.is_some() {
            // Will be initialized lazily on first use
        }

        state
    }

    // Device ID
    pub fn get_device_id(&self) -> String {
        self.db
            .get(DB_KEY_DEVICE_ID)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }

    // OAuth Tokens
    pub fn get_access_token(&self) -> Option<String> {
        self.db
            .get(DB_KEY_ACCESS_TOKEN)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
    }

    pub fn set_access_token(&self, token: &str) -> Result<(), sled::Error> {
        self.db.insert(DB_KEY_ACCESS_TOKEN, token.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    pub fn get_refresh_token(&self) -> Option<String> {
        self.db
            .get(DB_KEY_REFRESH_TOKEN)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
    }

    pub fn set_refresh_token(&self, token: &str) -> Result<(), sled::Error> {
        self.db.insert(DB_KEY_REFRESH_TOKEN, token.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    pub fn clear_tokens(&self) -> Result<(), sled::Error> {
        self.db.remove(DB_KEY_ACCESS_TOKEN)?;
        self.db.remove(DB_KEY_REFRESH_TOKEN)?;
        self.db.flush()?;
        Ok(())
    }

    // OAuth State (for CSRF protection)
    pub fn set_auth_state(&self, state: &str) -> Result<(), sled::Error> {
        self.db.insert(DB_KEY_AUTH_STATE, state.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    pub fn get_auth_state(&self) -> Option<String> {
        self.db
            .get(DB_KEY_AUTH_STATE)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
    }

    pub fn clear_auth_state(&self) -> Result<(), sled::Error> {
        self.db.remove(DB_KEY_AUTH_STATE)?;
        self.db.flush()?;
        Ok(())
    }

    pub fn set_auth_code_verifier(&self, verifier: &str) -> Result<(), sled::Error> {
        self.db
            .insert(DB_KEY_AUTH_CODE_VERIFIER, verifier.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    pub fn get_auth_code_verifier(&self) -> Option<String> {
        self.db
            .get(DB_KEY_AUTH_CODE_VERIFIER)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
    }

    pub fn clear_auth_code_verifier(&self) -> Result<(), sled::Error> {
        self.db.remove(DB_KEY_AUTH_CODE_VERIFIER)?;
        self.db.flush()?;
        Ok(())
    }

    // OAuth Redirect URI (stored during auth start for callback)
    pub fn set_auth_redirect_uri(&self, uri: &str) -> Result<(), sled::Error> {
        self.db.insert(DB_KEY_AUTH_REDIRECT_URI, uri.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    pub fn get_auth_redirect_uri(&self) -> Option<String> {
        self.db
            .get(DB_KEY_AUTH_REDIRECT_URI)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
    }

    pub fn clear_auth_redirect_uri(&self) -> Result<(), sled::Error> {
        self.db.remove(DB_KEY_AUTH_REDIRECT_URI)?;
        self.db.flush()?;
        Ok(())
    }

    // Sync Metadata
    pub fn get_last_sync(&self) -> Option<i64> {
        self.db.get(DB_KEY_LAST_SYNC).ok().flatten().and_then(|v| {
            let bytes: [u8; 8] = v.as_ref().try_into().ok()?;
            Some(i64::from_le_bytes(bytes))
        })
    }

    pub fn set_last_sync(&self, timestamp: i64) -> Result<(), sled::Error> {
        self.db.insert(DB_KEY_LAST_SYNC, &timestamp.to_le_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    pub fn get_last_etag(&self) -> Option<String> {
        self.db
            .get(DB_KEY_LAST_ETAG)
            .ok()
            .flatten()
            .map(|v| String::from_utf8_lossy(&v).to_string())
    }

    pub fn set_last_etag(&self, etag: &str) -> Result<(), sled::Error> {
        self.db.insert(DB_KEY_LAST_ETAG, etag.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }

    // Sync Config
    pub fn get_sync_config(&self) -> SyncConfig {
        self.db
            .get(DB_KEY_SYNC_CONFIG)
            .ok()
            .flatten()
            .and_then(|v| serde_json::from_slice(&v).ok())
            .unwrap_or_default()
    }

    pub fn set_sync_config(&self, config: &SyncConfig) -> Result<(), sled::Error> {
        let bytes = serde_json::to_vec(config).unwrap_or_default();
        self.db.insert(DB_KEY_SYNC_CONFIG, bytes)?;
        self.db.flush()?;
        Ok(())
    }

    // Upload tracking (for resumable uploads)
    pub fn get_upload_state(&self, upload_id: &str) -> Option<UploadState> {
        let key = format!("upload:{}", upload_id);
        self.db
            .get(key.as_bytes())
            .ok()
            .flatten()
            .and_then(|v| serde_json::from_slice(&v).ok())
    }

    pub fn set_upload_state(
        &self,
        upload_id: &str,
        state: &UploadState,
    ) -> Result<(), sled::Error> {
        let key = format!("upload:{}", upload_id);
        let bytes = serde_json::to_vec(state).unwrap_or_default();
        self.db.insert(key.as_bytes(), bytes)?;
        self.db.flush()?;
        Ok(())
    }

    pub fn clear_upload_state(&self, upload_id: &str) -> Result<(), sled::Error> {
        let key = format!("upload:{}", upload_id);
        self.db.remove(key.as_bytes())?;
        self.db.flush()?;
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UploadState {
    pub upload_id: String,
    pub book_id: String,
    pub file_type: String, // "content" or "file"
    pub file_hash: String,
    pub total_size: u64,
    pub uploaded_bytes: u64,
    pub resumable_uri: Option<String>,
    pub started_at: i64,
    pub last_chunk_at: i64,
}
