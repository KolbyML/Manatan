use crate::{PREBAKED_DICT, ServerState, import};
use axum::{
    Json,
    extract::{Multipart, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, Value as JsonValue, json};
use tracing::{error, info};
use wordbase_api::{DictionaryId, Record, Term};

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
        Ok(msg) => Json(json!({ "status": "ok", "message": "Database reset successfully." })),
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
        forms_set: Vec<(String, String)>,
        match_len: usize, // Added to aggregator
    }

    let mut map: Vec<Aggregator> = Vec::new();

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

        let dict_name = dict_meta
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
                match_len, // Capture match length
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
                match_len: agg.match_len, // Expose match length
            }
        })
        .collect();

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
        let field_result = multipart.next_field().await;

        match field_result {
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
                            error!("❌ [Import API] Failed to read field bytes: {}", e);
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
