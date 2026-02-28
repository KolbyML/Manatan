use std::path::PathBuf;
use axum::{Router, extract::DefaultBodyLimit};
use tower_http::cors::{Any, CorsLayer};

pub mod error;
pub mod routes;
pub mod state;
pub mod types;

pub use state::NovelState;
use tower::ServiceBuilder;
use std::fs;
use std::collections::HashMap;
use axum::http::header::{CACHE_CONTROL, HeaderValue};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use walkdir::WalkDir;
use tracing::{info, warn};
use crate::types::*;

pub fn create_router(data_dir: PathBuf, local_novel_path: PathBuf) -> Router {
    let state = NovelState::new(data_dir, local_novel_path);

    let state_clone = state.clone();
    tokio::spawn(async move {
        if let Err(e) = scan_local_novel(&state_clone) {
            warn!("Failed to scan local-novel: {:?}", e);
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let local_novel_path_clone = state.get_local_novel_path();
    let cache_layer = SetResponseHeaderLayer::if_not_present(
        CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    let static_service = ServiceBuilder::new()
        .layer(cache_layer)
        .service(ServeDir::new(local_novel_path_clone));

    routes::router()
        .nest_service("/static", static_service)
        .layer(cors)
        .layer(DefaultBodyLimit::max(250 * 1024 * 1024))
        .with_state(state)
}

fn scan_local_novel(state: &NovelState) -> anyhow::Result<()> {
    let local_path = state.get_local_novel_path();

    if !local_path.exists() {
        return Ok(());
    }

    info!("Scanning local-novel for novels: {}", local_path.display());

    for entry in WalkDir::new(&local_path)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        // Look for metadata.json files in subdirectories
        if path.is_file() && path.file_name().map_or(false, |n| n == "metadata.json") {
            let parent = path.parent().unwrap();
            let id = parent.file_name().unwrap().to_string_lossy().to_string();

            info!("Found novel directory: {}", id);

            let content = fs::read_to_string(path)?;
            let sidecar_data: serde_json::Value = serde_json::from_str(&content)?;

            if let Some(metadata) = sidecar_data.get("metadata") {
                let meta: LNMetadata = serde_json::from_value(metadata.clone())?;
                let bytes = serde_json::to_vec(&meta)?;
                state.db.insert(format!("metadata:{}", id), bytes)?;
            }

            if let Some(progress) = sidecar_data.get("progress") {
                let prog: LNProgress = serde_json::from_value(progress.clone())?;
                let bytes = serde_json::to_vec(&prog)?;
                state.db.insert(format!("progress:{}", id), bytes)?;
            }

            if let Some(content) = sidecar_data.get("content") {
                let parsed: LNParsedBook = serde_json::from_value(content.clone())?;
                let bytes = serde_json::to_vec(&parsed)?;
                state.db.insert(format!("content:{}", id), bytes)?;
            }
        }
    }

    // Scan global categories in root
    let categories_path = local_path.join("categories.json");
    if categories_path.exists() {
        if let Ok(content) = fs::read_to_string(&categories_path) {
            if let Ok(sidecar_data) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(categories) = sidecar_data.get("categories") {
                    if let Ok(cats) = serde_json::from_value::<Vec<LnCategory>>(categories.clone()) {
                        for cat in cats {
                            let _ = state.db.insert(format!("category:{}", cat.id), serde_json::to_vec(&cat).unwrap_or_default());
                        }
                    }
                }
                if let Some(metadata) = sidecar_data.get("metadata") {
                    if let Ok(meta_map) = serde_json::from_value::<HashMap<String, LnCategoryMetadata>>(metadata.clone()) {
                        for (id, meta) in meta_map {
                            let _ = state.db.insert(format!("category_metadata:{}", id), serde_json::to_vec(&meta).unwrap_or_default());
                        }
                    }
                }
            }
        }
    }

    state.db.flush()?;
    Ok(())
}
