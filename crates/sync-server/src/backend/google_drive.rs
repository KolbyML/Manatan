use crate::backend::{AuthFlow, PushResult, SyncBackend};
use crate::error::SyncError;
use crate::state::SyncState;
use crate::types::SyncPayload;
use async_trait::async_trait;
use base64::Engine as _;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use tracing::{error, info, warn};

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

const EMBEDDED_GDRIVE_CLIENT_ID: &str =
    "547124386971-e2bhbiav8rq299irqim61io2o02iucct.apps.googleusercontent.com";
const GDRIVE_CLIENT_ID_ENV: &str = "MANATAN_GDRIVE_CLIENT_ID";

#[derive(Debug, Clone)]
struct InstalledCredentials {
    client_id: String,
}

fn load_credentials() -> InstalledCredentials {
    let client_id = std::env::var(GDRIVE_CLIENT_ID_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            option_env!("MANATAN_GDRIVE_CLIENT_ID_COMPILED")
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| EMBEDDED_GDRIVE_CLIENT_ID.to_string());

    InstalledCredentials {
        client_id,
    }
}

// ============================================================================
// Constants
// ============================================================================

const SCOPES: &[&str] = &[
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/userinfo.email",
];

const GOOGLE_OAUTH_AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const DEFAULT_GOOGLE_OAUTH_BROKER_ENDPOINT: &str = "https://manatan.com/auth/google";
const GOOGLE_OAUTH_BROKER_ENDPOINT_ENV: &str = "MANATAN_GOOGLE_OAUTH_BROKER_ENDPOINT";
const GOOGLE_OAUTH_BROKER_TOKEN_ENV: &str = "MANATAN_GOOGLE_OAUTH_BROKER_TOKEN";
const SYNC_FILE_NAME: &str = "manatan_sync.proto.gz";
const FOLDER_MIME_TYPE: &str = "application/vnd.google-apps.folder";

fn oauth_token_endpoint() -> String {
    if let Some(configured_endpoint) = std::env::var(GOOGLE_OAUTH_BROKER_ENDPOINT_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return configured_endpoint;
    }

    if let Some(compiled_endpoint) = option_env!("MANATAN_GOOGLE_OAUTH_BROKER_ENDPOINT_COMPILED")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return compiled_endpoint;
    }

    if oauth_broker_token().is_some() {
        DEFAULT_GOOGLE_OAUTH_BROKER_ENDPOINT.to_string()
    } else {
        GOOGLE_OAUTH_TOKEN_ENDPOINT.to_string()
    }
}

fn oauth_broker_token() -> Option<String> {
    let runtime = std::env::var(GOOGLE_OAUTH_BROKER_TOKEN_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if runtime.is_some() {
        return runtime;
    }

    option_env!("MANATAN_GOOGLE_OAUTH_BROKER_TOKEN_COMPILED")
        .or(option_env!("MANATAN_GOOGLE_OAUTH_BROKER_TOKEN"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

type HyperConnector = HttpsConnector<HttpConnector>;

// ============================================================================
// Google Drive Backend
// ============================================================================

pub struct GoogleDriveBackend {
    state: SyncState,
    credentials: InstalledCredentials,
    hub: Option<DriveHub<HyperConnector>>,
}

impl GoogleDriveBackend {
    pub fn new(state: SyncState) -> Self {
        let credentials = load_credentials();

        Self {
            state,
            credentials,
            hub: None,
        }
    }

    pub async fn initialize(&mut self) -> Result<(), SyncError> {
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
            .with_webpki_roots()
            .https_or_http()
            .enable_http2()
            .build();

        let client = Client::builder(TokioExecutor::new()).build(connector);
        self.hub = Some(DriveHub::new(client, access_token));
        Ok(())
    }

    async fn refresh_access_token(&self) -> Result<(), SyncError> {
        let Some(refresh_token) = self.state.get_refresh_token() else {
            return Err(SyncError::NotAuthenticated);
        };

        let client = reqwest::Client::new();
        let params = vec![
            ("refresh_token".to_string(), refresh_token),
            ("client_id".to_string(), self.credentials.client_id.clone()),
            ("grant_type".to_string(), "refresh_token".to_string()),
        ];

        let endpoint = oauth_token_endpoint();
        let mut request = client.post(&endpoint).form(&params);
        if endpoint != GOOGLE_OAUTH_TOKEN_ENDPOINT {
            match oauth_broker_token() {
                Some(broker_token) => {
                    request = request.bearer_auth(broker_token);
                }
                None => {
                    warn!("Google OAuth broker endpoint selected but no broker token is available");
                }
            }
        }

        let response = request
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

    async fn exchange_code_for_tokens(&self, code: &str, redirect_uri: &str, code_verifier: &str) -> Result<(String, String), SyncError> {
        let client = reqwest::Client::new();
        let params = vec![
            ("code".to_string(), code.to_string()),
            ("client_id".to_string(), self.credentials.client_id.clone()),
            ("redirect_uri".to_string(), redirect_uri.to_string()),
            ("grant_type".to_string(), "authorization_code".to_string()),
            ("code_verifier".to_string(), code_verifier.to_string()),
        ];

        let endpoint = oauth_token_endpoint();
        let mut request = client.post(&endpoint).form(&params);
        if endpoint != GOOGLE_OAUTH_TOKEN_ENDPOINT {
            match oauth_broker_token() {
                Some(broker_token) => {
                    request = request.bearer_auth(broker_token);
                }
                None => {
                    warn!("Google OAuth broker endpoint selected but no broker token is available");
                }
            }
        }

        let response = request
            .send()
            .await
            .map_err(|e| SyncError::OAuthError(e.to_string()))?;
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
        let state = uuid::Uuid::new_v4().to_string();
        let code_verifier = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        let code_challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(code_verifier.as_bytes()));

        self.state.set_auth_state(&state)?;
        self.state.set_auth_code_verifier(&code_verifier)?;

        let scopes = SCOPES.join(" ");
        let auth_url = format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}&code_challenge={}&code_challenge_method=S256",
            GOOGLE_OAUTH_AUTH_ENDPOINT,
            self.credentials.client_id,
            urlencoding::encode(redirect_uri),
            urlencoding::encode(&scopes),
            state,
            urlencoding::encode(&code_challenge)
        );

        Ok(AuthFlow { auth_url, state })
    }

    async fn complete_auth(&mut self, code: &str, redirect_uri: &str) -> Result<(), SyncError> {
        let code_verifier = self
            .state
            .get_auth_code_verifier()
            .ok_or_else(|| SyncError::OAuthError("Missing PKCE verifier".to_string()))?;
        let (access_token, refresh_token) = self
            .exchange_code_for_tokens(code, redirect_uri, &code_verifier)
            .await?;
        self.state.set_access_token(&access_token)?;
        self.state.set_refresh_token(&refresh_token)?;
        self.state.clear_auth_state()?;
        self.state.clear_auth_code_verifier()?;
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
