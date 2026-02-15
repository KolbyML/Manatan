use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Light Novel Progress
// ============================================================================

/// Reading progress for a light novel - matches TypeScript LNProgress
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LNProgress {
    /// Current chapter index
    #[serde(alias = "chapterIndex")]
    pub chapter_index: i32,

    /// Current page number (optional, for paginated view)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "pageNumber")]
    pub page_number: Option<i32>,

    /// Character offset within the chapter
    #[serde(alias = "chapterCharOffset")]
    pub chapter_char_offset: i32,

    /// Total characters read across all chapters
    #[serde(alias = "totalCharsRead")]
    pub total_chars_read: i32,

    /// The sentence currently being read
    #[serde(alias = "sentenceText")]
    pub sentence_text: String,

    /// Progress within current chapter (0.0 - 1.0)
    #[serde(alias = "chapterProgress")]
    pub chapter_progress: f64,

    /// Overall book progress (0.0 - 1.0)
    #[serde(alias = "totalProgress")]
    pub total_progress: f64,

    // Block tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "blockId")]
    pub block_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "blockLocalOffset")]
    pub block_local_offset: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "contextSnippet")]
    pub context_snippet: Option<String>,

    // Sync metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "lastRead")]
    pub last_read: Option<i64>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "lastModified")]
    pub last_modified: Option<i64>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "syncVersion")]
    pub sync_version: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,

    // Highlights
    #[serde(default)]
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<LNHighlight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LNHighlight {
    pub id: String,
    pub chapter_index: i32,
    pub block_id: String,
    pub text: String,
    pub start_offset: i32,
    pub end_offset: i32,
    pub created_at: i64,
}

impl LNProgress {
    /// Check if this progress is further along than another
    pub fn is_further_than(&self, other: &LNProgress) -> bool {
        self.total_progress > other.total_progress
    }

    /// Check if this progress is newer than another
    pub fn is_newer_than(&self, other: &LNProgress) -> bool {
        match (self.last_modified, other.last_modified) {
            (Some(a), Some(b)) => a > b,
            (Some(_), None) => true,
            (None, Some(_)) => false,
            (None, None) => false,
        }
    }

    /// Check if this has a higher sync version
    pub fn has_higher_version(&self, other: &LNProgress) -> bool {
        match (self.sync_version, other.sync_version) {
            (Some(a), Some(b)) => a > b,
            (Some(_), None) => true,
            (None, Some(_)) => false,
            (None, None) => false,
        }
    }
}

// ============================================================================
// Light Novel Metadata
// ============================================================================

/// Block index mapping for navigation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockIndexMap {
    #[serde(alias = "blockId")]
    pub block_id: String,
    #[serde(alias = "startOffset")]
    pub start_offset: i32,
    #[serde(alias = "endOffset")]
    pub end_offset: i32,
}

/// Book statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookStats {
    pub chapter_lengths: Vec<i32>,
    pub total_length: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_maps: Option<Vec<BlockIndexMap>>,
}

/// Table of contents item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TocItem {
    pub label: String,
    pub href: String,
    #[serde(alias = "chapterIndex")]
    pub chapter_index: i32,
}

/// Light novel metadata - matches TypeScript LNMetadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LNMetadata {
    pub id: String,
    pub title: String,
    pub author: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,

    #[serde(alias = "addedAt")]
    pub added_at: i64,

    // Processing state
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "isProcessing")]
    pub is_processing: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "isError")]
    pub is_error: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "errorMsg")]
    pub error_msg: Option<String>,

    // Pre-calculated on import
    pub stats: BookStats,
    #[serde(alias = "chapterCount")]
    pub chapter_count: i32,
    pub toc: Vec<TocItem>,

    // For library display
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "hasProgress")]
    pub has_progress: Option<bool>,

    // Sync metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "lastModified")]
    pub last_modified: Option<i64>,

    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "syncVersion")]
    pub sync_version: Option<i32>,
}

// ============================================================================
// Light Novel Content
// ============================================================================

/// Parsed book content - matches TypeScript LNParsedBook
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LNParsedBook {
    /// HTML content of each chapter
    pub chapters: Vec<String>,

    /// Images extracted from the EPUB (base64 encoded)
    #[serde(alias = "imageBlobs")]
    pub image_blobs: HashMap<String, String>,

    /// Original filenames of chapters
    #[serde(alias = "chapterFilenames")]
    pub chapter_filenames: Vec<String>,
}

