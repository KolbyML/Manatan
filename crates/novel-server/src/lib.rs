use std::path::{Path, PathBuf};

use axum::{Router, extract::DefaultBodyLimit};
use tower_http::cors::{Any, CorsLayer};

pub mod error;
pub mod routes;
pub mod state;
pub mod types;

use axum::http::header::{CACHE_CONTROL, HeaderValue};
pub use state::NovelState;
use std::collections::HashMap;
use std::fs;
use tower::ServiceBuilder;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing::{info, warn};
use walkdir::WalkDir;

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

    let metadata_root = state.get_novel_metadata_root();
    if let Err(err) = fs::create_dir_all(&metadata_root) {
        warn!(
            "Failed to create local novel metadata directory {}: {err}",
            metadata_root.display()
        );
    }
    let cache_layer = SetResponseHeaderLayer::if_not_present(
        CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    let static_service = ServiceBuilder::new()
        .layer(cache_layer)
        .service(ServeDir::new(metadata_root));

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

    migrate_legacy_local_novel_layout(state)?;

    let metadata_root = state.get_novel_metadata_root();
    fs::create_dir_all(&metadata_root)?;

    for entry in WalkDir::new(&metadata_root)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        // Look for metadata.json files in subdirectories
        if path.is_file() && path.file_name().map_or(false, |n| n == "metadata.json") {
            let Some(parent) = path.parent() else {
                continue;
            };
            let Some(file_name) = parent.file_name() else {
                continue;
            };
            let id = file_name.to_string_lossy().to_string();

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
                    if let Ok(cats) = serde_json::from_value::<Vec<LnCategory>>(categories.clone())
                    {
                        for cat in cats {
                            let _ = state.db.insert(
                                format!("category:{}", cat.id),
                                serde_json::to_vec(&cat).unwrap_or_default(),
                            );
                        }
                    }
                }
                if let Some(metadata) = sidecar_data.get("metadata") {
                    if let Ok(meta_map) = serde_json::from_value::<
                        HashMap<String, LnCategoryMetadata>,
                    >(metadata.clone())
                    {
                        for (id, meta) in meta_map {
                            let _ = state.db.insert(
                                format!("category_metadata:{}", id),
                                serde_json::to_vec(&meta).unwrap_or_default(),
                            );
                        }
                    }
                }
            }
        }
    }

    state.db.flush()?;
    Ok(())
}

fn dir_has_legacy_novel_data(path: &Path, id: &str) -> bool {
    path.join("metadata.json").exists()
        || path.join("extracted").exists()
        || path.join(format!("{id}.epub")).exists()
}

fn migrate_legacy_local_novel_layout(state: &NovelState) -> anyhow::Result<()> {
    let local_path = state.get_local_novel_path();
    let metadata_root = state.get_novel_metadata_root();
    fs::create_dir_all(&metadata_root)?;

    for entry in fs::read_dir(&local_path)? {
        let entry = match entry {
            Ok(value) => value,
            Err(err) => {
                warn!(
                    "Skipping unreadable local-novel entry in {}: {err}",
                    local_path.display()
                );
                continue;
            }
        };
        let path = entry.path();
        if !path.is_dir() || path == metadata_root {
            continue;
        }

        let id = entry.file_name().to_string_lossy().to_string();
        if !dir_has_legacy_novel_data(&path, &id) {
            continue;
        }

        let target_dir = metadata_root.join(&id);
        if !target_dir.exists() {
            fs::rename(&path, &target_dir)?;
            info!(
                "Migrated legacy novel metadata folder {} -> {}",
                path.display(),
                target_dir.display()
            );
        } else {
            // Best-effort merge when both folders exist.
            let legacy_metadata = path.join("metadata.json");
            let target_metadata = target_dir.join("metadata.json");
            if legacy_metadata.exists() && !target_metadata.exists() {
                fs::rename(&legacy_metadata, &target_metadata)?;
            }

            let legacy_extracted = path.join("extracted");
            let target_extracted = target_dir.join("extracted");
            if legacy_extracted.exists() && !target_extracted.exists() {
                fs::rename(&legacy_extracted, &target_extracted)?;
            }
        }

        let epub_in_metadata_dir = target_dir.join(format!("{id}.epub"));
        let root_epub = local_path.join(format!("{id}.epub"));
        if epub_in_metadata_dir.exists() && !root_epub.exists() {
            fs::rename(&epub_in_metadata_dir, &root_epub)?;
            info!(
                "Moved legacy EPUB {} -> {}",
                epub_in_metadata_dir.display(),
                root_epub.display()
            );
        }

        if path.exists() {
            let is_empty = fs::read_dir(&path)?.next().is_none();
            if is_empty {
                let _ = fs::remove_dir(&path);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("manatan-novel-server-{label}-{nanos}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir should be created");
        dir
    }

    #[test]
    fn migrates_legacy_folder_layout_to_hidden_metadata_directory() {
        let root = unique_temp_dir("legacy-migration");
        let data_dir = root.join("data");
        let local_novel_dir = root.join("local-novel");
        fs::create_dir_all(&local_novel_dir).expect("local-novel should be created");

        let id = "novel_123";
        let legacy_dir = local_novel_dir.join(id);
        fs::create_dir_all(legacy_dir.join("extracted")).expect("legacy dir should be created");
        fs::write(
            legacy_dir.join("metadata.json"),
            r#"{"metadata":{"id":"novel_123"}}"#,
        )
        .expect("metadata should be written");
        fs::write(legacy_dir.join(format!("{id}.epub")), b"epub-bytes")
            .expect("epub should be written");

        let state = NovelState::new(data_dir, local_novel_dir.clone());
        migrate_legacy_local_novel_layout(&state).expect("migration should succeed");

        let metadata_root = state.get_novel_metadata_root();
        assert!(metadata_root.join(id).join("metadata.json").exists());
        assert!(metadata_root.join(id).join("extracted").exists());
        assert!(local_novel_dir.join(format!("{id}.epub")).exists());
    }
}
