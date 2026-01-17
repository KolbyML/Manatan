use axum::{
    Json,
    extract::{Multipart, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, Value as JsonValue, json};
use tracing::{error, info};
use wordbase_api::{DictionaryId, Record, Term};

use crate::{PREBAKED_DICT, ServerState, import};

#[derive(Deserialize)]
pub struct LookupParams {
    pub text: String,
    pub index: Option<usize>,
    // Optional toggle for grouping results (defaults to true in handler)
    pub group: Option<bool>,
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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiFrequency {
    pub dictionary_name: String,
    pub value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiGroupedResult {
    pub headword: String,
    pub reading: String,
    pub furigana: Vec<(String, String)>,
    pub definitions: Vec<ApiDefinition>,
    pub frequencies: Vec<ApiFrequency>,
    pub forms: Vec<ApiForm>,
    // ADDED: Return the length of the match so the frontend can highlight it
    pub match_len: usize,
}

#[derive(Deserialize)]
#[serde(tag = "action", content = "payload")]
pub enum DictionaryAction {
    Toggle { id: i64, enabled: bool },
    Delete { id: i64 },
    Reorder { order: Vec<i64> },
}

pub async fn manage_dictionaries_handler(
    State(state): State<ServerState>,
    Json(action): Json<DictionaryAction>,
) -> Json<Value> {
    let app_state = state.app.clone();

    let res = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let mut conn = app_state.pool.get().map_err(|e| e.to_string())?;
        let mut should_vacuum = false;

        {
            let tx = conn.transaction().map_err(|e| e.to_string())?;

            match action {
                DictionaryAction::Toggle { id, enabled } => {
                    tx.execute(
                        "UPDATE dictionaries SET enabled = ? WHERE id = ?",
                        rusqlite::params![enabled, id],
                    )
                    .map_err(|e| e.to_string())?;

                    let mut dicts = app_state.dictionaries.write().expect("lock");
                    if let Some(d) = dicts.get_mut(&DictionaryId(id)) {
                        d.enabled = enabled;
                    }
                }
                DictionaryAction::Delete { id } => {
                    info!("🗑️ [Yomitan] Deleting dictionary {}...", id);
                    tx.execute(
                        "DELETE FROM terms WHERE dictionary_id = ?",
                        rusqlite::params![id],
                    )
                    .map_err(|e| e.to_string())?;
                    tx.execute(
                        "DELETE FROM dictionaries WHERE id = ?",
                        rusqlite::params![id],
                    )
                    .map_err(|e| e.to_string())?;

                    let mut dicts = app_state.dictionaries.write().expect("lock");
                    dicts.remove(&DictionaryId(id));
                    should_vacuum = true;
                }
                DictionaryAction::Reorder { order } => {
                    let mut stmt = tx
                        .prepare("UPDATE dictionaries SET priority = ? WHERE id = ?")
                        .map_err(|e| e.to_string())?;
                    let mut dicts = app_state.dictionaries.write().expect("lock");

                    for (index, id) in order.iter().enumerate() {
                        let priority = index as i64;
                        stmt.execute(rusqlite::params![priority, id])
                            .map_err(|e| e.to_string())?;

                        if let Some(d) = dicts.get_mut(&DictionaryId(*id)) {
                            d.priority = priority;
                        }
                    }
                }
            }

            tx.commit().map_err(|e| e.to_string())?;
        }

        if should_vacuum {
            info!("🧹 [Yomitan] Vacuuming database to reclaim disk space...");
            conn.execute("VACUUM", []).map_err(|e| e.to_string())?;
            info!("✨ [Yomitan] Vacuum complete.");
        }

        Ok(())
    })
    .await
    .unwrap();

    match res {
        Ok(_) => Json(json!({ "status": "ok" })),
        Err(e) => Json(json!({ "status": "error", "message": e })),
    }
}

pub async fn install_defaults_handler(State(state): State<ServerState>) -> Json<Value> {
    let app_state = state.app.clone();

    {
        let dicts = app_state.dictionaries.read().expect("lock");
        if !dicts.is_empty() {
            return Json(json!({ "status": "ok", "message": "Dictionaries already exist." }));
        }
    }

    info!("📥 [Yomitan] User requested default dictionary installation...");
    app_state.set_loading(true);

    let app_state_for_task = app_state.clone();

    let res =
        tokio::task::spawn_blocking(move || import::import_zip(&app_state_for_task, PREBAKED_DICT))
            .await
            .unwrap();

    app_state.set_loading(false);

    match res {
        Ok(msg) => Json(json!({ "status": "ok", "message": msg })),
        Err(e) => {
            error!("❌ [Install Defaults] Failed: {}", e);
            Json(json!({ "status": "error", "message": e.to_string() }))
        }
    }
}

pub async fn reset_db_handler(State(state): State<ServerState>) -> Json<Value> {
    info!("🧨 [Yomitan] Resetting Database to Default...");
    state.app.set_loading(true);

    let app_state = state.app.clone();

    let res = tokio::task::spawn_blocking(move || {
        {
            let mut dicts = app_state.dictionaries.write().expect("lock");
            dicts.clear();
            let mut next_id = app_state.next_dict_id.write().expect("lock");
            *next_id = 1;
        }

        if let Ok(mut conn) = app_state.pool.get() {
            if let Ok(tx) = conn.transaction() {
                let _ = tx.execute("DELETE FROM terms", []);
                let _ = tx.execute("DELETE FROM dictionaries", []);
                let _ = tx.execute("DELETE FROM metadata", []);
                let _ = tx.commit();
            }
            info!("🧹 [Yomitan] Vacuuming after reset...");
            let _ = conn.execute("VACUUM", []);
        }

        import::import_zip(&app_state, crate::PREBAKED_DICT)
    })
    .await
    .unwrap();

    state.app.set_loading(false);

    match res {
        Ok(_) => Json(json!({ "status": "ok", "message": "Database reset successfully." })),
        Err(e) => {
            error!("❌ [Reset] Failed: {}", e);
            Json(json!({ "status": "error", "message": e.to_string() }))
        }
    }
}

pub async fn lookup_handler(
    State(state): State<ServerState>,
    Query(params): Query<LookupParams>,
) -> Result<Json<Vec<ApiGroupedResult>>, (StatusCode, Json<Value>)> {
    let cursor_idx = params.index.unwrap_or(0);
    // determine if we should group results or return raw dictionary entries
    let should_group = params.group.unwrap_or(true);

    if state.app.is_loading() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "loading", "message": "Dictionaries are importing..." })),
        ));
    }

    let raw_results = state.lookup.search(&state.app, &params.text, cursor_idx);

    let dict_meta: std::collections::HashMap<DictionaryId, String> = {
        let dicts = state.app.dictionaries.read().expect("lock");
        dicts.iter().map(|(k, v)| (*k, v.name.clone())).collect()
    };

    struct Aggregator {
        headword: String,
        reading: String,
        furigana: Vec<(String, String)>,
        definitions: Vec<ApiDefinition>,
        frequencies: Vec<ApiFrequency>,
        forms_set: Vec<(String, String)>,
        match_len: usize, // Added to aggregator
    }

    let mut map: Vec<Aggregator> = Vec::new();

    let mut flat_results: Vec<ApiGroupedResult> = Vec::new();

    for entry in raw_results {
        let (headword, reading) = match &entry.term {
            Term::Full(h, r) => (h.to_string(), r.to_string()),
            Term::Headword(h) => (h.to_string(), "".to_string()),
            Term::Reading(r) => (r.to_string(), "".to_string()),
        };

        if headword.is_empty() {
            continue;
        }

        let match_len = entry.span_chars.end as usize;

        let mut is_freq = false;

        let (content_val, tags) = if let Record::YomitanGlossary(gloss) = &entry.record {
            use wordbase_api::dict::yomitan::structured::Content;
            if let Some(Content::String(s)) = gloss.content.first() {
                is_freq = s.starts_with("Frequency: ");
            }
            // Simply extract the name field as a string
            let t: Vec<String> = gloss.tags.iter().map(|tag| tag.name.clone()).collect();
            (json!(gloss.content), t)
        } else {
            (json!(entry.record), vec![])
        };

        let dict_name = dict_meta
            .get(&entry.source)
            .cloned()
            .unwrap_or("Unknown".to_string());

        if is_freq {
            let mut val_str = "Unknown".to_string();
            if let Some(arr) = content_val.as_array() {
                if let Some(first) = arr.get(0) {
                    let raw = first.as_str().unwrap_or("");
                    val_str = raw.replace("Frequency: ", "").trim().to_string();
                    if raw.is_empty() {
                        if let Some(obj) = first.get("content") {
                            if let Some(s) = obj.as_str() {
                                val_str = s.replace("Frequency: ", "").trim().to_string();
                            }
                        }
                    }
                }
            }

            let freq_obj = ApiFrequency {
                dictionary_name: dict_name,
                value: val_str,
            };
            if should_group {
                if let Some(existing) = map
                    .iter_mut()
                    .find(|agg| agg.headword == headword && agg.reading == reading)
                {
                    existing.frequencies.push(freq_obj);
                } else {
                    map.push(Aggregator {
                        headword: headword.clone(),
                        reading: reading.clone(),
                        furigana: calculate_furigana(&headword, &reading),
                        definitions: vec![],
                        frequencies: vec![freq_obj],
                        forms_set: vec![(headword.clone(), reading.clone())],
                        match_len,
                    });
                }
            } else {
                flat_results.push(ApiGroupedResult {
                    headword: headword.clone(),
                    reading: reading.clone(),
                    furigana: calculate_furigana(&headword, &reading),
                    definitions: vec![],
                    frequencies: vec![freq_obj],
                    forms: vec![ApiForm {
                        headword: headword.clone(),
                        reading: reading.clone(),
                    }],
                    match_len,
                });
            }
        } else {
            let def_obj = ApiDefinition {
                dictionary_name: dict_name,
                tags,
                content: content_val,
            };
            if should_group {
                if let Some(existing) = map
                    .iter_mut()
                    .find(|agg| agg.headword == headword && agg.reading == reading)
                {
                    let is_dup = existing.definitions.iter().any(|d| {
                        d.dictionary_name == def_obj.dictionary_name
                            && d.content.to_string() == def_obj.content.to_string()
                    });
                    if !is_dup {
                        existing.definitions.push(def_obj);
                    }
                } else {
                    map.push(Aggregator {
                        headword: headword.clone(),
                        reading: reading.clone(),
                        furigana: calculate_furigana(&headword, &reading),
                        definitions: vec![def_obj],
                        frequencies: vec![],
                        forms_set: vec![(headword.clone(), reading.clone())],
                        match_len,
                    });
                }
            } else {
                flat_results.push(ApiGroupedResult {
                    headword: headword.clone(),
                    reading: reading.clone(),
                    furigana: calculate_furigana(&headword, &reading),
                    definitions: vec![def_obj],
                    frequencies: vec![],
                    forms: vec![ApiForm {
                        headword: headword.clone(),
                        reading: reading.clone(),
                    }],
                    match_len,
                });
            }
        }
    }

    if should_group {
        Ok(Json(
            map.into_iter()
                .map(|agg| ApiGroupedResult {
                    headword: agg.headword,
                    reading: agg.reading,
                    furigana: agg.furigana,
                    definitions: agg.definitions,
                    frequencies: agg.frequencies,
                    forms: agg
                        .forms_set
                        .into_iter()
                        .map(|(h, r)| ApiForm {
                            headword: h,
                            reading: r,
                        })
                        .collect(),
                    match_len: agg.match_len,
                })
                .collect(),
        ))
    } else {
        Ok(Json(flat_results))
    }
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
        parts.push((h_chars[0..h_start].iter().collect(), String::new()));
    }
    if h_start < h_end {
        parts.push((
            h_chars[h_start..h_end].iter().collect(),
            r_chars[r_start..r_end].iter().collect(),
        ));
    }
    if h_end < h_chars.len() {
        parts.push((h_chars[h_end..].iter().collect(), String::new()));
    }
    parts
}

