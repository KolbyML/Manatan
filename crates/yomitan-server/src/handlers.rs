use crate::{ServerState, import};
use axum::{
    Json,
    extract::{Multipart, Query, State},
    http::StatusCode,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, Value as JsonValue, json};
use std::collections::HashMap;
use tracing::{error, info};
use wordbase_api::{DictionaryId, Record, Term, dict::yomitan::GlossaryTag};

use crate::state::AppState;

#[cfg(target_os = "ios")]
unsafe extern "C" {
    fn malloc_default_zone() -> *mut std::ffi::c_void;
    fn malloc_zone_pressure_relief(zone: *mut std::ffi::c_void, goal: usize);
}

#[derive(Deserialize)]
pub struct LookupParams {
    pub text: String,
    pub index: Option<usize>,
    // Optional toggle for grouping results (defaults to true in handler)
    pub group: Option<bool>,
    pub language: Option<DictionaryLanguage>,
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
    pub term_tags: Vec<GlossaryTag>,
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

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DictionaryLanguage {
    Japanese,
    English,
    Chinese,
    Korean,
    Arabic,
    Spanish,
    French,
    German,
    Portuguese,
}

impl DictionaryLanguage {
    fn as_str(&self) -> &'static str {
        match self {
            DictionaryLanguage::Japanese => "japanese",
            DictionaryLanguage::English => "english",
            DictionaryLanguage::Chinese => "chinese",
            DictionaryLanguage::Korean => "korean",
            DictionaryLanguage::Arabic => "arabic",
            DictionaryLanguage::Spanish => "spanish",
            DictionaryLanguage::French => "french",
            DictionaryLanguage::German => "german",
            DictionaryLanguage::Portuguese => "portuguese",
        }
    }

    fn to_deinflect_language(&self) -> crate::deinflector::Language {
        match self {
            DictionaryLanguage::Japanese => crate::deinflector::Language::Japanese,
            DictionaryLanguage::English => crate::deinflector::Language::English,
            DictionaryLanguage::Chinese => crate::deinflector::Language::Chinese,
            DictionaryLanguage::Korean => crate::deinflector::Language::Korean,
            DictionaryLanguage::Arabic => crate::deinflector::Language::Arabic,
            DictionaryLanguage::Spanish => crate::deinflector::Language::Spanish,
            DictionaryLanguage::French => crate::deinflector::Language::French,
            DictionaryLanguage::German => crate::deinflector::Language::German,
            DictionaryLanguage::Portuguese => crate::deinflector::Language::Portuguese,
        }
    }

    fn from_str(value: &str) -> Option<Self> {
        match value.trim().to_lowercase().as_str() {
            "japanese" => Some(DictionaryLanguage::Japanese),
            "english" => Some(DictionaryLanguage::English),
            "chinese" => Some(DictionaryLanguage::Chinese),
            "korean" => Some(DictionaryLanguage::Korean),
            "arabic" => Some(DictionaryLanguage::Arabic),
            "spanish" => Some(DictionaryLanguage::Spanish),
            "french" => Some(DictionaryLanguage::French),
            "german" => Some(DictionaryLanguage::German),
            "portuguese" => Some(DictionaryLanguage::Portuguese),
            _ => None,
        }
    }
}

impl std::fmt::Display for DictionaryLanguage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Deserialize)]
pub struct LanguageRequest {
    pub language: Option<DictionaryLanguage>,
}

pub fn load_preferred_language(app_state: &AppState) -> Option<DictionaryLanguage> {
    let mut conn = app_state.pool.get().ok()?;
    let mut stmt = conn
        .prepare("SELECT value FROM metadata WHERE key = ?")
        .ok()?;
    let value: Option<String> = stmt
        .query_row(["preferred_language"], |row| row.get(0))
        .ok();
    value.and_then(|val| DictionaryLanguage::from_str(&val))
}

fn store_preferred_language(app_state: &AppState, language: DictionaryLanguage) {
    if let Ok(mut conn) = app_state.pool.get() {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('preferred_language', ?)",
            [language.as_str()],
        );
    }
}

fn resolve_language(
    app_state: &AppState,
    language: Option<DictionaryLanguage>,
) -> DictionaryLanguage {
    language
        .or_else(|| load_preferred_language(app_state))
        .unwrap_or(DictionaryLanguage::Japanese)
}

fn dictionary_url(language: DictionaryLanguage) -> &'static str {
    match language {
        DictionaryLanguage::Japanese => {
            "https://github.com/yomidevs/jmdict-yomitan/releases/download/2026-01-26/JMdict_english.zip"
        }
        DictionaryLanguage::Korean => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ko-en.zip"
        }
        DictionaryLanguage::English => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-en-en.zip"
        }
        DictionaryLanguage::Chinese => {
            "https://github.com/MarvNC/cc-cedict-yomitan/releases/latest/download/CC-CEDICT.zip"
        }
        DictionaryLanguage::Arabic => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ar-en.zip"
        }
        DictionaryLanguage::Spanish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-es-en.zip"
        }
        DictionaryLanguage::French => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-fr-en.zip"
        }
        DictionaryLanguage::German => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-de-en.zip"
        }
        DictionaryLanguage::Portuguese => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-pt-en.zip"
        }
    }
}

