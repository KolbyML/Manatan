use serde::{Deserialize, Serialize};
pub use manatan_sync_server::types::{
    LNMetadata, LNProgress, LNHighlight, LNParsedBook, LnCategory, LnCategoryMetadata,
    BookStats, TocItem, BlockIndexMap
};

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
