use std::collections::HashMap;
use axum::{
    Router,
    routing::{get, post, delete},
    extract::{State, Path, Multipart},
    Json,
};
use crate::state::LnState;
use crate::types::*;
use std::fs;
use crate::error::LnError;

pub fn router() -> Router<LnState> {
    Router::new()
        .route("/metadata", get(get_all_metadata))
        .route("/metadata/{id}", get(get_metadata))
        .route("/metadata/{id}", post(update_metadata))
        .route("/metadata/{id}", delete(delete_book))
        .route("/content/{id}", get(get_content))
        .route("/content/{id}", post(save_content))
        .route("/progress/{id}", get(get_progress))
        .route("/progress/{id}", post(update_progress))
        .route("/categories", get(get_categories))
        .route("/categories", post(create_category))
        .route("/categories/{id}", post(update_category))
        .route("/categories/{id}", delete(delete_category))
        .route("/categories/metadata", get(get_all_category_metadata))
        .route("/categories/metadata/{id}", get(get_category_metadata))
        .route("/categories/metadata/{id}", post(update_category_metadata))
        .route("/upload/{id}", post(upload_epub))
        .route("/file/{id}", get(get_epub))
}

async fn get_all_metadata(State(state): State<LnState>) -> Result<Json<Vec<LNMetadata>>, LnError> {
    let mut all_metadata = Vec::new();
    for item in state.db.scan_prefix("metadata:") {
        let (_, v) = item?;
        let metadata: LNMetadata = serde_json::from_slice(&v)?;
        all_metadata.push(metadata);
    }
    all_metadata.sort_by(|a, b| b.added_at.cmp(&a.added_at));
    Ok(Json(all_metadata))
}

async fn get_metadata(State(state): State<LnState>, Path(id): Path<String>) -> Result<Json<LNMetadata>, LnError> {
    let key = format!("metadata:{}", id);
    let v = state.db.get(key)?.ok_or(LnError::NotFound)?;
    let metadata: LNMetadata = serde_json::from_slice(&v)?;
    Ok(Json(metadata))
}

