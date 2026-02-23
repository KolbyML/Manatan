use std::{collections::HashSet, fmt, fs, io::Read, marker::PhantomData};

use anyhow::{Result, anyhow};
use serde::de::{DeserializeOwned, DeserializeSeed, SeqAccess, Visitor};
use serde_json::Value;
use tracing::{info, warn};
use wordbase_api::{
    DictionaryId, DictionaryKind, DictionaryMeta, Record,
    dict::yomitan::{Glossary, GlossaryTag, structured},
};
use zip::ZipArchive;

use crate::state::{AppState, DictionaryData, StoredRecord};

#[cfg(test)]
const MAX_IMPORT_ARCHIVE_BYTES: usize = 2 * 1024 * 1024;
#[cfg(not(test))]
const MAX_IMPORT_ARCHIVE_BYTES: usize = 768 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 3 * 1024 * 1024 * 1024;
const MAX_JSON_ENTRY_BYTES: u64 = 512 * 1024 * 1024;
const MAX_INDEX_JSON_BYTES: u64 = 4 * 1024 * 1024;
const MAX_ZIP_ENTRY_COUNT: usize = 65536;
const MAX_COMPRESSION_RATIO: u64 = 300;
const MAX_TERMS_INSERTED: usize = 8_000_000;

fn read_limited_string<R: Read>(reader: R, byte_limit: u64, label: &str) -> Result<String> {
    let mut limited_reader = reader.take(byte_limit.saturating_add(1));
    let mut buf = Vec::new();
    limited_reader.read_to_end(&mut buf)?;

    if (buf.len() as u64) > byte_limit {
        return Err(anyhow!("{label} exceeds size limit ({byte_limit} bytes)"));
    }

    String::from_utf8(buf).map_err(|err| anyhow!("{label} is not valid UTF-8: {err}"))
}

fn validate_zip_archive<R: Read + std::io::Seek>(zip: &mut ZipArchive<R>) -> Result<()> {
    if zip.len() > MAX_ZIP_ENTRY_COUNT {
        return Err(anyhow!(
            "Archive contains too many entries ({}, max {MAX_ZIP_ENTRY_COUNT}).",
            zip.len()
        ));
    }

    let mut total_uncompressed = 0u64;
    for i in 0..zip.len() {
        let file = zip.by_index(i)?;
        if file.is_dir() {
            continue;
        }
        
        // Skip system files and folders during validation
        if should_skip_file(file.name()) {
            continue;
        }

        let size = file.size();
        let compressed_size = file.compressed_size();

        total_uncompressed = total_uncompressed.saturating_add(size);
        if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES {
            return Err(anyhow!(
                "Archive uncompressed size exceeds limit ({MAX_TOTAL_UNCOMPRESSED_BYTES} bytes)."
            ));
        }

        if file.name().ends_with(".json") && size > MAX_JSON_ENTRY_BYTES {
            return Err(anyhow!(
                "JSON entry '{}' is too large ({size} bytes, max {MAX_JSON_ENTRY_BYTES}).",
                file.name()
            ));
        }

        if compressed_size > 0 {
            let ratio = size / compressed_size;
            if ratio > MAX_COMPRESSION_RATIO {
                return Err(anyhow!(
                    "Archive entry '{}' looks suspicious (compression ratio {ratio}).",
                    file.name()
                ));
            }
        }
    }

    Ok(())
}

fn open_zip_file_safe<'a, R: std::io::Read + std::io::Seek>(
    zip: &'a mut ZipArchive<R>,
    name: &str,
) -> Option<zip::read::ZipFile<'a, R>> {
    match zip.by_name(name) {
        Ok(f) => Some(f),
        Err(e) => {
            let error_str = format!("{e:?}");
            if error_str.contains("checksum")
                || error_str.contains("CRC")
                || error_str.contains("InvalidArchive")
            {
                tracing::warn!("File has checksum error, skipping: {}", name);
            }
            None
        }
    }
}

