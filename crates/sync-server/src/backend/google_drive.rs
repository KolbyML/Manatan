use crate::backend::{AuthFlow, PushResult, SyncBackend};
use crate::error::SyncError;
use crate::state::SyncState;
use crate::types::SyncPayload;
use async_trait::async_trait;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::Deserialize;
use std::io::{Read, Write};
use std::path::Path;
use tracing::{debug, error, info};

// Re-exports from google-drive3
use google_drive3::api::File;
use google_drive3::hyper_rustls::HttpsConnector;
use google_drive3::hyper_util::client::legacy::connect::HttpConnector;
use google_drive3::hyper_util::client::legacy::Client;
use google_drive3::hyper_util::rt::TokioExecutor;
use google_drive3::DriveHub;

// ============================================================================
// OAuth Credentials
// ============================================================================

#[derive(Debug, Deserialize)]
struct ClientSecrets {
    installed: InstalledCredentials,
}

#[derive(Debug, Deserialize, Clone)]
struct InstalledCredentials {
    client_id: String,
    client_secret: String,
    #[serde(default = "default_auth_uri")]
    auth_uri: String,
    #[serde(default = "default_token_uri")]
    token_uri: String,
    #[serde(default)]
    redirect_uris: Vec<String>,
}

fn default_auth_uri() -> String {
    "https://accounts.google.com/o/oauth2/auth".to_string()
}

fn default_token_uri() -> String {
    "https://oauth2.googleapis.com/token".to_string()
}

fn load_credentials(data_dir: &Path) -> Result<InstalledCredentials, SyncError> {
    let possible_paths = [
        data_dir.join("client_secrets.json"),
        data_dir.join("secrets").join("client_secrets.json"),
        std::env::current_dir()
            .unwrap_or_default()
            .join("crates")
            .join("sync-server")
            .join("secrets")
            .join("client_secrets.json"),
    ];

    for path in &possible_paths {
        if path.exists() {
            let content = std::fs::read_to_string(path).map_err(SyncError::IoError)?;
            let secrets: ClientSecrets = serde_json::from_str(&content).map_err(|e| {
                SyncError::OAuthError(format!("Failed to parse client_secrets.json: {}", e))
            })?;
            return Ok(secrets.installed);
        }
    }
    Err(SyncError::OAuthError("client_secrets.json not found".to_string()))
}

// ============================================================================
// Constants
// ============================================================================

const SCOPES: &[&str] = &[
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/userinfo.email",
];

const SYNC_FILE_NAME: &str = "manatan_sync.proto.gz";
const FOLDER_MIME_TYPE: &str = "application/vnd.google-apps.folder";

type HyperConnector = HttpsConnector<HttpConnector>;

// ============================================================================
// Google Drive Backend
// ============================================================================

pub struct GoogleDriveBackend {
    state: SyncState,
    credentials: Option<InstalledCredentials>,
    hub: Option<DriveHub<HyperConnector>>,
}

impl GoogleDriveBackend {
    pub fn new(state: SyncState) -> Self {
        let credentials = match load_credentials(&state.data_dir) {
            Ok(creds) => Some(creds),
            Err(e) => {
                error!("Failed to load OAuth credentials: {}", e);
                None
            }
        };

        Self {
            state,
            credentials,
            hub: None,
        }
    }

    fn get_credentials(&self) -> Result<&InstalledCredentials, SyncError> {
        self.credentials.as_ref().ok_or_else(|| {
            SyncError::OAuthError("OAuth credentials not loaded".to_string())
        })
    }

    pub async fn initialize(&mut self) -> Result<(), SyncError> {
        self.get_credentials()?;
        if self.state.get_access_token().is_none() || self.state.get_refresh_token().is_none() {
            return Err(SyncError::NotAuthenticated);
        }
        self.setup_hub().await?;
        Ok(())
    }

    async fn setup_hub(&mut self) -> Result<(), SyncError> {
        let Some(access_token) = self.state.get_access_token() else {
            return Err(SyncError::NotAuthenticated);
        };

        let connector = google_drive3::hyper_rustls::HttpsConnectorBuilder::new()
            .with_native_roots()
            .map_err(|e| SyncError::OAuthError(e.to_string()))?
            .https_or_http()
            .enable_http2()
            .build();

        let client = Client::builder(TokioExecutor::new()).build(connector);
        self.hub = Some(DriveHub::new(client, access_token));
        Ok(())
    }

    async fn refresh_access_token(&self) -> Result<(), SyncError> {
        let credentials = self.get_credentials()?;
        let Some(refresh_token) = self.state.get_refresh_token() else {
            return Err(SyncError::NotAuthenticated);
        };

        let client = reqwest::Client::new();
        let params = [
            ("refresh_token", refresh_token.as_str()),
            ("client_id", credentials.client_id.as_str()),
            ("client_secret", credentials.client_secret.as_str()),
            ("grant_type", "refresh_token"),
        ];

        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| SyncError::OAuthError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(SyncError::OAuthError(format!("Token refresh failed: {error_text}")));
        }

        #[derive(Deserialize)]
        struct RefreshResponse {
            access_token: String,
        }

