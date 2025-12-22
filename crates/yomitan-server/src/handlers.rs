use crate::{ServerState, import};
use axum::{
    Json,
    extract::{Multipart, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use serde_json::{Value, json};
use tracing::{error, info};
use wordbase_api::{DictionaryId, Record, RecordEntry, Term};

#[derive(Deserialize)]
pub struct LookupParams {
    pub text: String,
    pub index: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiForm {
    pub headword: String,
    pub reading: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDefinition {
    pub dictionary_name: String,
    pub tags: Vec<String>,
    pub content: JsonValue,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiGroupedResult {
    pub headword: String,
    pub reading: String,
    pub furigana: Vec<(String, String)>,
    pub definitions: Vec<ApiDefinition>,
    pub forms: Vec<ApiForm>,
}

pub async fn lookup_handler(
    State(state): State<ServerState>,
    Query(params): Query<LookupParams>,
) -> Result<Json<Vec<ApiGroupedResult>>, (StatusCode, Json<Value>)> {
    let cursor_idx = params.index.unwrap_or(0);

    if state.app.is_loading() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "loading", "message": "Dictionaries are importing..." })),
        ));
    }

    let dict_names: std::collections::HashMap<DictionaryId, String> = {
        let db = state.app.inner.read().expect("lock");
        if db.dictionaries.is_empty() {
            return Ok(Json(vec![]));
        }
        db.dictionaries
            .iter()
            .map(|(k, v)| (*k, v.meta.name.clone()))
            .collect()
    };

    let raw_results = state.lookup.search(&state.app, &params.text, cursor_idx);

    struct Aggregator {
        headword: String,
        reading: String,
        furigana: Vec<(String, String)>,
        definitions: Vec<ApiDefinition>,
        forms_set: Vec<(String, String)>,
    }

    let mut map: Vec<Aggregator> = Vec::new();

    for entry in raw_results {
        // --- FIX: Handle Term::Reading correctly ---
        // If the term is ONLY a reading (e.g. kana match), use the reading as the headword
        // so we don't produce an empty headword that gets skipped.
        let (headword, reading) = match &entry.term {
            Term::Full(h, r) => (h.to_string(), r.to_string()),
            Term::Headword(h) => (h.to_string(), "".to_string()),
            Term::Reading(r) => (r.to_string(), "".to_string()),
        };

        if headword.is_empty() {
            continue;
        }

        let (content_val, tags) = if let Record::YomitanGlossary(gloss) = &entry.record {
            let t = gloss
                .tags
                .iter()
                .filter_map(|t| {
                    serde_json::to_value(t).ok().and_then(|v| {
                        if let Some(s) = v.as_str() {
                            Some(s.to_string())
                        } else {
                            v.get("name")
                                .or(v.get("category"))
                                .and_then(|n| n.as_str())
                                .map(|s| s.to_string())
                        }
                    })
                })
                .collect();
            (json!(gloss.content), t)
        } else {
            (json!(entry.record), vec![])
        };

        let dict_name = dict_names
            .get(&entry.source)
            .cloned()
            .unwrap_or("Unknown".to_string());

        let def_obj = ApiDefinition {
            dictionary_name: dict_name,
            tags,
            content: content_val,
        };

        if let Some(existing) = map
            .iter_mut()
            .find(|agg| agg.headword == headword && agg.reading == reading)
        {
            let is_duplicate_def = existing.definitions.iter().any(|d| {
                d.dictionary_name == def_obj.dictionary_name
                    && d.content.to_string() == def_obj.content.to_string()
            });

            if !is_duplicate_def {
                existing.definitions.push(def_obj);
            }
        } else {
            map.push(Aggregator {
                headword: headword.clone(),
                reading: reading.clone(),
                furigana: calculate_furigana(&headword, &reading),
                definitions: vec![def_obj],
                forms_set: vec![(headword.clone(), reading.clone())],
            });
        }
    }

    let final_results: Vec<ApiGroupedResult> = map
        .into_iter()
        .map(|agg| {
            let mut forms_vec = Vec::new();
            for (h, r) in agg.forms_set {
                forms_vec.push(ApiForm {
                    headword: h,
                    reading: r,
                });
            }

            ApiGroupedResult {
                headword: agg.headword,
                reading: agg.reading,
                furigana: agg.furigana,
                definitions: agg.definitions,
                forms: forms_vec,
            }
        })
        .collect();

    info!(
        "✅ [Lookup API] Sending {} grouped results",
        final_results.len()
    );

    Ok(Json(final_results))
}

fn calculate_furigana(headword: &str, reading: &str) -> Vec<(String, String)> {
    if reading.is_empty() || headword == reading {
        return vec![(headword.to_string(), String::new())];
    }
    let h_chars: Vec<char> = headword.chars().collect();
    let r_chars: Vec<char> = reading.chars().collect();
    let mut h_start = 0;
    let mut h_end = h_chars.len();
    let mut r_start = 0;
    let mut r_end = r_chars.len();
    while h_start < h_end && r_start < r_end && h_chars[h_start] == r_chars[r_start] {
        h_start += 1;
        r_start += 1;
    }
    while h_end > h_start && r_end > r_start && h_chars[h_end - 1] == r_chars[r_end - 1] {
        h_end -= 1;
        r_end -= 1;
    }
    let mut parts = Vec::new();
    if h_start > 0 {
        let prefix: String = h_chars[0..h_start].iter().collect();
        parts.push((prefix, String::new()));
    }
    if h_start < h_end {
        let root_base: String = h_chars[h_start..h_end].iter().collect();
        let root_ruby: String = r_chars[r_start..r_end].iter().collect();
        parts.push((root_base, root_ruby));
    }
    if h_end < h_chars.len() {
        let suffix: String = h_chars[h_end..].iter().collect();
        parts.push((suffix, String::new()));
    }
    parts
}

pub async fn list_dictionaries_handler(State(state): State<ServerState>) -> Json<Value> {
    let db = state.app.inner.read().expect("lock");
    let dicts: Vec<_> = db.dictionaries.values().cloned().collect();
    let term_count = db.index.len();
    Json(
        json!({ "dictionaries": dicts, "total_terms": term_count, "status": if state.app.is_loading() { "loading" } else { "ready" } }),
    )
}

pub async fn import_handler(
    State(state): State<ServerState>,
    mut multipart: Multipart,
) -> Json<Value> {
    while let Some(field) = multipart.next_field().await.unwrap() {
        if field.name() == Some("file") {
            if let Ok(data) = field.bytes().await {
                info!("📥 [Import API] Received upload ({} bytes)", data.len());
                let app_state = state.app.clone();
                let res =
                    tokio::task::spawn_blocking(move || import::import_zip(&app_state, &data))
                        .await
                        .unwrap();
                return match res {
                    Ok(msg) => {
                        info!("✅ {}", msg);
                        Json(json!({ "status": "ok", "message": msg }))
                    }
                    Err(e) => {
                        error!("❌ {}", e);
                        Json(json!({ "status": "error", "message": e.to_string() }))
                    }
                };
            }
        }
    }
    Json(json!({ "status": "error", "message": "No file field found" }))
}