fn should_skip_file(name: &str) -> bool {
    // Skip macOS resource fork and metadata folders
    if name.starts_with("__MACOSX/") || name.contains("/__MACOSX/") {
        return true;
    }
    
    // Skip hidden files (starting with .)
    if name.starts_with('.') || name.contains("/.") {
        return true;
    }
    
    // Skip common system/temp files
    if name.ends_with(".DS_Store") || name.ends_with("Thumbs.db") {
        return true;
    }
    
    // Skip Windows resource forks
    if name.starts_with("._") || name.contains("/._") {
        return true;
    }
    
    false
}

fn bump_term_count(terms_found: &mut usize) -> Result<()> {
    *terms_found += 1;
    if *terms_found > MAX_TERMS_INSERTED {
        return Err(anyhow!(
            "Dictionary exceeds safe import limit ({MAX_TERMS_INSERTED} records)."
        ));
    }
    Ok(())
}

fn parse_space_separated_tags(
    arr: &[Value],
    idx: usize,
    tags: &mut Vec<GlossaryTag>,
    seen: &mut HashSet<String>,
) {
    if let Some(tag_str) = arr.get(idx).and_then(|v| v.as_str()) {
        for t in tag_str.split_whitespace() {
            if !t.is_empty() && seen.insert(t.to_string()) {
                tags.push(GlossaryTag {
                    name: t.to_string(),
                    category: String::new(),
                    description: String::new(),
                    order: 0,
                });
            }
        }
    }
}

fn parse_frequency_value(data_blob: &Value) -> (String, Option<String>) {
    let mut display_val = String::new();
    let mut specific_reading = None;

    if let Some(obj) = data_blob.as_object() {
        if let Some(r) = obj.get("reading").and_then(|v| v.as_str()) {
            specific_reading = Some(r.to_string());
        }

        let freq_data = obj.get("frequency").unwrap_or(data_blob);
        if let Some(freq_obj) = freq_data.as_object() {
            if let Some(dv) = freq_obj.get("displayValue").and_then(|v| v.as_str()) {
                display_val = dv.to_string();
            } else if let Some(v) = freq_obj.get("value") {
                display_val = v.to_string();
            }
        } else if let Some(v) = freq_data.as_i64() {
            display_val = v.to_string();
        } else if let Some(s) = freq_data.as_str() {
            display_val = s.to_string();
        }
    } else if let Some(s) = data_blob.as_str() {
        display_val = s.to_string();
    } else if let Some(n) = data_blob.as_i64() {
        display_val = n.to_string();
    }

    if display_val.is_empty() {
        display_val = data_blob.to_string();
    }

    (display_val, specific_reading)
}

fn parse_position_array(value: Option<&Value>) -> Vec<i64> {
    match value {
        Some(Value::Number(n)) => n.as_i64().map(|v| vec![v]).unwrap_or_default(),
        Some(Value::Array(arr)) => arr.iter().filter_map(|v| v.as_i64()).collect(),
        _ => Vec::new(),
    }
}

fn parse_pitch_meta(data_blob: &Value) -> (String, Option<String>) {
    let obj = match data_blob.as_object() {
        Some(o) => o,
        None => return ("Pitch:{}".to_string(), None),
    };

    let reading = obj
        .get("reading")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let pitches_raw = obj
        .get("pitches")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut pitches = Vec::new();
    for pitch_val in pitches_raw {
        let pitch_obj = match pitch_val.as_object() {
            Some(o) => o,
            None => continue,
        };

        let position = pitch_obj.get("position").cloned().unwrap_or(Value::Null);
        let nasal = parse_position_array(pitch_obj.get("nasal"));
        let devoice = parse_position_array(pitch_obj.get("devoice"));

        let tags: Vec<String> = pitch_obj
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        pitches.push(serde_json::json!({
            "position": position,
            "nasal": nasal,
            "devoice": devoice,
            "tags": tags
        }));
    }

    let pitch_data = serde_json::json!({
        "reading": reading,
        "pitches": pitches
    });

    let content = format!("Pitch:{pitch_data}");
    let reading_opt = if reading.is_empty() {
        None
    } else {
        Some(reading)
    };

    (content, reading_opt)
}