async fn update_metadata(State(state): State<LnState>, Path(id): Path<String>, Json(req): Json<UpdateMetadataRequest>) -> Result<(), LnError> {
    let key = format!("metadata:{}", id);
    let bytes = serde_json::to_vec(&req.metadata)?;
    state.db.insert(key, bytes)?;

    // Sidecar save
    let novel_dir = state.get_novel_dir(&id);
    fs::create_dir_all(&novel_dir)?;
    let sidecar_path = novel_dir.join("metadata.json");

    let mut sidecar_data = if sidecar_path.exists() {
        let content = fs::read_to_string(&sidecar_path)?;
        serde_json::from_str::<serde_json::Value>(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    sidecar_data["metadata"] = serde_json::to_value(&req.metadata)?;
    fs::write(sidecar_path, serde_json::to_string_pretty(&sidecar_data)?)?;

    state.db.flush()?;
    Ok(())
}

async fn delete_book(State(state): State<LnState>, Path(id): Path<String>) -> Result<(), LnError> {
    state.db.remove(format!("metadata:{}", id))?;
    state.db.remove(format!("progress:{}", id))?;
    state.db.remove(format!("content:{}", id))?;

    let novel_dir = state.get_novel_dir(&id);
    if novel_dir.exists() {
        fs::remove_dir_all(novel_dir)?;
    }

    state.db.flush()?;
    Ok(())
}

async fn get_content(State(state): State<LnState>, Path(id): Path<String>) -> Result<Json<LNParsedBook>, LnError> {
    let key = format!("content:{}", id);
    let v = state.db.get(key)?.ok_or(LnError::NotFound)?;
    let mut content: LNParsedBook = serde_json::from_slice(&v)?;

    // Optimization: Don't send large image blobs over the wire, use static serving instead
    content.image_blobs = HashMap::new();

    Ok(Json(content))
}

async fn save_content(State(state): State<LnState>, Path(id): Path<String>, Json(content): Json<LNParsedBook>) -> Result<(), LnError> {
    let key = format!("content:{}", id);

    // Save to DB for sync compatibility
    let bytes = serde_json::to_vec(&content)?;
    state.db.insert(key, bytes)?;

    // Novel directory structure
    let novel_dir = state.get_novel_dir(&id);
    fs::create_dir_all(&novel_dir)?;

    // Sidecar save for portability
    let sidecar_path = novel_dir.join("metadata.json");
    let mut sidecar_data = if sidecar_path.exists() {
        let content = fs::read_to_string(&sidecar_path)?;
        serde_json::from_str::<serde_json::Value>(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    sidecar_data["content"] = serde_json::to_value(&content)?;
    fs::write(sidecar_path, serde_json::to_string_pretty(&sidecar_data)?)?;

    // Static extraction for speed
    let extracted_dir = novel_dir.join("extracted");
    if extracted_dir.exists() {
        fs::remove_dir_all(&extracted_dir)?;
    }
    fs::create_dir_all(&extracted_dir)?;

    // Save images as files
    let img_dir = extracted_dir.join("images");
    fs::create_dir_all(&img_dir)?;
    for (path, base64) in content.image_blobs {
        let data = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &base64)
            .map_err(|e| LnError::BadRequest(format!("Invalid base64 image: {}", e)))?;

        let normalized_path = if path.starts_with('/') { &path[1..] } else { &path };
        let img_path = img_dir.join(normalized_path);
        if let Some(parent) = img_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(img_path, data)?;
    }

    // Save chapters as HTML files
    let chapter_dir = extracted_dir.join("chapters");
    fs::create_dir_all(&chapter_dir)?;
    for (i, html) in content.chapters.iter().enumerate() {
        let chapter_path = chapter_dir.join(format!("{}.html", i));
        fs::write(chapter_path, html)?;
    }

    state.db.flush()?;
    Ok(())
}

async fn get_progress(State(state): State<LnState>, Path(id): Path<String>) -> Result<Json<Option<LNProgress>>, LnError> {
    let key = format!("progress:{}", id);
    let v = state.db.get(key)?;
    if let Some(bytes) = v {
        let progress: LNProgress = serde_json::from_slice(&bytes)?;
        Ok(Json(Some(progress)))
    } else {
        Ok(Json(None))
    }
}

async fn update_progress(State(state): State<LnState>, Path(id): Path<String>, Json(req): Json<UpdateProgressRequest>) -> Result<(), LnError> {
    let key = format!("progress:{}", id);
    let bytes = serde_json::to_vec(&req.progress)?;
    state.db.insert(key, bytes)?;

    // Sidecar save
    let novel_dir = state.get_novel_dir(&id);
    fs::create_dir_all(&novel_dir)?;
    let sidecar_path = novel_dir.join("metadata.json");

    let mut sidecar_data = if sidecar_path.exists() {
        let content = fs::read_to_string(&sidecar_path)?;
        serde_json::from_str::<serde_json::Value>(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    sidecar_data["progress"] = serde_json::to_value(&req.progress)?;
    fs::write(sidecar_path, serde_json::to_string_pretty(&sidecar_data)?)?;

    state.db.flush()?;
    Ok(())
}

async fn get_categories(State(state): State<LnState>) -> Result<Json<Vec<LnCategory>>, LnError> {
    let mut categories = Vec::new();
    for item in state.db.scan_prefix("category:") {
        let (_, v) = item?;
        let category: LnCategory = serde_json::from_slice(&v)?;
        categories.push(category);
    }
    categories.sort_by(|a, b| a.order.cmp(&b.order));
    Ok(Json(categories))
}

async fn save_global_categories(state: &LnState) -> Result<(), LnError> {
    let mut categories = Vec::new();
    for item in state.db.scan_prefix("category:") {
        let (_, v) = item?;
        let category: LnCategory = serde_json::from_slice(&v)?;
        categories.push(category);
    }

    let mut meta_map = HashMap::new();
    for item in state.db.scan_prefix("category_metadata:") {
        let (k, v) = item?;
        let key_str = String::from_utf8_lossy(&k);
        let id = key_str.strip_prefix("category_metadata:").unwrap_or(&key_str).to_string();
        let meta: LnCategoryMetadata = serde_json::from_slice(&v)?;
        meta_map.insert(id, meta);
    }

    let local_path = state.get_local_ln_path();
    fs::create_dir_all(&local_path)?;
    let sidecar_path = local_path.join("categories.json");

    let sidecar_data = serde_json::json!({
        "categories": categories,
        "metadata": meta_map,
    });

    fs::write(sidecar_path, serde_json::to_string_pretty(&sidecar_data)?)?;
    Ok(())
}

async fn create_category(State(state): State<LnState>, Json(category): Json<LnCategory>) -> Result<Json<LnCategory>, LnError> {
    let key = format!("category:{}", category.id);
    let bytes = serde_json::to_vec(&category)?;
    state.db.insert(key, bytes)?;
    save_global_categories(&state).await?;
    state.db.flush()?;
    Ok(Json(category))
}

async fn update_category(State(state): State<LnState>, Path(id): Path<String>, Json(category): Json<LnCategory>) -> Result<(), LnError> {
    let key = format!("category:{}", id);
    let bytes = serde_json::to_vec(&category)?;
    state.db.insert(key, bytes)?;
    save_global_categories(&state).await?;
    state.db.flush()?;
    Ok(())
}

async fn delete_category(State(state): State<LnState>, Path(id): Path<String>) -> Result<(), LnError> {
    state.db.remove(format!("category:{}", id))?;
    state.db.remove(format!("category_metadata:{}", id))?;

    // Remove category from all books
    for item in state.db.scan_prefix("metadata:") {
        let (k, v) = item?;
        let mut metadata: LNMetadata = serde_json::from_slice(&v)?;
        if metadata.category_ids.contains(&id) {
            metadata.category_ids.retain(|cid| cid != &id);
            state.db.insert(k, serde_json::to_vec(&metadata)?)?;
        }
    }

    save_global_categories(&state).await?;
    state.db.flush()?;
    Ok(())
}

async fn get_all_category_metadata(State(state): State<LnState>) -> Result<Json<HashMap<String, LnCategoryMetadata>>, LnError> {
    let mut map = HashMap::new();
    for item in state.db.scan_prefix("category_metadata:") {
        let (k, v) = item?;
        let key_str = String::from_utf8_lossy(&k);
        let id = key_str.strip_prefix("category_metadata:").unwrap_or(&key_str).to_string();
        let meta: LnCategoryMetadata = serde_json::from_slice(&v)?;
        map.insert(id, meta);
    }
    Ok(Json(map))
}

async fn get_category_metadata(State(state): State<LnState>, Path(id): Path<String>) -> Result<Json<Option<LnCategoryMetadata>>, LnError> {
    let key = format!("category_metadata:{}", id);
    let v = state.db.get(key)?;
    if let Some(bytes) = v {
        let meta: LnCategoryMetadata = serde_json::from_slice(&bytes)?;
        Ok(Json(Some(meta)))
    } else {
        Ok(Json(None))
    }
}

async fn update_category_metadata(State(state): State<LnState>, Path(id): Path<String>, Json(meta): Json<LnCategoryMetadata>) -> Result<(), LnError> {
    let key = format!("category_metadata:{}", id);
    let bytes = serde_json::to_vec(&meta)?;
    state.db.insert(key, bytes)?;
    save_global_categories(&state).await?;
    state.db.flush()?;
    Ok(())
}

async fn upload_epub(State(state): State<LnState>, Path(id): Path<String>, mut multipart: Multipart) -> Result<(), LnError> {
    while let Some(field) = multipart.next_field().await? {
        if let Some(name) = field.name() {
            if name == "file" {
                let data = field.bytes().await?;
                let novel_dir = state.get_novel_dir(&id);
                fs::create_dir_all(&novel_dir)?;
                let path = novel_dir.join(format!("{}.epub", id));
                fs::write(path, data)?;
                return Ok(());
            }
        }
    }
    Err(LnError::BadRequest("No file field found".into()))
}

async fn get_epub(State(state): State<LnState>, Path(id): Path<String>) -> Result<Vec<u8>, LnError> {
    let path = state.get_novel_dir(&id).join(format!("{}.epub", id));
    if !path.exists() {
        return Err(LnError::NotFound);
    }
    Ok(fs::read(path)?)
}