pub async fn list_dictionaries_handler(State(state): State<ServerState>) -> Json<Value> {
    let dicts = state.app.dictionaries.read().expect("lock");
    let mut list: Vec<_> = dicts.values().cloned().collect();
    list.sort_by_key(|d| d.priority);
    Json(
        json!({ "dictionaries": list, "status": if state.app.is_loading() { "loading" } else { "ready" } }),
    )
}

pub async fn import_handler(
    State(state): State<ServerState>,
    mut multipart: Multipart,
) -> Json<Value> {
    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => {
                if field.name() == Some("file") {
                    match field.bytes().await {
                        Ok(data) => {
                            info!("📥 [Import API] Received upload ({} bytes)", data.len());
                            let app_state = state.app.clone();
                            let res = tokio::task::spawn_blocking(move || {
                                import::import_zip(&app_state, &data)
                            })
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
                        Err(e) => {
                            return Json(
                                json!({ "status": "error", "message": format!("Upload Failed: {}", e) }),
                            );
                        }
                    }
                }
            }
            Ok(None) => break,
            Err(e) => {
                error!("❌ [Import API] Multipart error: {}", e);
                return Json(
                    json!({ "status": "error", "message": format!("Multipart Error: {}", e) }),
                );
            }
        }
    }
    Json(json!({ "status": "error", "message": "No file field found" }))
}
