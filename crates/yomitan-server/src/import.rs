use anyhow::Result;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::io::Read;
use tracing::info;
use wordbase_api::{
    dict::yomitan::{structured, Glossary, GlossaryTag},
    DictionaryId, DictionaryKind, DictionaryMeta, Record,
};
use zip::ZipArchive;

use crate::state::{AppState, DictionaryData, StoredRecord};

pub fn import_zip(state: &AppState, data: &[u8]) -> Result<String> {
    info!(
        "📦 [Import] Starting ZIP import (size: {} bytes)...",
        data.len()
    );

    let mut zip = ZipArchive::new(std::io::Cursor::new(data))?;

    // 1. Find index.json
    let mut index_file_name = None;
    for i in 0..zip.len() {
        if let Ok(file) = zip.by_index(i) {
            if file.name().ends_with("index.json") {
                index_file_name = Some(file.name().to_string());
                break;
            }
        }
    }

    let index_file_name =
        index_file_name.ok_or_else(|| anyhow::anyhow!("No index.json found in zip"))?;

    let meta = {
        let mut file = zip.by_name(&index_file_name)?;
        let mut s = String::new();
        file.read_to_string(&mut s)?;
        let json: Value = serde_json::from_str(&s)?;

        let format_value = json.get("format").or_else(|| json.get("version"));
        let format_version = format_value.and_then(|value| {
            value
                .as_i64()
                .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
        });
        if format_version != Some(3) {
            return Err(anyhow::anyhow!(match format_version {
                Some(found) => format!(
                    "Unsupported dictionary format version {} (expected 3).",
                    found
                ),
                None => "Unsupported dictionary format: missing version (expected 3).".to_string(),
            }));
        }

        let name = json["title"].as_str().unwrap_or("Unknown").to_string();
        let mut dm = DictionaryMeta::new(DictionaryKind::Yomitan, name);
        dm.version = json["revision"].as_str().map(|s| s.to_string());
        dm.description = json["description"].as_str().map(|s| s.to_string());
        dm
    };

    let dict_name = meta.name.clone();
    let normalized_name = dict_name.trim().to_lowercase();
    {
        let dicts = state.dictionaries.read().expect("lock");
        if dicts
            .values()
            .any(|dict| dict.name.trim().to_lowercase() == normalized_name)
        {
            return Err(anyhow::anyhow!(format!(
                "Dictionary '{}' is already imported.",
                dict_name
            )));
        }
    }

    // 2. Database Transaction Setup
    let mut conn = state.pool.get()?;
    let tx = conn.transaction()?;

    // 3. Register Dictionary in DB and Memory
    let dict_id;
    {
        let mut next_id = state.next_dict_id.write().expect("lock");
        dict_id = DictionaryId(*next_id);
        *next_id += 1;

        // Insert into DB
        tx.execute(
            "INSERT INTO dictionaries (id, name, priority, enabled) VALUES (?, ?, ?, ?)",
            rusqlite::params![dict_id.0, dict_name, 0, true],
        )?;

        // Update Memory
        let mut dicts = state.dictionaries.write().expect("lock");
        dicts.insert(
            dict_id,
            DictionaryData {
                id: dict_id,
                name: dict_name.clone(),
                priority: 0,
                enabled: true,
            },
        );
    }

    // 4. Scan for term banks and Insert
    let file_names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut terms_found = 0;

    // Create reusable encoder
    let mut encoder = snap::raw::Encoder::new();

    for name in &file_names {
        // === BRANCH 1: Standard Definitions (term_bank) ===
        if name.contains("term_bank") && !name.contains("term_meta") && name.ends_with(".json") {
            info!("   -> Processing Definitions: {}", name);
            let mut file = zip.by_name(&name)?;
            let mut s = String::new();
            file.read_to_string(&mut s)?;

            let bank: Vec<Value> = serde_json::from_str(&s).unwrap_or_default();

            // Note: Added dictionary_id column to INSERT
            let mut stmt =
                tx.prepare("INSERT INTO terms (term, dictionary_id, json) VALUES (?, ?, ?)")?;

            for entry in bank {
                if let Some(arr) = entry.as_array() {
                    // Min items 8 per schema
                    if arr.len() < 8 {
                        continue;
                    }

                    let headword = arr.get(0).and_then(|v| v.as_str()).unwrap_or("");
                    let reading = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");

                    if headword.is_empty() {
                        continue;
                    }

                    // --- Tags Parsing (Indices 2 and 7 are string of space-separated tags) ---
                    let mut definition_tags = Vec::new();
                    let mut term_tags = Vec::new();
                    let mut seen_tags = HashSet::new();

                    let parse_tags =
                        |idx: usize, tags: &mut Vec<GlossaryTag>, seen: &mut HashSet<String>| {
                            if let Some(tag_str) = arr.get(idx).and_then(|v| v.as_str()) {
                                for t in tag_str.split_whitespace() {
                                    if !t.is_empty() && seen.insert(t.to_string()) {
                                        // Treat as string, wrap for API compatibility
                                        tags.push(GlossaryTag {
                                            name: t.to_string(),
                                            category: String::new(),
                                            description: String::new(),
                                            order: 0,
                                        });
                                    }
                                }
                            }
                        };

                    parse_tags(2, &mut definition_tags, &mut seen_tags); // Definition tags
                    parse_tags(7, &mut term_tags, &mut seen_tags); // Term tags

                    // --- Content (Index 5) ---
                    let mut content_list = Vec::new();
                    if let Some(defs) = arr.get(5).and_then(|v| v.as_array()) {
                        for d in defs {
                            if let Some(str_def) = d.as_str() {
                                content_list.push(structured::Content::String(str_def.to_string()));
                            } else if d.is_object() || d.is_array() {
                                let json_str = serde_json::to_string(&d).unwrap_or_default();
                                content_list.push(structured::Content::String(json_str));
                            }
                        }
                    }

                    let record = Record::YomitanGlossary(Glossary {
                        popularity: arr.get(4).and_then(|v| v.as_i64()).unwrap_or(0),
                        tags: definition_tags,
                        content: content_list,
                    });

                    let stored_reading = if !reading.is_empty() && reading != headword {
                        Some(reading.to_string())
                    } else {
                        None
                    };

                    let term_tags = if term_tags.is_empty() {
                        None
                    } else {
                        Some(term_tags)
                    };

                    let stored = StoredRecord {
                        dictionary_id: dict_id,
                        record,
                        term_tags,
                        reading: stored_reading.clone(),
                        headword: Some(headword.to_string()),
                    };

                    // CHANGED: Serialize to bytes -> Compress -> Insert
                    let json_bytes = serde_json::to_vec(&stored)?;
                    let compressed = encoder.compress_vec(&json_bytes)?;

                    // Insert Headword mapping
                    stmt.execute(rusqlite::params![headword, dict_id.0, compressed])?;
                    terms_found += 1;

                    // Insert Reading mapping
                    if let Some(r) = stored_reading {
                        stmt.execute(rusqlite::params![r, dict_id.0, compressed])?;
                    }
                }
            }
        }
        // === BRANCH 2: Metadata / Frequencies (term_meta_bank) ===
        else if name.contains("term_meta_bank") && name.ends_with(".json") {
            info!("   -> Processing Metadata: {}", name);
            let mut file = zip.by_name(&name)?;
            let mut s = String::new();
            file.read_to_string(&mut s)?;

            let bank: Vec<Value> = serde_json::from_str(&s).unwrap_or_default();

            // PREPARE STATEMENT LOCALLY FOR THIS BATCH
            let mut stmt =
                tx.prepare("INSERT INTO terms (term, dictionary_id, json) VALUES (?, ?, ?)")?;

            struct MetaEntry {
                reading: Option<String>,
                value: String,
            }
            let mut file_freq_map: HashMap<String, Vec<MetaEntry>> = HashMap::new();

            for entry in bank {
                if let Some(arr) = entry.as_array() {
                    if arr.len() < 3 {
                        continue;
                    }

                    let term = arr.get(0).and_then(|v| v.as_str()).unwrap_or("");
                    let mode = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
                    let data_blob = arr.get(2).unwrap();

                    if term.is_empty() {
                        continue;
                    }

                    if mode == "freq" {
                        let mut display_val = String::new();
                        let mut specific_reading = None;

                        // Case 1: Object (may contain reading + value)
                        if let Some(obj) = data_blob.as_object() {
                            if let Some(r) = obj.get("reading").and_then(|v| v.as_str()) {
                                specific_reading = Some(r.to_string());
                            }

                            // Frequency object might be nested or direct
                            let freq_data = obj.get("frequency").unwrap_or(data_blob);

                            if let Some(freq_obj) = freq_data.as_object() {
                                if let Some(dv) =
                                    freq_obj.get("displayValue").and_then(|v| v.as_str())
                                {
                                    display_val = dv.to_string();
                                } else if let Some(v) = freq_obj.get("value") {
                                    display_val = v.to_string();
                                }
                            } else if let Some(v) = freq_data.as_i64() {
                                display_val = v.to_string();
                            } else if let Some(s) = freq_data.as_str() {
                                display_val = s.to_string();
                            }
                        }
                        // Case 2: Primitive (just the value)
                        else if let Some(s) = data_blob.as_str() {
                            display_val = s.to_string();
                        } else if let Some(n) = data_blob.as_i64() {
                            display_val = n.to_string();
                        }

                        if display_val.is_empty() {
                            display_val = data_blob.to_string();
                        }

                        file_freq_map
                            .entry(term.to_string())
                            .or_default()
                            .push(MetaEntry {
                                reading: specific_reading,
                                value: display_val,
                            });
                    }
                }
            }

            // Insert Frequencies
            for (term, entries) in file_freq_map {
                let general_value = entries
                    .iter()
                    .find(|e| e.reading.is_none())
                    .map(|e| e.value.clone());

                for entry in &entries {
                    // Deduplication logic
                    if let Some(read) = &entry.reading {
                        if let Some(general_val) = &general_value {
                            if general_val == &entry.value && read == &term {
                                continue;
                            }
                        }
                    }

                    let content_str = if let Some(read) = &entry.reading {
                        if read != &term {
                            format!("Frequency: {} ({})", entry.value, read)
                        } else {
                            format!("Frequency: {}", entry.value)
                        }
                    } else {
                        format!("Frequency: {}", entry.value)
                    };

                    let record = Record::YomitanGlossary(Glossary {
                        popularity: 0,
                        tags: vec![],
                        content: vec![structured::Content::String(content_str)],
                    });

                    let stored = StoredRecord {
                        dictionary_id: dict_id,
                        record,
                        term_tags: None,
                        reading: entry.reading.clone(),
                        headword: Some(term.clone()),
                    };

                    let json_bytes = serde_json::to_vec(&stored)?;
                    let compressed = encoder.compress_vec(&json_bytes)?;

                    stmt.execute(rusqlite::params![term, dict_id.0, compressed])?;
                    terms_found += 1;

                    if let Some(r) = &entry.reading {
                        if r != &term {
                            stmt.execute(rusqlite::params![r, dict_id.0, compressed])?;
                        }
                    }
                }
            }
        }
    }

    tx.commit()?;
    info!(
        "💾 [Import] Database transaction committed. Total Terms: {}",
        terms_found
    );

    Ok(format!("Imported '{}'", dict_name))
}