        let refreshed: RefreshResponse = response
            .json()
            .await
            .map_err(|e| SyncError::OAuthError(e.to_string()))?;

        self.state.set_access_token(&refreshed.access_token)?;
        Ok(())
    }

    fn get_hub(&self) -> Result<&DriveHub<HyperConnector>, SyncError> {
        self.hub.as_ref().ok_or(SyncError::NotAuthenticated)
    }

    async fn get_or_create_folder(&self) -> Result<String, SyncError> {
        let hub = self.get_hub()?;
        let config = self.state.get_sync_config();

        if config.google_drive_folder_type == crate::types::GoogleDriveFolderType::AppData {
            return Ok("appDataFolder".to_string());
        }

        let folder_name = config.google_drive_folder;
        let query = format!("name = '{}' and mimeType = '{}' and trashed = false", folder_name, FOLDER_MIME_TYPE);

        let (_, file_list) = hub.files().list().q(&query).spaces("drive").doit().await.map_err(|e| SyncError::DriveError(e.to_string()))?;

        if let Some(files) = file_list.files {
            if let Some(folder) = files.first() {
                if let Some(id) = &folder.id {
                    return Ok(id.clone());
                }
            }
        }

        let folder = File {
            name: Some(folder_name),
            mime_type: Some(FOLDER_MIME_TYPE.to_string()),
            ..Default::default()
        };

        let (_, created_file) = hub.files().create(folder).upload(std::io::Cursor::new(Vec::<u8>::new()), "application/vnd.google-apps.folder".parse().unwrap()).await.map_err(|e| SyncError::DriveError(e.to_string()))?;
        created_file.id.ok_or_else(|| SyncError::DriveError("Failed to get folder ID".to_string()))
    }

    async fn find_sync_file(&self, folder_id: &str) -> Result<Option<(String, String)>, SyncError> {
        let hub = self.get_hub()?;
        let config = self.state.get_sync_config();
        let spaces = if config.google_drive_folder_type == crate::types::GoogleDriveFolderType::AppData { "appDataFolder" } else { "drive" };
        let query = if folder_id == "appDataFolder" {
            format!("name = '{}' and trashed = false", SYNC_FILE_NAME)
        } else {
            format!("name = '{}' and '{}' in parents and trashed = false", SYNC_FILE_NAME, folder_id)
        };

        let (_, file_list) = hub.files().list().q(&query).spaces(spaces).param("fields", "files(id,name,md5Checksum,appProperties)").doit().await.map_err(|e| SyncError::DriveError(e.to_string()))?;

        if let Some(files) = file_list.files {
            if let Some(file) = files.first() {
                return Ok(Some((file.id.clone().unwrap_or_default(), file.md5_checksum.clone().unwrap_or_default())));
            }
        }
        Ok(None)
    }

    async fn download_file(&self, file_id: &str) -> Result<Vec<u8>, SyncError> {
        let hub = self.get_hub()?;
        let (response, _) = hub.files().get(file_id).param("alt", "media").doit().await.map_err(|e| SyncError::DriveError(e.to_string()))?;
        
        use http_body_util::BodyExt;
        let body_bytes = response.into_body().collect().await.map_err(|e| SyncError::DriveError(e.to_string()))?.to_bytes();
        info!("Downloaded {} bytes from Google Drive", body_bytes.len());
        Ok(body_bytes.to_vec())
    }

    async fn exchange_code_for_tokens(&self, code: &str, redirect_uri: &str) -> Result<(String, String), SyncError> {
        let credentials = self.get_credentials()?;
        let client = reqwest::Client::new();
        let params = [
            ("code", code),
            ("client_id", &credentials.client_id),
            ("client_secret", &credentials.client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ];

        let response = client.post("https://oauth2.googleapis.com/token").form(&params).send().await.map_err(|e| SyncError::OAuthError(e.to_string()))?;
        if !response.status().is_success() {
            return Err(SyncError::OAuthError(format!("Token exchange failed: {}", response.text().await.unwrap_or_default())));
        }

        #[derive(Deserialize)]
        struct TokenResponse { access_token: String, refresh_token: Option<String> }
        let token_response: TokenResponse = response.json().await.map_err(|e| SyncError::OAuthError(e.to_string()))?;
        let refresh_token = token_response.refresh_token.ok_or_else(|| SyncError::OAuthError("No refresh token".to_string()))?;
        Ok((token_response.access_token, refresh_token))
    }

    async fn do_refresh_token(&mut self) -> Result<(), SyncError> {
        self.refresh_access_token().await?;
        self.setup_hub().await?;
        Ok(())
    }
}

