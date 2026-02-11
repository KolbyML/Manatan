use std::{
    collections::HashSet,
    fmt,
    io::Read,
    marker::PhantomData,
};

use anyhow::{Result, anyhow};
use serde::de::{DeserializeOwned, DeserializeSeed, SeqAccess, Visitor};
use serde_json::Value;
use tracing::info;
use wordbase_api::{
    DictionaryId, DictionaryKind, DictionaryMeta, Record,
    dict::yomitan::{Glossary, GlossaryTag, structured},
};
use zip::ZipArchive;

use crate::state::{AppState, DictionaryData, StoredRecord};

#[cfg(test)]
const MAX_IMPORT_ARCHIVE_BYTES: usize = 2 * 1024 * 1024;
#[cfg(not(test))]
const MAX_IMPORT_ARCHIVE_BYTES: usize = 384 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_JSON_ENTRY_BYTES: u64 = 192 * 1024 * 1024;
const MAX_INDEX_JSON_BYTES: u64 = 4 * 1024 * 1024;
const MAX_ZIP_ENTRY_COUNT: usize = 1024;
const MAX_COMPRESSION_RATIO: u64 = 300;
const MAX_TERMS_INSERTED: usize = 8_000_000;

fn read_limited_string<R: Read>(reader: R, byte_limit: u64, label: &str) -> Result<String> {
    let mut limited_reader = reader.take(byte_limit.saturating_add(1));
    let mut buf = Vec::new();
    limited_reader.read_to_end(&mut buf)?;

    if (buf.len() as u64) > byte_limit {
        return Err(anyhow!(
            "{} exceeds size limit ({} bytes)",
            label,
            byte_limit
        ));
    }

    String::from_utf8(buf).map_err(|err| anyhow!("{} is not valid UTF-8: {}", label, err))
}

fn validate_zip_archive<R: Read + std::io::Seek>(zip: &mut ZipArchive<R>) -> Result<()> {
    if zip.len() > MAX_ZIP_ENTRY_COUNT {
        return Err(anyhow!(
            "Archive contains too many entries ({}, max {}).",
            zip.len(),
            MAX_ZIP_ENTRY_COUNT
        ));
    }

    let mut total_uncompressed = 0u64;
    for i in 0..zip.len() {
        let file = zip.by_index(i)?;
        if file.is_dir() {
            continue;
        }

        let size = file.size();
        let compressed_size = file.compressed_size();

        total_uncompressed = total_uncompressed.saturating_add(size);
        if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES {
            return Err(anyhow!(
                "Archive uncompressed size exceeds limit ({} bytes).",
                MAX_TOTAL_UNCOMPRESSED_BYTES
            ));
        }

        if file.name().ends_with(".json") && size > MAX_JSON_ENTRY_BYTES {
            return Err(anyhow!(
                "JSON entry '{}' is too large ({} bytes, max {}).",
                file.name(),
                size,
                MAX_JSON_ENTRY_BYTES
            ));
        }

        if compressed_size > 0 {
            let ratio = size / compressed_size;
            if ratio > MAX_COMPRESSION_RATIO {
                return Err(anyhow!(
                    "Archive entry '{}' looks suspicious (compression ratio {}).",
                    file.name(),
                    ratio
                ));
            }
        }
    }

    Ok(())
}

fn bump_term_count(terms_found: &mut usize) -> Result<()> {
    *terms_found += 1;
    if *terms_found > MAX_TERMS_INSERTED {
        return Err(anyhow!(
            "Dictionary exceeds safe import limit ({} records).",
            MAX_TERMS_INSERTED
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
            "Archive is too large ({} bytes, max {}).",
            data.len(),
            MAX_IMPORT_ARCHIVE_BYTES
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
            && file.name().ends_with("index.json")
        {
            index_file_name = Some(file.name().to_string());
            break;
        }
    }

    let index_file_name =
        index_file_name.ok_or_else(|| anyhow!("No index.json found in zip"))?;

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
            return Err(anyhow!(format!(
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
            },
        );
    }

    // 4. Scan for term banks and insert
    let file_names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();

    let mut terms_found = 0usize;
    let mut encoder = snap::raw::Encoder::new();

    for name in &file_names {
        // Branch 1: Standard definitions (term_bank)
        if name.contains("term_bank") && !name.contains("term_meta") && name.ends_with(".json") {
            info!("   -> Processing definitions: {}", name);
            let mut file = zip.by_name(name)?;

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

            info!("      Parsed {} term rows from {}", rows, name);
        }
        // Branch 2: Metadata / frequencies (term_meta_bank)
        else if name.contains("term_meta_bank") && name.ends_with(".json") {
            info!("   -> Processing metadata: {}", name);
            let mut file = zip.by_name(name)?;

            let mut stmt =
                tx.prepare("INSERT INTO terms (term, dictionary_id, json) VALUES (?, ?, ?)")?;

            let rows = parse_json_array_stream::<_, Vec<Value>, _>(&mut file, |arr| {
                if arr.len() < 3 {
                    return Ok(());
                }

                let term = arr.first().and_then(|v| v.as_str()).unwrap_or("");
                let mode = arr.get(1).and_then(|v| v.as_str()).unwrap_or("");
                if term.is_empty() || mode != "freq" {
                    return Ok(());
                }

                let data_blob = arr.get(2).cloned().unwrap_or(Value::Null);
                let (display_val, specific_reading) = parse_frequency_value(&data_blob);

                let content_str = if let Some(read) = &specific_reading {
                    if read != term {
                        format!("Frequency: {} ({})", display_val, read)
                    } else {
                        format!("Frequency: {}", display_val)
                    }
                } else {
                    format!("Frequency: {}", display_val)
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

            info!("      Parsed {} metadata rows from {}", rows, name);
        }
    }

    tx.commit()?;
    info!(
        "💾 [Import] Database transaction committed. Total Terms: {}",
        terms_found
    );

    Ok(format!("Imported '{}'", dict_name))
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
            "manatan-yomitan-import-test-{}-{}-{}",
            name,
            std::process::id(),
            nanos
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
            assert!(err.to_string().contains("Unsupported dictionary format version"));
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