fn parse_ipa_meta(data_blob: &Value) -> (String, Option<String>) {
    let obj = match data_blob.as_object() {
        Some(o) => o,
        None => return ("IPA:{}".to_string(), None),
    };

    let reading = obj
        .get("reading")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let transcriptions_raw = obj
        .get("transcriptions")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut transcriptions = Vec::new();
    for trans_val in transcriptions_raw {
        let trans_obj = match trans_val.as_object() {
            Some(o) => o,
            None => continue,
        };

        let ipa = trans_obj
            .get("ipa")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if ipa.is_empty() {
            continue;
        }

        let tags: Vec<String> = trans_obj
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        transcriptions.push(serde_json::json!({
            "ipa": ipa,
            "tags": tags
        }));
    }

    let ipa_data = serde_json::json!({
        "reading": reading,
        "transcriptions": transcriptions
    });

    let content = format!("IPA:{ipa_data}");
    let reading_opt = if reading.is_empty() {
        None
    } else {
        Some(reading)
    };

    (content, reading_opt)
}

fn parse_json_array_stream<R, T, F>(reader: R, mut on_entry: F) -> Result<usize>
where
    R: Read,
    T: DeserializeOwned,
    F: FnMut(T) -> Result<()>,
{
    struct ArrayVisitor<'a, T, F>
    where
        T: DeserializeOwned,
        F: FnMut(T) -> Result<()>,
    {
        on_entry: &'a mut F,
        _marker: PhantomData<T>,
    }

    impl<'de, 'a, T, F> Visitor<'de> for ArrayVisitor<'a, T, F>
    where
        T: DeserializeOwned,
        F: FnMut(T) -> Result<()>,
    {
        type Value = usize;

        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("a JSON array")
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: SeqAccess<'de>,
        {
            let mut count = 0usize;
            while let Some(entry) = seq.next_element::<T>()? {
                (self.on_entry)(entry).map_err(serde::de::Error::custom)?;
                count += 1;
            }
            Ok(count)
        }
    }

    struct ArraySeed<'a, T, F>
    where
        T: DeserializeOwned,
        F: FnMut(T) -> Result<()>,
    {
        on_entry: &'a mut F,
        _marker: PhantomData<T>,
    }

    impl<'de, 'a, T, F> DeserializeSeed<'de> for ArraySeed<'a, T, F>
    where
        T: DeserializeOwned,
        F: FnMut(T) -> Result<()>,
    {
        type Value = usize;

        fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
        where
            D: serde::Deserializer<'de>,
        {
            deserializer.deserialize_seq(ArrayVisitor {
                on_entry: self.on_entry,
                _marker: PhantomData,
            })
        }
    }

    let mut deserializer = serde_json::Deserializer::from_reader(reader);
    let count = ArraySeed::<T, F> {
        on_entry: &mut on_entry,
        _marker: PhantomData,
    }
    .deserialize(&mut deserializer)?;
    deserializer.end()?;
    Ok(count)
}