#[async_trait]
impl SyncBackend for GoogleDriveBackend {
    async fn pull(&self) -> Result<Option<(SyncPayload, String)>, SyncError> {
        let folder_id = self.get_or_create_folder().await?;
        info!("[DRIVE] Using folder: {}", folder_id);

        let Some((file_id, etag)) = self.find_sync_file(&folder_id).await? else {
            info!("[DRIVE] No sync file found");
            return Ok(None);
        };

        info!("[DRIVE] Found sync file: {}, etag: {}", file_id, etag);
        let body_bytes = self.download_file(&file_id).await?;
        
        let mut decoder = GzDecoder::new(&body_bytes[..]);
        let mut decompressed = Vec::new();
        match decoder.read_to_end(&mut decompressed) {
            Ok(size) => info!("[DRIVE] Decompressed to: {} bytes", size),
            Err(e) => {
                error!("[DRIVE] Failed to decompress: {}", e);
                return Err(SyncError::IoError(e));
            }
        };

        let payload: SyncPayload = serde_json::from_slice(&decompressed).map_err(SyncError::SerializationError)?;
        Ok(Some((payload, etag)))
    }

    async fn push(&self, data: &SyncPayload, etag: Option<&str>) -> Result<PushResult, SyncError> {
        let folder_id = self.get_or_create_folder().await?;
        let existing_file = self.find_sync_file(&folder_id).await?;
        let config = self.state.get_sync_config();

        let json_bytes = serde_json::to_vec(data).map_err(SyncError::SerializationError)?;
        
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&json_bytes).map_err(SyncError::IoError)?;
        let compressed = encoder.finish().map_err(SyncError::IoError)?;
        
        let reduction = if json_bytes.len() > 0 { 
            (100.0 - (compressed.len() as f64 / json_bytes.len() as f64 * 100.0)) as i32 
        } else { 0 };
        info!("[DRIVE] Compressed: {} -> {} bytes ({}% reduction)", json_bytes.len(), compressed.len(), reduction);

        let hub = self.get_hub()?;
        let cursor = std::io::Cursor::new(compressed);
        let device_id = self.state.get_device_id();
        let mime: mime::Mime = "application/gzip".parse().unwrap();

        let mut file_metadata = File::default();
        file_metadata.app_properties = Some([("deviceId".to_string(), device_id)].into_iter().collect());

        if let Some((file_id, current_etag)) = existing_file {
            if let Some(expected_etag) = etag {
                if expected_etag != current_etag {
                    return Ok(PushResult::Conflict { remote_etag: current_etag });
                }
            }
            
            info!("[DRIVE] Uploading via resumable update...");
            let (_, result) = hub.files().update(file_metadata, &file_id).upload_resumable(cursor, mime).await.map_err(|e| SyncError::DriveError(e.to_string()))?;
            Ok(PushResult::Success { etag: result.md5_checksum.unwrap_or_default() })
        } else {
            file_metadata.name = Some(SYNC_FILE_NAME.to_string());
            if config.google_drive_folder_type == crate::types::GoogleDriveFolderType::AppData {
                file_metadata.parents = Some(vec!["appDataFolder".to_string()]);
            } else {
                file_metadata.parents = Some(vec![folder_id.clone()]);
            }
            
            info!("[DRIVE] Uploading via resumable create...");
            let (_, result) = hub.files().create(file_metadata).upload_resumable(cursor, mime).await.map_err(|e| SyncError::DriveError(e.to_string()))?;
            Ok(PushResult::Success { etag: result.md5_checksum.unwrap_or_default() })
        }
    }

    async fn is_authenticated(&self) -> bool {
        self.hub.is_some() || (self.state.get_access_token().is_some() && self.state.get_refresh_token().is_some())
    }

    async fn get_user_info(&self) -> Result<Option<String>, SyncError> {
        let Some(access_token) = self.state.get_access_token() else { return Ok(None); };

        let client = reqwest::Client::new();
        let response = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| SyncError::OAuthError(e.to_string()))?;

        if !response.status().is_success() {
            // Don't return error here, return None so auth_status logic can attempt refresh
            return Ok(None);
        }

        #[derive(Deserialize)]
        struct UserInfo { email: Option<String> }
        let user_info: UserInfo = response.json().await.map_err(|e| SyncError::OAuthError(e.to_string()))?;
        Ok(user_info.email)
    }

    fn start_auth(&self, redirect_uri: &str) -> Result<AuthFlow, SyncError> {
        let credentials = self.get_credentials()?;
        let state = uuid::Uuid::new_v4().to_string();
        self.state.set_auth_state(&state)?;

        let scopes = SCOPES.join(" ");
        let auth_url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}",
            credentials.client_id, urlencoding::encode(redirect_uri), urlencoding::encode(&scopes), state
        );

        Ok(AuthFlow { auth_url, state })
    }

    async fn complete_auth(&mut self, code: &str, redirect_uri: &str) -> Result<(), SyncError> {
        let (access_token, refresh_token) = self.exchange_code_for_tokens(code, redirect_uri).await?;
        self.state.set_access_token(&access_token)?;
        self.state.set_refresh_token(&refresh_token)?;
        self.state.clear_auth_state()?;
        self.setup_hub().await?;
        info!("Successfully authenticated with Google Drive");
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), SyncError> {
        self.state.clear_tokens()?;
        self.hub = None;
        let token_path = self.state.data_dir.join("google_tokens.json");
        let _ = std::fs::remove_file(token_path);
        info!("Disconnected from Google Drive");
        Ok(())
    }

    async fn refresh_token(&mut self) -> Result<(), SyncError> {
        self.do_refresh_token().await
    }
}