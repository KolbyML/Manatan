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
use serde_json::{Value, json};
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
    pub suwayomi_user: Option<String>,
    pub suwayomi_pass: Option<String>,
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
    // 1. Determine which fields to update logic
    // We treat None or Empty String ("") as "Do not update"
    let target_sentence_field = payload.sentence_field.filter(|f| !f.is_empty());
    let target_image_field = payload.image_field.filter(|f| !f.is_empty());

    // If both are empty, there is nothing to do
    if target_sentence_field.is_none() && target_image_field.is_none() {
        return (
            StatusCode::BAD_REQUEST,
            "No fields specified to update (sentence_field or image_field required)",
        )
            .into_response();
    }

    // 2. Find the Last Added Card (Note ID is the creation timestamp)
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
            let json: Value = resp.json().await.unwrap_or_default();
            // Get the last ID from the array (Anki returns sorted array)
            match json["result"].as_array().and_then(|arr| arr.last()) {
                Some(id) => id.as_i64(),
                None => {
                    return (StatusCode::NOT_FOUND, "No cards added today found").into_response();
                }
            }
        }
        Err(_) => {
            return (StatusCode::BAD_GATEWAY, "AnkiConnect unreachable").into_response();
        }
    };

    let Some(id) = note_id else {
        return (StatusCode::NOT_FOUND, "Invalid Note ID").into_response();
    };

    // 3. Check if the card was created within the last 5 minutes
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let age_ms = now_ms - id;
    let age_min = age_ms / 60_000; // Integer division

    if age_min >= 5 {
        return (
            StatusCode::BAD_REQUEST,
            format!("Latest note is {} min old (max 5 min allowed)", age_min),
        )
            .into_response();
    }

    // 4. Prepare update payloads
    let mut fields_map = serde_json::Map::new();
    let mut picture_data = Vec::new();

    // Only fetch and process image if image_field is present and valid
    if let Some(img_field) = target_image_field {
        fields_map.insert(img_field.clone(), Value::String(String::new()));

        let suwayomi_url = format!("http://127.0.0.1:4567{}", payload.image_path);

        // Construct the request builder
        let mut request = state.client.get(&suwayomi_url);

        // Apply authentication if a username is provided (similar to the ocr code)
        if let Some(username) = payload.suwayomi_user {
            request = request.basic_auth(username, payload.suwayomi_pass);
        }

        let image_bytes = match request.send().await {
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

        let b64_image = general_purpose::STANDARD.encode(&image_bytes);
        let filename = format!("mangatan_{}.jpg", now_ms);

        picture_data.push(json!({
            "url": "https://placeholder.invalid",
            "data": b64_image,
            "filename": filename,
            "fields": [ img_field ]
        }));
    }

    if let Some(sent_field) = target_sentence_field {
        fields_map.insert(sent_field, Value::String(payload.sentence));
    }

    // 5. Update the Note in Anki
    let update_payload = json!({
        "action": "updateNoteFields",
        "version": 6,
        "params": {
            "note": {
                "id": id,
                "fields": fields_map,
                "picture": picture_data
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
            // Check HTTP status and JSON "error" field
            if resp.status().is_success() {
                let body: Value = resp
                    .json()
                    .await
                    .unwrap_or(json!({ "error": "Invalid JSON" }));

                if body["error"].is_null() {
                    (StatusCode::OK, "Last card updated!").into_response()
                } else {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("AnkiConnect Error: {}", body["error"]),
                    )
                        .into_response()
                }
            } else {
                (StatusCode::BAD_GATEWAY, "AnkiConnect HTTP Error").into_response()
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to update Anki: {e}"),
        )
            .into_response(),
    }
}