pub fn import_zip(state: &AppState, data: &[u8]) -> Result<String> {
    if data.len() > MAX_IMPORT_ARCHIVE_BYTES {
        return Err(anyhow!(
            "Archive is too large ({} bytes, max {MAX_IMPORT_ARCHIVE_BYTES}).",
            data.len()
        ));
    }

    info!(
        "📦 [Import] Starting ZIP import (size: {} bytes)...",
        data.len()
    );

    let mut zip = ZipArchive::new(std::io::Cursor::new(data))?;
    validate_zip_archive(&mut zip)?;

    // 1. Find index.json
    let mut index_file_name = None;
    for i in 0..zip.len() {
        if let Ok(file) = zip.by_index(i)
            && !should_skip_file(file.name())
            && file.name().ends_with("index.json")
        {
            index_file_name = Some(file.name().to_string());
            break;
        }
    }

    let index_file_name = index_file_name.ok_or_else(|| anyhow!("No index.json found in zip"))?;

    let meta = {
        let file = zip.by_name(&index_file_name)?;
        let s = read_limited_string(file, MAX_INDEX_JSON_BYTES, "index.json")?;
        let json: Value = serde_json::from_str(&s)?;

        let format_value = json.get("format").or_else(|| json.get("version"));
        let format_version = format_value.and_then(|value| {
            value
                .as_i64()
                .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
        });
        if format_version != Some(3) {
            return Err(anyhow!(match format_version {
                Some(found) =>
                    format!("Unsupported dictionary format version {found} (expected 3)."),
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
            return Err(anyhow!(format!(
                "Dictionary '{dict_name}' is already imported."
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

        tx.execute(
            "INSERT INTO dictionaries (id, name, priority, enabled) VALUES (?, ?, ?, ?)",
            rusqlite::params![dict_id.0, dict_name, 0, true],
        )?;

        let mut dicts = state.dictionaries.write().expect("lock");
        dicts.insert(
            dict_id,
            DictionaryData {
                id: dict_id,
                name: dict_name.clone(),
                priority: 0,
                enabled: true,
                styles: None,
            },
        );
    }

    // 3.5. Extract CSS and Images from ZIP
    let dict_media_dir = state.data_dir.join("dict_media").join(&dict_name);
    fs::create_dir_all(&dict_media_dir)?;

    let mut styles_content: Option<String> = None;

    for i in 0..zip.len() {
        let mut file = match zip.by_index(i) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let file_name = file.name().to_string();

        // Extract styles.css
        if file_name == "styles.css" {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                styles_content = Some(contents);
            }
            continue;
        }

        // Skip JSON files (they're term banks, handled separately)
        if file_name.ends_with(".json") || file_name.ends_with(".json.gz") {
            continue;
        }

        // Skip other metadata files
        if file_name.contains("index") || file_name.contains("meta") {
            continue;
        }

        // Extract as media file
        let media_path = dict_media_dir.join(&file_name);
        if let Some(parent) = media_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let mut buffer = Vec::new();
        if file.read_to_end(&mut buffer).is_ok() && fs::write(&media_path, &buffer).is_ok() {
            info!("      Extracted media: {}", file_name);
        }
    }

    // Update dictionary with styles
    if let Some(styles) = styles_content {
        tx.execute(
            "UPDATE dictionaries SET styles = ? WHERE id = ?",
            rusqlite::params![styles, dict_id.0],
        )?;
        let mut dicts = state.dictionaries.write().expect("lock");
        if let Some(d) = dicts.get_mut(&dict_id) {
            d.styles = Some(styles);
        }
    }

    // 4. Scan for term banks and insert
    let file_names: Vec<String> = (0..zip.len())
        .filter_map(|i| {
            zip.by_index(i).ok().and_then(|f| {
                let name = f.name().to_string();
                if should_skip_file(&name) {
                    None
                } else {
                    Some(name)
                }
            })
        })
        .collect();

    let mut terms_found = 0usize;
    let mut encoder = snap::raw::Encoder::new();

    for name in &file_names {
        if name.contains("term_bank") && !name.contains("term_meta") && name.ends_with(".json") {
            info!("   -> Processing definitions: {}", name);

            let parse_result = (|| -> Result<usize> {
                let mut file = match open_zip_file_safe(&mut zip, name) {
                    Some(f) => f,
                    None => return Ok(0),
                };

                let mut stmt =
                    tx.prepare("INSERT INTO terms (term, dictionary_id, json) VALUES (?, ?, ?)")?;

                let rows = parse_json_array_stream::<_, Vec<Value>, _>(&mut file, |arr| {
                    if arr.len() < 8 {
                        return Ok(());
                    }

                    let headword = arr.first().and_then(|v| v.as_str()).unwrap_or("");
                    let reading = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
                    if headword.is_empty() {
                        return Ok(());
                    }

                    let mut definition_tags = Vec::new();
                    let mut term_tags = Vec::new();
                    let mut seen_tags = HashSet::new();
                    parse_space_separated_tags(&arr, 2, &mut definition_tags, &mut seen_tags);
                    parse_space_separated_tags(&arr, 7, &mut term_tags, &mut seen_tags);

                    let mut content_list = Vec::new();
                    if let Some(defs) = arr.get(5).and_then(|v| v.as_array()) {
                        for d in defs {
                            if let Some(str_def) = d.as_str() {
                                content_list.push(structured::Content::String(str_def.to_string()));
                            } else if d.is_object() || d.is_array() {
                                let json_str = serde_json::to_string(d).unwrap_or_default();
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

                    let json_bytes = serde_json::to_vec(&stored)?;
                    let compressed = encoder.compress_vec(&json_bytes)?;

                    stmt.execute(rusqlite::params![headword, dict_id.0, compressed])?;
                    bump_term_count(&mut terms_found)?;

                    if let Some(r) = stored_reading {
                        stmt.execute(rusqlite::params![r, dict_id.0, compressed])?;
                        bump_term_count(&mut terms_found)?;
                    }

                    Ok(())
                })?;

                Ok(rows)
            })();

            let rows = match parse_result {
                Ok(count) => count,
                Err(e) => {
                    let error_str = format!("{e:?}");
                    if error_str.contains("checksum")
                        || error_str.contains("CRC")
                        || error_str.contains("InvalidArchive")
                    {
                        warn!(
                            "Term bank file had checksum error but data was read successfully: {}",
                            name
                        );
                        continue;
                    } else {
                        return Err(e);
                    }
                }
            };

            if rows > 0 {
                info!("      Parsed {} term rows from {}", rows, name);
            }
        }
        // Branch 2: Metadata / frequencies / pitch / IPA (term_meta_bank)
        else if name.contains("term_meta_bank") && name.ends_with(".json") {
            info!("   -> Processing metadata: {}", name);

            let parse_result = (|| -> Result<usize> {
                let mut file = match open_zip_file_safe(&mut zip, name) {
                    Some(f) => f,
                    None => return Ok(0),
                };

                let mut stmt =
                    tx.prepare("INSERT INTO terms (term, dictionary_id, json) VALUES (?, ?, ?)")?;

                let rows = parse_json_array_stream::<_, Vec<Value>, _>(&mut file, |arr| {
                    if arr.len() < 3 {
                        return Ok(());
                    }

                    let term = arr.first().and_then(|v| v.as_str()).unwrap_or("");
                    let mode = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
                    if term.is_empty() || !["freq", "pitch", "ipa"].contains(&mode) {
                        return Ok(());
                    }

                    let data_blob = arr.get(2).cloned().unwrap_or(Value::Null);

                    let (content_str, specific_reading) = match mode {
                        "freq" => {
                            let (display_val, reading) = parse_frequency_value(&data_blob);
                            let content = if let Some(ref r) = reading {
                                if r != term {
                                    format!("Frequency: {display_val} ({r})")
                                } else {
                                    format!("Frequency: {display_val}")
                                }
                            } else {
                                format!("Frequency: {display_val}")
                            };
                            (content, reading)
                        }
                        "pitch" => parse_pitch_meta(&data_blob),
                        "ipa" => parse_ipa_meta(&data_blob),
                        _ => return Ok(()),
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
                        reading: specific_reading.clone(),
                        headword: Some(term.to_string()),
                    };

                    let json_bytes = serde_json::to_vec(&stored)?;
                    let compressed = encoder.compress_vec(&json_bytes)?;

                    stmt.execute(rusqlite::params![term, dict_id.0, compressed])?;
                    bump_term_count(&mut terms_found)?;

                    if let Some(r) = &specific_reading
                        && r != term
                    {
                        stmt.execute(rusqlite::params![r, dict_id.0, compressed])?;
                        bump_term_count(&mut terms_found)?;
                    }

                    Ok(())
                })?;

                Ok(rows)
            })();

            let rows = match parse_result {
                Ok(count) => count,
                Err(e) => {
                    let error_str = format!("{e:?}");
                    if error_str.contains("checksum")
                        || error_str.contains("CRC")
                        || error_str.contains("InvalidArchive")
                    {
                        warn!(
                            "Metadata file had checksum error but data was read successfully: {}",
                            name
                        );
                        continue;
                    } else {
                        return Err(e);
                    }
                }
            };

            if rows > 0 {
                info!("      Parsed {} metadata rows from {}", rows, name);
            }
        }
        // Branch 3: Kanji bank (kanji_bank_*.json) - insert into terms table like pitch/freq
        else if name.contains("kanji_bank") && name.ends_with(".json") {
            let parse_result = (|| -> Result<usize> {
                let mut file = match open_zip_file_safe(&mut zip, name) {
                    Some(f) => f,
                    None => return Ok(0),
                };

                let mut stmt = tx.prepare(
                    "INSERT OR REPLACE INTO kanji (character, dictionary_id, onyomi, kunyomi, tags, meanings, stats) VALUES (?, ?, ?, ?, ?, ?, ?)"
                )?;

                let mut count = 0usize;

                let _rows = parse_json_array_stream::<_, Vec<Value>, _>(&mut file, |arr| {
                    if arr.len() < 6 {
                        return Ok(());
                    }

                    let character = arr.first().and_then(|v| v.as_str()).unwrap_or("");
                    // Use char count, not byte count - UTF-8 kanji are 3 bytes
                    if character.chars().count() != 1 {
                        return Ok(());
                    }

                    let onyomi = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
                    let kunyomi = arr.get(2).and_then(|v| v.as_str()).unwrap_or("");
                    let tags = arr.get(3).and_then(|v| v.as_str()).unwrap_or("");
                    let meanings = arr
                        .get(4)
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
                        .unwrap_or_default();
                    let stats = arr.get(5).and_then(|v| v.as_object());

                    let meanings_json = serde_json::to_string(&meanings).unwrap_or_default();
                    let stats_json = stats.map(|s| serde_json::to_string(s).unwrap_or_default()).unwrap_or_default();

                    stmt.execute(rusqlite::params![
                        character,
                        dict_id.0,
                        onyomi,
                        kunyomi,
                        tags,
                        meanings_json,
                        stats_json
                    ])?;

                    count += 1;
                    Ok(())
                })?;

                Ok(count)
            })();

            let rows = match parse_result {
                Ok(count) => count,
                Err(e) => {
                    let error_str = format!("{e:?}");
                    if error_str.contains("checksum")
                        || error_str.contains("CRC")
                        || error_str.contains("InvalidArchive")
                    {
                        warn!(
                            "Kanji bank file had checksum error but data was read successfully: {}",
                            name
                        );
                        continue;
                    } else {
                        return Err(e);
                    }
                }
            };

            if rows > 0 {
                info!("      Parsed {} kanji from {}", rows, name);
            }
        }
        // Branch 4: Kanji metadata (kanji_meta_bank_*.json) - insert as freq like term_meta
        else if name.contains("kanji_meta_bank") && name.ends_with(".json") {
            info!("   -> Processing kanji metadata: {}", name);

            let parse_result = (|| -> Result<usize> {
                let mut file = match open_zip_file_safe(&mut zip, name) {
                    Some(f) => f,
                    None => return Ok(0),
                };

                let mut stmt =
                    tx.prepare("INSERT INTO terms (term, dictionary_id, json) VALUES (?, ?, ?)")?;

                let rows = parse_json_array_stream::<_, Vec<Value>, _>(&mut file, |arr| {
                    if arr.len() < 3 {
                        return Ok(());
                    }

                    let character = arr.first().and_then(|v| v.as_str()).unwrap_or("");
                    if character.is_empty() {
                        return Ok(());
                    }

                    let meta_type = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
                    if meta_type.is_empty() || meta_type != "freq" {
                        return Ok(());
                    }

                    let data_blob = arr.get(2).cloned().unwrap_or(Value::Null);
                    let (display_val, _) = parse_frequency_value(&data_blob);
                    let content = format!("Frequency: {display_val}");

                    let record = Record::YomitanGlossary(Glossary {
                        popularity: 0,
                        tags: vec![],
                        content: vec![structured::Content::String(content)],
                    });

                    let stored = StoredRecord {
                        dictionary_id: dict_id,
                        record,
                        term_tags: None,
                        reading: None,
                        headword: Some(character.to_string()),
                    };

                    let json_bytes = serde_json::to_vec(&stored)?;
                    let compressed = encoder.compress_vec(&json_bytes)?;

                    stmt.execute(rusqlite::params![character, dict_id.0, compressed])?;
                    bump_term_count(&mut terms_found)?;

                    Ok(())
                })?;

                Ok(rows)
            })();

            let rows = match parse_result {
                Ok(count) => count,
                Err(e) => {
                    let error_str = format!("{e:?}");
                    if error_str.contains("checksum")
                        || error_str.contains("CRC")
                        || error_str.contains("InvalidArchive")
                    {
                        warn!(
                            "Kanji metadata file had checksum error but data was read successfully: {}",
                            name
                        );
                        continue;
                    } else {
                        return Err(e);
                    }
                }
            };

            if rows > 0 {
                info!("      Parsed {} kanji metadata rows from {}", rows, name);
            }
        }
    }

    tx.commit()?;
    info!(
        "💾 [Import] Database transaction committed. Total Terms: {}",
        terms_found
    );

    Ok(format!("Imported '{dict_name}'"))
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        io::Write,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

    use super::*;

    fn test_data_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "manatan-yomitan-import-test-{name}-{}-{nanos}",
            std::process::id()
        ))
    }

    fn build_zip(index_json: &str, entries: &[(&str, &str)]) -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut bytes);
            let mut zip = ZipWriter::new(cursor);
            let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

            zip.start_file("index.json", opts).expect("start index");
            zip.write_all(index_json.as_bytes()).expect("write index");

            for (name, contents) in entries {
                zip.start_file(name, opts).expect("start file");
                zip.write_all(contents.as_bytes()).expect("write file");
            }

            zip.finish().expect("finish zip");
        }
        bytes
    }

    fn with_state<T>(name: &str, f: impl FnOnce(&AppState) -> T) -> T {
        let dir = test_data_dir(name);
        let state = AppState::new(dir.clone());
        let out = f(&state);
        drop(state);
        let _ = fs::remove_dir_all(dir);
        out
    }

    #[test]
    fn imports_minimal_v3_dictionary() {
        with_state("imports-minimal", |state| {
            let zip = build_zip(
                r#"{"format":3,"title":"Test Dict","revision":"1","description":"desc"}"#,
                &[(
                    "term_bank_1.json",
                    r#"[["猫","ねこ","n",null,100,["cat"],0,"common"]]"#,
                )],
            );

            let msg = import_zip(state, &zip).expect("import should succeed");
            assert!(msg.contains("Imported 'Test Dict'"));

            let conn = state.pool.get().expect("db connection");
            let dict_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM dictionaries", [], |row| row.get(0))
                .expect("dict count query");
            let term_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM terms", [], |row| row.get(0))
                .expect("term count query");

            assert_eq!(dict_count, 1);
            assert_eq!(term_count, 2, "headword + reading should be indexed");
        });
    }

    #[test]
    fn rejects_duplicate_dictionary_name() {
        with_state("duplicate-name", |state| {
            let zip = build_zip(
                r#"{"format":3,"title":"Duplicate Dict","revision":"1"}"#,
                &[(
                    "term_bank_1.json",
                    r#"[["猫","ねこ","",null,1,["cat"],0,""]]"#,
                )],
            );

            import_zip(state, &zip).expect("first import should succeed");
            let err = import_zip(state, &zip).expect_err("duplicate import should fail");
            assert!(err.to_string().contains("already imported"));
        });
    }

    #[test]
    fn rejects_non_v3_dictionary_format() {
        with_state("non-v3", |state| {
            let zip = build_zip(
                r#"{"format":2,"title":"Old Dict"}"#,
                &[(
                    "term_bank_1.json",
                    r#"[["猫","ねこ","",null,1,["cat"],0,""]]"#,
                )],
            );

            let err = import_zip(state, &zip).expect_err("non-v3 should fail");
            assert!(
                err.to_string()
                    .contains("Unsupported dictionary format version")
            );
        });
    }

    #[test]
    fn rejects_archive_over_size_limit() {
        with_state("archive-too-large", |state| {
            let too_large = vec![0_u8; MAX_IMPORT_ARCHIVE_BYTES + 1];
            let err = import_zip(state, &too_large).expect_err("oversized archive should fail");
            assert!(err.to_string().contains("Archive is too large"));
        });
    }
}
