pub use manatan_sync_server::types::{
    BlockIndexMap, BookStats, LNHighlight, LNMetadata, LNParsedBook, LNProgress, LnCategory,
    LnCategoryMetadata, TocItem,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadataRequest {
    pub metadata: LNMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgressRequest {
    pub progress: LNProgress,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryRequest {
    pub category: LnCategory,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredEpub {
    pub id: String,
    pub file_name: String,
}
