use axum::{
    Router,
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
};
use base64::{Engine as _, engine::general_purpose};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct AnkiState {
    pub client: Client,
}

#[derive(Deserialize)]
pub struct UpdateCardRequest {
    pub image_path: String, // Path in Suwayomi, e.g. /api/v1/books/...
    pub sentence: String,   // Text from the textbox
    pub sentence_field: Option<String>,
    pub image_field: Option<String>,
}

pub fn create_router() -> Router {
    let state = AnkiState {
        client: Client::new(),
    };
    Router::new()
        .route("/update-last-card", post(update_last_card_handler))
        .with_state(state)
}

async fn update_last_card_handler(
    State(state): State<AnkiState>,
    Json(payload): Json<UpdateCardRequest>,
) -> impl IntoResponse {
    // 1. Fetch Image from Suwayomi (Localhost:4567)
    // We assume Suwayomi is always on 4567 based on main.rs
    let suwayomi_url = format!("http://127.0.0.1:4567{}", payload.image_path);

    let image_bytes = match state.client.get(&suwayomi_url).send().await {
        Ok(resp) => match resp.bytes().await {
            Ok(b) => b,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to read bytes: {e}"),
                )
                    .into_response();
            }
        },
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                format!("Suwayomi unreachable: {e}"),
            )
                .into_response();
        }
    };

    // 2. Convert to Base64
    let b64_image = general_purpose::STANDARD.encode(&image_bytes);
    let filename = format!("mangatan_{}.jpg", chrono::Utc::now().timestamp_millis());

    // 3. Find the Last Added Card (Mokuro Logic)
    let anki_base = "http://127.0.0.1:8765";

    let find_payload = json!({
        "action": "findNotes",
        "version": 6,
        "params": { "query": "added:1" }
    });

    let note_id = match state
        .client
        .post(anki_base)
        .json(&find_payload)
        .send()
        .await
    {
        Ok(resp) => {
            let json: serde_json::Value = resp.json().await.unwrap_or_default();
            // Get the last ID from the array (Anki returns sorted array usually)
            match json["result"].as_array().and_then(|arr| arr.last()) {
                Some(id) => id.as_i64(),
                None => {
                    return (StatusCode::NOT_FOUND, "No cards added today found").into_response();
                }
            }
        }
        Err(_) => {
            return (StatusCode::SERVICE_UNAVAILABLE, "AnkiConnect unreachable").into_response();
        }
    };

    let Some(id) = note_id else {
        return (StatusCode::NOT_FOUND, "Invalid Note ID").into_response();
    };

    // 4. Update the Note
    let sent_field = payload.sentence_field.unwrap_or_else(|| "Sentence".to_string());
    let img_field = payload.image_field.unwrap_or_else(|| "Image".to_string());

    let update_payload = json!({
        "action": "updateNoteFields",
        "version": 6,
        "params": {
            "note": {
                "id": id,
                "fields": {
                    // DYNAMICALLY USE USER FIELD NAME
                    sent_field: payload.sentence, 
                },
                "picture": [{
                    "url": "https://placeholder.invalid",
                    "data": b64_image,
                    "filename": filename,
                    // DYNAMICALLY USE USER FIELD NAME
                    "fields": [ img_field ] 
                }]
            }
        }
    });

    match state
        .client
        .post(anki_base)
        .json(&update_payload)
        .send()
        .await
    {
        Ok(resp) => {
            if resp.status().is_success() {
                (StatusCode::OK, "Last card updated!").into_response()
            } else {
                (StatusCode::BAD_REQUEST, "Anki rejected update").into_response()
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to update Anki: {e}"),
        )
            .into_response(),
    }
}