/// Reference to a synced file (for file manifest)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReference {
    #[serde(alias = "bookId")]
    pub book_id: String,
    #[serde(alias = "fileType")]
    pub file_type: FileType,
    #[serde(alias = "fileHash")]
    pub file_hash: String,
    #[serde(alias = "fileSize")]
    pub file_size: u64,
    #[serde(alias = "lastModified")]
    pub last_modified: i64,
    #[serde(alias = "driveFileId")]
    pub drive_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    Epub,
    Content,
}

// ============================================================================
// Sync Payload
// ============================================================================

/// The complete sync payload exchanged between frontend, backend, and cloud
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncPayload {
    /// Schema version for future migrations
    pub schema_version: u32,

    /// Device ID that created this payload
    pub device_id: String,

    /// When this payload was created
    pub last_modified: i64,

    /// Reading progress for each book (bookId → progress)
    #[serde(default)]
    pub ln_progress: HashMap<String, LNProgress>,

    /// Metadata for each book (bookId → metadata)
    #[serde(default)]
    pub ln_metadata: HashMap<String, LNMetadata>,

    /// Parsed content for each book (bookId → content)
    /// Only included if sync_config.ln_content is true
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub ln_content: HashMap<String, LNParsedBook>,

    /// EPUB files as base64 (bookId → base64 data)
    /// Only included if sync_config.ln_files is true
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub ln_files: HashMap<String, String>,

    /// File manifest for resumable sync
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub file_manifest: HashMap<String, FileReference>,
}

impl SyncPayload {
    pub const CURRENT_SCHEMA_VERSION: u32 = 1;

    pub fn new(device_id: String) -> Self {
        Self {
            schema_version: Self::CURRENT_SCHEMA_VERSION,
            device_id,
            last_modified: chrono::Utc::now().timestamp_millis(),
            ..Default::default()
        }
    }
}

/// Request body for merge endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeRequest {
    /// Local payload from frontend
    pub payload: SyncPayload,

    /// What to sync (optional, uses stored config if not provided)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<SyncConfig>,
}

/// Response from merge endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResponse {
    /// The merged payload to apply locally
    pub payload: SyncPayload,

    /// Timestamp of this sync
    pub sync_timestamp: i64,

    /// Files that need to be uploaded (for resumable sync)
    #[serde(default)]
    pub files_to_upload: Vec<String>,

    /// Files that can be downloaded
    #[serde(default)]
    pub files_to_download: Vec<String>,

    /// Any conflicts that occurred (informational)
    #[serde(default)]
    pub conflicts: Vec<ConflictInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub book_id: String,
    pub field: String,
    pub local_value: String,
    pub remote_value: String,
    pub resolution: String,
}

// ============================================================================
// Sync Configuration
// ============================================================================

/// What data to sync - user configurable
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    // What to sync
    pub ln_progress: bool,
    pub ln_metadata: bool,
    pub ln_content: bool,
    pub ln_files: bool,

    // Sync triggers (matching Tachiyomi)
    pub sync_on_chapter_read: bool,
    pub sync_on_chapter_open: bool,
    pub sync_on_app_start: bool,
    pub sync_on_app_resume: bool,

    // Backend selection
    pub backend: SyncBackendType,

    // Google Drive settings
    pub google_drive_folder: String,
    pub google_drive_folder_type: GoogleDriveFolderType,

    // Deletion behavior
    pub deletion_behavior: DeletionBehavior,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            ln_progress: true,
            ln_metadata: true,
            ln_content: true,
            ln_files: false,
            sync_on_chapter_read: false,
            sync_on_chapter_open: false,
            sync_on_app_start: false,
            sync_on_app_resume: false,
            backend: SyncBackendType::None,
            google_drive_folder: "Manatan".to_string(),
            google_drive_folder_type: GoogleDriveFolderType::Public,
            deletion_behavior: DeletionBehavior::KeepEverywhere,
        }
    }
}

/// Google Drive folder type selection
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum GoogleDriveFolderType {
    #[default]
    Public,
    AppData,
}

/// Deletion behavior when syncing
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DeletionBehavior {
    #[default]
    KeepEverywhere,
    DeleteEverywhere,
    AskEachTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SyncBackendType {
    #[default]
    None,
    GoogleDrive,
    WebDav,
    SyncYomi,
}
