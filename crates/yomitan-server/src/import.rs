use crate::state::{AppState, StoredRecord};
use anyhow::Result;
use serde_json::{Value, json};
use std::io::{Cursor, Read};
use tracing::{error, info};
use wordbase_api::{
    Dictionary, DictionaryId, DictionaryKind, DictionaryMeta, Record,
    dict::yomitan::{Glossary, structured},
};
use zip::ZipArchive;

pub fn import_zip(state: &AppState, data: &[u8]) -> Result<String> {
    info!(
        "📦 [Import] Starting ZIP import (size: {} bytes)...",
        data.len()
    );

    let mut zip = ZipArchive::new(Cursor::new(data))?;
    let mut meta: Option<DictionaryMeta> = None;
    let mut terms_found = 0;

    // 1. Find index.json
    let mut index_path = None;
    for i in 0..zip.len() {
        let file = zip.by_index(i)?;
        if file.name().ends_with("index.json") {
            index_path = Some(file.name().to_string());
            break;
        }
    }

    if let Some(path) = index_path {
        let mut file = zip.by_name(&path)?;
        let mut s = String::new();
        file.read_to_string(&mut s)?;
        let json: Value = serde_json::from_str(&s)?;

        let name = json["title"].as_str().unwrap_or("Unknown").to_string();
        let mut dm = DictionaryMeta::new(DictionaryKind::Yomitan, name);
        dm.version = json["revision"].as_str().map(|s| s.to_string());
        dm.description = json["description"].as_str().map(|s| s.to_string());

        meta = Some(dm);
    } else {
        return Err(anyhow::anyhow!("No index.json found in zip"));
    }

    let meta = meta.unwrap(); // Safe due to check above
    let dict_name = meta.name.clone();

    // 2. Register Dictionary
    let dict_id;
    {
        let mut db = state.inner.write().expect("lock");
        dict_id = DictionaryId(db.next_dict_id);
        db.next_dict_id += 1;
        db.dictionaries.insert(
            dict_id,
            Dictionary {
                id: dict_id,
                meta,
                position: 0,
            },
        );
    }

    // 3. Scan for term banks
    let file_names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    for name in file_names {
        if name.contains("term_bank") && name.ends_with(".json") {
            info!("   -> Processing {}", name);
            let mut file = zip.by_name(&name)?;
            let mut s = String::new();
            file.read_to_string(&mut s)?;

            let bank: Vec<Value> = serde_json::from_str(&s).unwrap_or_default();
            let mut db = state.inner.write().expect("lock");

            for entry in bank {
                if let Some(arr) = entry.as_array() {
                    let headword = arr.get(0).and_then(|v| v.as_str()).unwrap_or("");
                    let reading = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");

                    let definition_arr = arr.get(5).and_then(|v| v.as_array());
                    let mut content_list = Vec::new();
                    if let Some(defs) = definition_arr {
                        for d in defs {
                            if let Some(str_def) = d.as_str() {
                                content_list.push(structured::Content::String(str_def.to_string()));
                            } else if let Some(obj_def) = d.as_object() {
                                let json_str = serde_json::to_string(&obj_def).unwrap_or_default();
                                content_list.push(structured::Content::String(json_str));
                            }
                        }
                    }

                    if headword.is_empty() {
                        continue;
                    }

                    // --- PARSE TAGS ---
                    // Yomitan stores tags as space-separated string at index 2
                    let tags_raw = arr.get(2).and_then(|v| v.as_str()).unwrap_or("");
                    let mut tags_vec = Vec::new();
                    if !tags_raw.is_empty() {
                        for t_str in tags_raw.split_whitespace() {
                            // Try to deserialize string into GlossaryTag type via JSON
                            if let Ok(tag) = serde_json::from_value(json!(t_str)) {
                                tags_vec.push(tag);
                            }
                        }
                    }

                    let record = Record::YomitanGlossary(Glossary {
                        popularity: arr.get(4).and_then(|v| v.as_i64()).unwrap_or(0),
                        tags: tags_vec,
                        content: content_list,
                    });

                    let stored_reading = if !reading.is_empty() && reading != headword {
                        Some(reading.to_string())
                    } else {
                        None
                    };

                    let stored = StoredRecord {
                        dictionary_id: dict_id,
                        record,
                        reading: stored_reading.clone(),
                    };

                    db.index
                        .entry(headword.to_string())
                        .or_default()
                        .push(stored.clone());

                    if let Some(r) = stored_reading {
                        db.index.entry(r).or_default().push(stored);
                    }

                    terms_found += 1;
                }
            }
        }
    }

    if let Err(e) = state.save() {
        error!("❌ [Import] Failed to save state: {}", e);
    } else {
        info!("💾 [Import] State saved. Total Terms: {}", terms_found);
    }

    Ok(format!(
        "Imported '{}' with {} terms",
        dict_name, terms_found
    ))
}