async fn download_dictionary_bytes(language: DictionaryLanguage) -> Result<Vec<u8>, String> {
    let url = dictionary_url(language);
    let client = Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Dictionary download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Dictionary download failed ({}): {}",
            response.status(),
            url
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read dictionary bytes: {e}"))?;

    Ok(bytes.to_vec())
}

fn clear_dictionary_state(app_state: &AppState) {
    let mut dicts = app_state.dictionaries.write().expect("lock");
    dicts.clear();
    let mut next_id = app_state.next_dict_id.write().expect("lock");
    *next_id = 1;

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
}

pub async fn install_language_internal(
    app_state: AppState,
    language: DictionaryLanguage,
) -> Result<String, String> {
    let dict_bytes = download_dictionary_bytes(language).await?;
    let app_state_for_task = app_state.clone();
    let res =
        tokio::task::spawn_blocking(move || import::import_zip(&app_state_for_task, &dict_bytes))
            .await
            .map_err(|e| e.to_string())?;
    res.map_err(|e| e.to_string())
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

pub async fn unload_handler(State(state): State<ServerState>) -> Json<Value> {
    info!("♻️ [Memory] Unload requested...");

    // 1. Drop the heavy Rust struct (Logical Free)
    // This destroys the Vectors holding the 280MB data.
    state.lookup.unload_tokenizer();

    // 2. FORCE SYSTEM ALLOCATOR PURGE (Physical Free)
    // We tell iOS: "We just freed a ton of memory. Please release the cached pages to the OS now."
    #[cfg(any(target_os = "ios"))]
    unsafe {
        info!("🧹 [Memory] Triggering iOS malloc_zone_pressure_relief...");
        let zone = malloc_default_zone();
        if !zone.is_null() {
            // goal = 0 means "free as much as possible"
            malloc_zone_pressure_relief(zone, 0);
        }
    }

    // Optional: Log memory stats if you want to verify in console
    info!("✅ [Memory] Unload & Purge complete.");

    Json(json!({ "status": "ok", "message": "Tokenizer unloaded and memory purged" }))
}

pub async fn install_defaults_handler(
    State(state): State<ServerState>,
    payload: Option<Json<LanguageRequest>>,
) -> Json<Value> {
    let app_state = state.app.clone();
    let language = resolve_language(&app_state, payload.and_then(|val| val.0.language));

    {
        let dicts = app_state.dictionaries.read().expect("lock");
        if !dicts.is_empty() {
            store_preferred_language(&app_state, language);
            return Json(json!({ "status": "ok", "message": "Dictionaries already exist." }));
        }
    }

    info!("📥 [Yomitan] User requested dictionary install ({language})...");
    app_state.set_loading(true);

    let res = install_language_internal(app_state.clone(), language).await;

    app_state.set_loading(false);

    match res {
        Ok(msg) => {
            store_preferred_language(&app_state, language);
            Json(json!({ "status": "ok", "message": msg }))
        }
        Err(e) => {
            error!("❌ [Install Defaults] Failed: {}", e);
            Json(json!({ "status": "error", "message": e }))
        }
    }
}

pub async fn install_language_handler(
    State(state): State<ServerState>,
    payload: Option<Json<LanguageRequest>>,
) -> Json<Value> {
    let app_state = state.app.clone();
    let language = resolve_language(&app_state, payload.and_then(|val| val.0.language));

    {
        let dicts = app_state.dictionaries.read().expect("lock");
        if !dicts.is_empty() {
            store_preferred_language(&app_state, language);
            return Json(json!({ "status": "ok", "message": "Dictionaries already exist." }));
        }
    }

    info!("📥 [Yomitan] Installing dictionary ({language})...");
    app_state.set_loading(true);

    let res = install_language_internal(app_state.clone(), language).await;

    app_state.set_loading(false);

    match res {
        Ok(msg) => {
            store_preferred_language(&app_state, language);
            Json(json!({ "status": "ok", "message": msg }))
        }
        Err(e) => {
            error!("❌ [Install Language] Failed: {}", e);
            Json(json!({ "status": "error", "message": e }))
        }
    }
}

pub async fn reset_db_handler(
    State(state): State<ServerState>,
    payload: Option<Json<LanguageRequest>>,
) -> Json<Value> {
    let app_state = state.app.clone();
    let language = resolve_language(&app_state, payload.and_then(|val| val.0.language));
    info!("🧨 [Yomitan] Resetting Database ({language})...");
    state.app.set_loading(true);

    let clear_state = state.app.clone();
    let clear_res = tokio::task::spawn_blocking(move || {
        clear_dictionary_state(&clear_state);
    })
    .await;

    if let Err(e) = clear_res {
        state.app.set_loading(false);
        error!("❌ [Reset] Failed to clear database: {}", e);
        return Json(json!({ "status": "error", "message": e.to_string() }));
    }

    let res = install_language_internal(app_state.clone(), language).await;
    state.app.set_loading(false);

    match res {
        Ok(_) => {
            store_preferred_language(&app_state, language);
            Json(json!({ "status": "ok", "message": "Database reset successfully." }))
        }
        Err(e) => {
            error!("❌ [Reset] Failed: {}", e);
            Json(json!({ "status": "error", "message": e }))
        }
    }
}

pub async fn lookup_handler(
    State(state): State<ServerState>,
    Query(params): Query<LookupParams>,
) -> Result<Json<Vec<ApiGroupedResult>>, (StatusCode, Json<Value>)> {
    let cursor_idx = params.index.unwrap_or(0);
    let language = params
        .language
        .or_else(|| load_preferred_language(&state.app))
        .unwrap_or(DictionaryLanguage::Japanese);
    // determine if we should group results or return raw dictionary entries
    let should_group = params.group.unwrap_or(true);

    if state.app.is_loading() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "loading", "message": "Dictionaries are importing..." })),
        ));
    }

    let raw_results = state
        .lookup
        .search(&state.app, &params.text, cursor_idx, language.to_deinflect_language());

    let dict_meta: std::collections::HashMap<DictionaryId, String> = {
        let dicts = state.app.dictionaries.read().expect("lock");
        dicts.iter().map(|(k, v)| (*k, v.name.clone())).collect()
    };

    struct Aggregator {
        headword: String,
        reading: String,
        term_tags: Vec<GlossaryTag>,
        furigana: Vec<(String, String)>,
        definitions: Vec<ApiDefinition>,
        frequencies: Vec<ApiFrequency>,
        forms_set: Vec<(String, String)>,
        match_len: usize, // Added to aggregator
    }

    let mut map: Vec<Aggregator> = Vec::new();

    let mut freq_map: HashMap<(String, String), Vec<ApiFrequency>> = HashMap::new();

    let mut flat_results: Vec<ApiGroupedResult> = Vec::new();

    for entry in raw_results {
        let (headword, reading) = match &entry.0.term {
            Term::Full(h, r) => (h.to_string(), r.to_string()),
            Term::Headword(h) => (h.to_string(), "".to_string()),
            Term::Reading(r) => (r.to_string(), "".to_string()),
        };

        if headword.is_empty() {
            continue;
        }

        let match_len = entry.0.span_chars.end as usize;

        let mut is_freq = false;

        let (content_val, tags) = if let Record::YomitanGlossary(gloss) = &entry.0.record {
            use wordbase_api::dict::yomitan::structured::Content;
            if let Some(Content::String(s)) = gloss.content.first() {
                is_freq = s.starts_with("Frequency: ");
            }
            // Simply extract the name field as a string
            let t: Vec<String> = gloss.tags.iter().map(|tag| tag.name.clone()).collect();
            (json!(gloss.content), t)
        } else {
            (json!(entry.0.record), vec![])
        };

        let dict_name = dict_meta
            .get(&entry.0.source)
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

            // Store in map instead of pushing to results immediately.
            freq_map
                .entry((headword.clone(), reading.clone()))
                .or_default()
                .push(freq_obj);
        } else {
            // === DEFINITION LOGIC ===
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
                        frequencies: vec![], // Will be filled in final pass
                        term_tags: entry.1.unwrap_or_default(),
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
                    frequencies: vec![], // Will be filled in final pass
                    term_tags: entry.1.unwrap_or_default(),
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
        let final_results = map
            .into_iter()
            .map(|mut agg| {
                // Attach frequencies if they exist for this word
                if let Some(freqs) = freq_map.get(&(agg.headword.clone(), agg.reading.clone())) {
                    agg.frequencies.extend(freqs.clone());
                }

                ApiGroupedResult {
                    headword: agg.headword,
                    reading: agg.reading,
                    furigana: agg.furigana,
                    definitions: agg.definitions,
                    frequencies: agg.frequencies,
                    term_tags: agg.term_tags,
                    forms: agg
                        .forms_set
                        .into_iter()
                        .map(|(h, r)| ApiForm {
                            headword: h,
                            reading: r,
                        })
                        .collect(),
                    match_len: agg.match_len,
                }
            })
            .collect();

        Ok(Json(final_results))
    } else {
        // Iterate through results and attach frequencies to ALL of them.
        for res in &mut flat_results {
            if let Some(freqs) = freq_map.get(&(res.headword.clone(), res.reading.clone())) {
                res.frequencies.extend(freqs.clone());
            }
        }

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
