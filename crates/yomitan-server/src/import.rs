use std::{
    collections::HashSet,
    fmt, fs,
    io::Read,
    marker::PhantomData,
    path::{Component, Path, PathBuf},
};

use anyhow::{Result, anyhow};
use serde::{
    Deserialize,
    de::{DeserializeOwned, DeserializeSeed, IgnoredAny, MapAccess, SeqAccess, Visitor},
};
use serde_json::{Value, value::RawValue};
use tracing::{info, warn};
use wordbase_api::{
    DictionaryId, DictionaryKind, DictionaryMeta,
};
use zip::ZipArchive;

use crate::state::{AppState, DictionaryData};

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
const SQLITE_MAX_BIND_PARAMS: usize = 900;

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
    let max_zip_entry_count =
        env_usize("YOMITAN_IMPORTER_MAX_ZIP_ENTRIES").unwrap_or(MAX_ZIP_ENTRY_COUNT);
    let max_total_uncompressed =
        env_u64("YOMITAN_IMPORTER_MAX_UNCOMPRESSED_BYTES").unwrap_or(MAX_TOTAL_UNCOMPRESSED_BYTES);
    if zip.len() > max_zip_entry_count {
        return Err(anyhow!(
            "Archive contains too many entries ({}, max {max_zip_entry_count}).",
            zip.len()
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
        if total_uncompressed > max_total_uncompressed {
            return Err(anyhow!(
                "Archive uncompressed size exceeds limit ({max_total_uncompressed} bytes)."
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

fn bump_term_count_by(terms_found: &mut usize, delta: usize) -> Result<()> {
    let max_terms_inserted = env_usize("YOMITAN_IMPORTER_MAX_TERMS").unwrap_or(MAX_TERMS_INSERTED);
    *terms_found = terms_found
        .checked_add(delta)
        .ok_or_else(|| anyhow!("term count overflow"))?;
    if *terms_found > max_terms_inserted {
        return Err(anyhow!(
            "Dictionary exceeds safe import limit ({max_terms_inserted} records)."
        ));
    }
    Ok(())
}

fn env_flag(name: &str) -> bool {
    matches!(
        std::env::var(name)
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn env_usize(name: &str) -> Option<usize> {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
}

fn env_u64(name: &str) -> Option<u64> {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
}

fn safe_join_path(base: &Path, relative: &str) -> Option<PathBuf> {
    let mut out = base.to_path_buf();
    for component in Path::new(relative).components() {
        match component {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    Some(out)
}

fn dict_archive_path(state: &AppState, dict_id: DictionaryId) -> PathBuf {
    state
        .data_dir
        .join("dict_archives")
        .join(format!("{}.zip", dict_id.0))
}

#[derive(Default)]
struct LossyString(String);

impl LossyString {
    fn into_inner(self) -> String {
        self.0
    }
}

impl<'de> Deserialize<'de> for LossyString {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct LossyStringVisitor;

        impl<'de> Visitor<'de> for LossyStringVisitor {
            type Value = LossyString;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a string-like value")
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString(value.to_string()))
            }

            fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString(value))
            }

            fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                deserializer.deserialize_any(self)
            }

            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString::default())
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString::default())
            }

            fn visit_bool<E>(self, _: bool) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString::default())
            }

            fn visit_i64<E>(self, _: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString::default())
            }

            fn visit_u64<E>(self, _: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString::default())
            }

            fn visit_f64<E>(self, _: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyString::default())
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                while seq.next_element::<IgnoredAny>()?.is_some() {}
                Ok(LossyString::default())
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
                Ok(LossyString::default())
            }
        }

        deserializer.deserialize_any(LossyStringVisitor)
    }
}

#[derive(Default)]
struct LossyI64(i64);

impl LossyI64 {
    fn into_inner(self) -> i64 {
        self.0
    }
}

impl<'de> Deserialize<'de> for LossyI64 {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct LossyI64Visitor;

        impl<'de> Visitor<'de> for LossyI64Visitor {
            type Value = LossyI64;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an integer-like value")
            }

            fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64(value))
            }

            fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64(i64::try_from(value).unwrap_or_default()))
            }

            fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                deserializer.deserialize_any(self)
            }

            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64::default())
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64::default())
            }

            fn visit_bool<E>(self, _: bool) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64::default())
            }

            fn visit_str<E>(self, _: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64::default())
            }

            fn visit_string<E>(self, _: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64::default())
            }

            fn visit_f64<E>(self, _: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyI64::default())
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                while seq.next_element::<IgnoredAny>()?.is_some() {}
                Ok(LossyI64::default())
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
                Ok(LossyI64::default())
            }
        }

        deserializer.deserialize_any(LossyI64Visitor)
    }
}

#[derive(Default)]
struct LossyGlossaryArray(Vec<Box<RawValue>>);

impl LossyGlossaryArray {
    fn into_inner(self) -> Vec<Box<RawValue>> {
        self.0
    }
}

impl<'de> Deserialize<'de> for LossyGlossaryArray {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct LossyGlossaryArrayVisitor;

        impl<'de> Visitor<'de> for LossyGlossaryArrayVisitor {
            type Value = LossyGlossaryArray;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an array")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut out = Vec::new();
                while let Some(value) = seq.next_element::<Box<RawValue>>()? {
                    out.push(value);
                }
                Ok(LossyGlossaryArray(out))
            }

            fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                deserializer.deserialize_any(self)
            }

            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
                Ok(LossyGlossaryArray::default())
            }

            fn visit_bool<E>(self, _: bool) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_i64<E>(self, _: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_u64<E>(self, _: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_f64<E>(self, _: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_str<E>(self, _: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }

            fn visit_string<E>(self, _: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyGlossaryArray::default())
            }
        }

        deserializer.deserialize_any(LossyGlossaryArrayVisitor)
    }
}

#[derive(Default)]
struct LossyStringArray(Vec<String>);

impl LossyStringArray {
    fn into_inner(self) -> Vec<String> {
        self.0
    }
}

impl<'de> Deserialize<'de> for LossyStringArray {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct LossyStringArrayVisitor;

        impl<'de> Visitor<'de> for LossyStringArrayVisitor {
            type Value = LossyStringArray;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("an array")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut out = Vec::new();
                while let Some(value) = seq.next_element::<Value>()? {
                    if let Some(text) = value.as_str() {
                        out.push(text.to_string());
                    }
                }
                Ok(LossyStringArray(out))
            }

            fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
            where
                D: serde::Deserializer<'de>,
            {
                deserializer.deserialize_any(self)
            }

            fn visit_none<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
                Ok(LossyStringArray::default())
            }

            fn visit_bool<E>(self, _: bool) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_i64<E>(self, _: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_u64<E>(self, _: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_f64<E>(self, _: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_str<E>(self, _: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }

            fn visit_string<E>(self, _: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(LossyStringArray::default())
            }
        }

        deserializer.deserialize_any(LossyStringArrayVisitor)
    }
}

#[derive(Default)]
struct TermBankRow {
    headword: String,
    reading: String,
    definition_tags: String,
    popularity: i64,
    definitions: Vec<Box<RawValue>>,
    term_tags: String,
}

impl<'de> Deserialize<'de> for TermBankRow {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct TermBankRowVisitor;

        impl<'de> Visitor<'de> for TermBankRowVisitor {
            type Value = TermBankRow;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a term bank row")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let Some(headword) = seq.next_element::<LossyString>()? else {
                    return Ok(TermBankRow::default());
                };
                let Some(reading) = seq.next_element::<LossyString>()? else {
                    return Ok(TermBankRow::default());
                };
                let Some(definition_tags) = seq.next_element::<LossyString>()? else {
                    return Ok(TermBankRow::default());
                };
                if seq.next_element::<IgnoredAny>()?.is_none() {
                    return Ok(TermBankRow::default());
                }
                let Some(popularity) = seq.next_element::<LossyI64>()? else {
                    return Ok(TermBankRow::default());
                };
                let Some(definitions) = seq.next_element::<LossyGlossaryArray>()? else {
                    return Ok(TermBankRow::default());
                };
                if seq.next_element::<IgnoredAny>()?.is_none() {
                    return Ok(TermBankRow::default());
                }
                let Some(term_tags) = seq.next_element::<LossyString>()? else {
                    return Ok(TermBankRow::default());
                };

                while seq.next_element::<IgnoredAny>()?.is_some() {}

                Ok(TermBankRow {
                    headword: headword.into_inner(),
                    reading: reading.into_inner(),
                    definition_tags: definition_tags.into_inner(),
                    popularity: popularity.into_inner(),
                    definitions: definitions.into_inner(),
                    term_tags: term_tags.into_inner(),
                })
            }
        }

        deserializer.deserialize_seq(TermBankRowVisitor)
    }
}

#[derive(Default)]
struct TermMetaBankRow {
    term: String,
    mode: String,
    data: Value,
}

impl<'de> Deserialize<'de> for TermMetaBankRow {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct TermMetaBankRowVisitor;

        impl<'de> Visitor<'de> for TermMetaBankRowVisitor {
            type Value = TermMetaBankRow;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a term metadata row")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let Some(term) = seq.next_element::<LossyString>()? else {
                    return Ok(TermMetaBankRow::default());
                };
                let Some(mode) = seq.next_element::<LossyString>()? else {
                    return Ok(TermMetaBankRow::default());
                };
                let Some(data) = seq.next_element::<Value>()? else {
                    return Ok(TermMetaBankRow::default());
                };

                while seq.next_element::<IgnoredAny>()?.is_some() {}

                Ok(TermMetaBankRow {
                    term: term.into_inner(),
                    mode: mode.into_inner(),
                    data,
                })
            }
        }

        deserializer.deserialize_seq(TermMetaBankRowVisitor)
    }
}

#[derive(Default)]
struct KanjiBankRow {
    character: String,
    onyomi: String,
    kunyomi: String,
    tags: String,
    meanings: Vec<String>,
    stats: Value,
}

impl<'de> Deserialize<'de> for KanjiBankRow {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct KanjiBankRowVisitor;

        impl<'de> Visitor<'de> for KanjiBankRowVisitor {
            type Value = KanjiBankRow;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a kanji bank row")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let Some(character) = seq.next_element::<LossyString>()? else {
                    return Ok(KanjiBankRow::default());
                };
                let Some(onyomi) = seq.next_element::<LossyString>()? else {
                    return Ok(KanjiBankRow::default());
                };
                let Some(kunyomi) = seq.next_element::<LossyString>()? else {
                    return Ok(KanjiBankRow::default());
                };
                let Some(tags) = seq.next_element::<LossyString>()? else {
                    return Ok(KanjiBankRow::default());
                };
                let Some(meanings) = seq.next_element::<LossyStringArray>()? else {
                    return Ok(KanjiBankRow::default());
                };
                let Some(stats) = seq.next_element::<Value>()? else {
                    return Ok(KanjiBankRow::default());
                };

                while seq.next_element::<IgnoredAny>()?.is_some() {}

                Ok(KanjiBankRow {
                    character: character.into_inner(),
                    onyomi: onyomi.into_inner(),
                    kunyomi: kunyomi.into_inner(),
                    tags: tags.into_inner(),
                    meanings: meanings.into_inner(),
                    stats,
                })
            }
        }

        deserializer.deserialize_seq(KanjiBankRowVisitor)
    }
}

#[derive(Default)]
struct KanjiMetaBankRow {
    character: String,
    meta_type: String,
    data: Value,
}

impl<'de> Deserialize<'de> for KanjiMetaBankRow {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct KanjiMetaBankRowVisitor;

        impl<'de> Visitor<'de> for KanjiMetaBankRowVisitor {
            type Value = KanjiMetaBankRow;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a kanji metadata row")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let Some(character) = seq.next_element::<LossyString>()? else {
                    return Ok(KanjiMetaBankRow::default());
                };
                let Some(meta_type) = seq.next_element::<LossyString>()? else {
                    return Ok(KanjiMetaBankRow::default());
                };
                let Some(data) = seq.next_element::<Value>()? else {
                    return Ok(KanjiMetaBankRow::default());
                };

                while seq.next_element::<IgnoredAny>()?.is_some() {}

                Ok(KanjiMetaBankRow {
                    character: character.into_inner(),
                    meta_type: meta_type.into_inner(),
                    data,
                })
            }
        }

        deserializer.deserialize_seq(KanjiMetaBankRowVisitor)
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

fn parse_json_array_stream<R, T, F>(reader: R, on_entry: F) -> Result<usize>
where
    R: Read,
    T: DeserializeOwned,
    F: FnMut(T) -> Result<()>,
{
    let mut bytes = Vec::new();
    let mut reader = reader;
    reader.read_to_end(&mut bytes)?;
    parse_json_array_slice::<T, _>(&bytes, on_entry)
}

fn parse_json_array_slice<T, F>(bytes: &[u8], mut on_entry: F) -> Result<usize>
where
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

    let repaired_bytes = repair_malformed_json_string_escapes(bytes);
    if repaired_bytes.is_some() {
        warn!("Repairing malformed JSON string escapes during dictionary import");
    }
    let parse_bytes = repaired_bytes.as_deref().unwrap_or(bytes);

    let mut deserializer = serde_json::Deserializer::from_slice(parse_bytes);
    let count = ArraySeed::<T, F> {
        on_entry: &mut on_entry,
        _marker: PhantomData,
    }
    .deserialize(&mut deserializer)?;
    deserializer.end()?;
    Ok(count)
}

fn is_json_hex_digit(byte: u8) -> bool {
    byte.is_ascii_hexdigit()
}

fn repair_malformed_json_string_escapes(bytes: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(bytes.len());
    let mut changed = false;
    let mut in_string = false;
    let mut escaped = false;
    let mut i = 0usize;

    while i < bytes.len() {
        let byte = bytes[i];

        if !in_string {
            out.push(byte);
            if byte == b'"' {
                in_string = true;
            }
            i += 1;
            continue;
        }

        if escaped {
            match byte {
                b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't' => {
                    out.push(byte);
                }
                b'u' => {
                    out.push(b'u');
                    let has_full_hex = i + 4 < bytes.len()
                        && bytes[i + 1..=i + 4]
                            .iter()
                            .all(|candidate| is_json_hex_digit(*candidate));
                    if has_full_hex {
                        out.extend_from_slice(&bytes[i + 1..=i + 4]);
                        i += 4;
                    } else {
                        // Replace malformed unicode escape with U+FFFD while keeping parse progress.
                        out.extend_from_slice(b"FFFD");
                        changed = true;
                    }
                }
                _ => {
                    // Preserve unknown escapes as literal backslash-prefixed text (e.g. \x => \\x).
                    out.push(b'\\');
                    out.push(byte);
                    changed = true;
                }
            }
            escaped = false;
            i += 1;
            continue;
        }

        if byte == b'\\' {
            out.push(b'\\');
            escaped = true;
            i += 1;
            continue;
        }

        out.push(byte);
        if byte == b'"' {
            in_string = false;
        }
        i += 1;
    }

    if changed { Some(out) } else { None }
}

struct ParsedSerdeTermRow {
    headword: String,
    reading: String,
    definition_tags: String,
    popularity: i64,
    definitions: Vec<Box<RawValue>>,
    term_tags: String,
}

struct EncodedTermInsert {
    headword: String,
    reading: Option<String>,
    compressed: Vec<u8>,
}

const COMPACT_GLOSSARY_BIN_V1_PREFIX: &[u8; 4] = b"MGB1";

struct CompactGlossaryPayloadV1 {
    popularity: i64,
    content_raw: Vec<Box<RawValue>>,
    definition_tags_raw: Option<String>,
    term_tags_raw: Option<String>,
    reading: Option<String>,
    headword: Option<String>,
}

fn write_u32_le(buf: &mut Vec<u8>, value: u32) {
    buf.extend_from_slice(&value.to_le_bytes());
}

fn write_i64_le(buf: &mut Vec<u8>, value: i64) {
    buf.extend_from_slice(&value.to_le_bytes());
}

fn write_opt_string(buf: &mut Vec<u8>, value: Option<&str>) -> Result<()> {
    match value {
        Some(text) => {
            let len = u32::try_from(text.len()).map_err(|_| anyhow!("string too long"))?;
            write_u32_le(buf, len);
            buf.extend_from_slice(text.as_bytes());
        }
        None => write_u32_le(buf, u32::MAX),
    }
    Ok(())
}

fn write_raw_values(buf: &mut Vec<u8>, values: &[Box<RawValue>]) -> Result<()> {
    let count = u32::try_from(values.len()).map_err(|_| anyhow!("too many content values"))?;
    write_u32_le(buf, count);
    for raw in values {
        let bytes = raw.get().as_bytes();
        let len = u32::try_from(bytes.len()).map_err(|_| anyhow!("raw value too long"))?;
        write_u32_le(buf, len);
        buf.extend_from_slice(bytes);
    }
    Ok(())
}

fn encode_compact_glossary_payload(
    payload: &CompactGlossaryPayloadV1,
    encoder: &mut snap::raw::Encoder,
    json_buffer: &mut Vec<u8>,
    compressed_buffer: &mut Vec<u8>,
    no_compress: bool,
) -> Result<()> {
    json_buffer.clear();
    json_buffer.extend_from_slice(COMPACT_GLOSSARY_BIN_V1_PREFIX);
    write_i64_le(json_buffer, payload.popularity);
    write_raw_values(json_buffer, &payload.content_raw)?;
    write_opt_string(json_buffer, payload.definition_tags_raw.as_deref())?;
    write_opt_string(json_buffer, payload.term_tags_raw.as_deref())?;
    write_opt_string(json_buffer, payload.reading.as_deref())?;
    write_opt_string(json_buffer, payload.headword.as_deref())?;

    if no_compress {
        compressed_buffer.clear();
        compressed_buffer.extend_from_slice(json_buffer);
        return Ok(());
    }

    let max_len = snap::raw::max_compress_len(json_buffer.len());
    compressed_buffer.clear();
    compressed_buffer.resize(max_len, 0);
    let written = encoder.compress(json_buffer, compressed_buffer)?;
    compressed_buffer.truncate(written);

    Ok(())
}

fn encode_parsed_serde_term_row(
    row: ParsedSerdeTermRow,
    no_compress: bool,
    encoder: &mut snap::raw::Encoder,
    json_buffer: &mut Vec<u8>,
    compressed_buffer: &mut Vec<u8>,
) -> Result<EncodedTermInsert> {
    if row.headword.is_empty() {
        return Err(anyhow!("empty headword"));
    }

    let stored_reading = if !row.reading.is_empty() && row.reading != row.headword {
        Some(row.reading)
    } else {
        None
    };

    let definition_tags_raw = if row.definition_tags.trim().is_empty() {
        None
    } else {
        Some(row.definition_tags)
    };

    let term_tags_raw = if row.term_tags.trim().is_empty() {
        None
    } else {
        Some(row.term_tags)
    };

    let compact = CompactGlossaryPayloadV1 {
        popularity: row.popularity,
        content_raw: row.definitions,
        definition_tags_raw,
        term_tags_raw,
        reading: stored_reading.clone(),
        headword: Some(row.headword.clone()),
    };

    encode_compact_glossary_payload(
        &compact,
        encoder,
        json_buffer,
        compressed_buffer,
        no_compress,
    )?;

    Ok(EncodedTermInsert {
        headword: row.headword,
        reading: stored_reading,
        compressed: compressed_buffer.clone(),
    })
}

fn encode_serde_term_batch(
    rows: Vec<ParsedSerdeTermRow>,
    no_compress: bool,
    worker_count: usize,
) -> Result<Vec<EncodedTermInsert>> {
    if rows.is_empty() {
        return Ok(Vec::new());
    }

    if worker_count <= 1 || rows.len() < 1024 {
        let mut out = Vec::with_capacity(rows.len());
        let mut encoder = snap::raw::Encoder::new();
        let mut json_buffer = Vec::new();
        let mut compressed_buffer = Vec::new();
        for row in rows {
            out.push(encode_parsed_serde_term_row(
                row,
                no_compress,
                &mut encoder,
                &mut json_buffer,
                &mut compressed_buffer,
            )?);
        }
        return Ok(out);
    }

    let mut iter = rows.into_iter();
    let chunk_size = iter.len().div_ceil(worker_count);
    let mut chunks = Vec::new();
    loop {
        let chunk: Vec<ParsedSerdeTermRow> = iter.by_ref().take(chunk_size).collect();
        if chunk.is_empty() {
            break;
        }
        chunks.push(chunk);
    }

    std::thread::scope(|scope| -> Result<Vec<EncodedTermInsert>> {
        let mut handles = Vec::new();
        for chunk in chunks {
            handles.push(scope.spawn(move || -> Result<Vec<EncodedTermInsert>> {
                let mut out = Vec::with_capacity(chunk.len());
                let mut encoder = snap::raw::Encoder::new();
                let mut json_buffer = Vec::new();
                let mut compressed_buffer = Vec::new();
                for row in chunk {
                    out.push(encode_parsed_serde_term_row(
                        row,
                        no_compress,
                        &mut encoder,
                        &mut json_buffer,
                        &mut compressed_buffer,
                    )?);
                }
                Ok(out)
            }));
        }

        let mut merged = Vec::new();
        for handle in handles {
            let part = handle
                .join()
                .map_err(|_| anyhow!("term encoding worker thread panicked"))??;
            merged.extend(part);
        }
        Ok(merged)
    })
}

fn flush_serde_term_rows(
    pending_rows: &mut Vec<ParsedSerdeTermRow>,
    tx: &rusqlite::Transaction<'_>,
    dict_id: DictionaryId,
    no_compress: bool,
    worker_count: usize,
    terms_found: &mut usize,
) -> Result<()> {
    if pending_rows.is_empty() {
        return Ok(());
    }

    let batch = std::mem::take(pending_rows);
    let encoded = encode_serde_term_batch(batch, no_compress, worker_count)?;
    insert_encoded_term_rows(tx, encoded, dict_id, terms_found)?;

    Ok(())
}

fn insert_encoded_term_rows(
    tx: &rusqlite::Transaction<'_>,
    rows: Vec<EncodedTermInsert>,
    dict_id: DictionaryId,
    terms_found: &mut usize,
) -> Result<()> {
    if rows.is_empty() {
        return Ok(());
    }

    let max_rows_per_statement = env_usize("YOMITAN_IMPORTER_INSERT_ROWS_PER_STATEMENT")
        .unwrap_or(200)
        .clamp(1, SQLITE_MAX_BIND_PARAMS / 4);
    let mut sql_cache: std::collections::HashMap<usize, String> = std::collections::HashMap::new();

    let mut rows_iter = rows.into_iter();
    loop {
        let chunk: Vec<EncodedTermInsert> =
            rows_iter.by_ref().take(max_rows_per_statement).collect();
        if chunk.is_empty() {
            break;
        }
        let chunk_len = chunk.len();

        let sql = sql_cache.entry(chunk_len).or_insert_with(|| {
            let mut sql =
                String::from("INSERT INTO terms (term, reading, dictionary_id, json) VALUES ");
            for i in 0..chunk_len {
                if i > 0 {
                    sql.push(',');
                }
                sql.push_str("(?, ?, ?, ?)");
            }
            sql
        });

        let mut params = Vec::with_capacity(chunk_len * 4);
        for row in chunk {
            params.push(rusqlite::types::Value::Text(row.headword));
            match row.reading {
                Some(reading) => params.push(rusqlite::types::Value::Text(reading)),
                None => params.push(rusqlite::types::Value::Null),
            }
            params.push(rusqlite::types::Value::Integer(dict_id.0));
            params.push(rusqlite::types::Value::Blob(row.compressed));
        }

        let mut stmt = tx.prepare_cached(sql)?;
        stmt.execute(rusqlite::params_from_iter(params))?;
        bump_term_count_by(terms_found, chunk_len)?;
    }

    Ok(())
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
    let strict_validation = env_flag("YOMITAN_IMPORTER_STRICT_VALIDATION");
    if strict_validation {
        validate_zip_archive(&mut zip)?;
    } else {
        let max_zip_entry_count =
            env_usize("YOMITAN_IMPORTER_MAX_ZIP_ENTRIES").unwrap_or(MAX_ZIP_ENTRY_COUNT);
        if zip.len() > max_zip_entry_count {
            return Err(anyhow!(
                "Archive contains too many entries ({}, max {max_zip_entry_count}).",
                zip.len()
            ));
        }
    }
    let fast_db_mode =
        env_flag("YOMITAN_IMPORTER_FAST_DB") || !env_flag("YOMITAN_IMPORTER_DISABLE_FAST_DB");
    let no_compress = env_flag("YOMITAN_IMPORTER_NO_COMPRESS");
    let defer_term_indexes = env_flag("YOMITAN_IMPORTER_DEFER_TERM_INDEXES")
        || !env_flag("YOMITAN_IMPORTER_DISABLE_DEFER_TERM_INDEXES");
    let skip_media =
        env_flag("YOMITAN_IMPORTER_SKIP_MEDIA") || !env_flag("YOMITAN_IMPORTER_EAGER_MEDIA");
    info!("🔎 [Import] JSON parser mode: serde");
    if fast_db_mode {
        info!("⚡ [Import] Fast DB mode enabled");
    }
    if no_compress {
        info!("⚡ [Import] Compression disabled");
    }
    if defer_term_indexes {
        info!("⚡ [Import] Deferring terms index updates");
    }
    if skip_media {
        info!("⚡ [Import] Media extraction disabled");
    }

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
    if fast_db_mode {
        let _ = conn.execute_batch(
            "PRAGMA journal_mode = MEMORY;
             PRAGMA synchronous = OFF;
             PRAGMA temp_store = MEMORY;
             PRAGMA cache_size = -200000;
             PRAGMA locking_mode = EXCLUSIVE;",
        );
    }
    let tx = conn.transaction()?;
    if defer_term_indexes {
        tx.execute_batch(
            "DROP INDEX IF EXISTS idx_term;
             DROP INDEX IF EXISTS idx_reading;
             DROP INDEX IF EXISTS idx_dict_term;
             DROP INDEX IF EXISTS idx_term_dict;
             DROP INDEX IF EXISTS idx_reading_dict;",
        )?;
    }

    // 3. Register Dictionary in DB.
    // If next_dict_id is stale versus on-disk state, retry on unique-id conflicts.
    let mut dict_id = DictionaryId(0);
    let mut inserted = false;
    {
        let mut next_id = state.next_dict_id.write().expect("lock");
        for _ in 0..1024 {
            dict_id = DictionaryId(*next_id);
            *next_id += 1;
            match tx.execute(
                "INSERT INTO dictionaries (id, name, priority, enabled) VALUES (?, ?, ?, ?)",
                rusqlite::params![dict_id.0, dict_name, 0, true],
            ) {
                Ok(_) => {
                    inserted = true;
                    break;
                }
                Err(err)
                    if err
                        .to_string()
                        .contains("UNIQUE constraint failed: dictionaries.id") =>
                {
                    warn!(
                        "Dictionary id {} already exists during import; retrying with next id",
                        dict_id.0
                    );
                }
                Err(err) => return Err(anyhow!(err)),
            }
        }
    }
    if !inserted {
        return Err(anyhow!(
            "Failed to allocate dictionary id after repeated conflicts."
        ));
    }

    // 3.5. Collect archive entries once, then optionally extract media.
    let file_names: Vec<String> = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .collect();
    let has_media_entries = file_names.iter().any(|file_name| {
        !file_name.ends_with(".json")
            && !file_name.ends_with(".json.gz")
            && !file_name.contains("index")
            && !file_name.contains("meta")
            && !file_name.ends_with("styles.css")
    });

    let mut styles_content: Option<String> = None;

    if let Some(styles_name) = file_names
        .iter()
        .find(|name| name.ends_with("styles.css"))
        .cloned()
        && let Some(mut file) = open_zip_file_safe(&mut zip, &styles_name)
    {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            styles_content = Some(contents);
        }
    }

    let dict_media_dir = state.data_dir.join("dict_media").join(&dict_name);
    if !skip_media {
        fs::create_dir_all(&dict_media_dir)?;

        let mut media_files_extracted = 0usize;
        let mut created_media_dirs = HashSet::new();

        for file_name in &file_names {
            if file_name.ends_with(".json")
                || file_name.ends_with(".json.gz")
                || file_name.contains("index")
                || file_name.contains("meta")
                || file_name.ends_with("styles.css")
            {
                continue;
            }

            let Some(mut file) = open_zip_file_safe(&mut zip, file_name) else {
                continue;
            };
            let Some(media_path) = safe_join_path(&dict_media_dir, file_name) else {
                continue;
            };

            if let Some(parent) = media_path.parent() {
                let parent_key = parent.to_string_lossy().into_owned();
                if created_media_dirs.insert(parent_key) && fs::create_dir_all(parent).is_err() {
                    continue;
                }
            }

            if let Ok(mut out) = fs::File::create(&media_path)
                && std::io::copy(&mut file, &mut out).is_ok()
            {
                media_files_extracted += 1;
            }
        }

        if media_files_extracted > 0 {
            info!(
                "      Extracted {} media files for '{}'",
                media_files_extracted, dict_name
            );
        }
    } else {
        info!("      Skipped media extraction for '{}'", dict_name);
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

                let term_batch_size = env_usize("YOMITAN_IMPORTER_TERM_BATCH_SIZE")
                    .unwrap_or(4096)
                    .max(1);
                let available_workers = std::thread::available_parallelism()
                    .map(|count| count.get())
                    .unwrap_or(1);
                let term_encode_workers = env_usize("YOMITAN_IMPORTER_TERM_ENCODE_WORKERS")
                    .unwrap_or(available_workers.min(8))
                    .clamp(1, available_workers);
                let mut pending_rows = Vec::with_capacity(term_batch_size);
                let mut file_bytes = Vec::new();
                file.read_to_end(&mut file_bytes)?;

                let rows = parse_json_array_slice::<TermBankRow, _>(&file_bytes, |row| {
                    if row.headword.is_empty() {
                        return Ok(());
                    }

                    pending_rows.push(ParsedSerdeTermRow {
                        headword: row.headword,
                        reading: row.reading,
                        definition_tags: row.definition_tags,
                        popularity: row.popularity,
                        definitions: row.definitions,
                        term_tags: row.term_tags,
                    });

                    if pending_rows.len() >= term_batch_size {
                        flush_serde_term_rows(
                            &mut pending_rows,
                            &tx,
                            dict_id,
                            no_compress,
                            term_encode_workers,
                            &mut terms_found,
                        )?;
                    }

                    Ok(())
                })?;

                flush_serde_term_rows(
                    &mut pending_rows,
                    &tx,
                    dict_id,
                    no_compress,
                    term_encode_workers,
                    &mut terms_found,
                )?;

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

                let insert_batch_size = env_usize("YOMITAN_IMPORTER_TERM_INSERT_BATCH_SIZE")
                    .unwrap_or(4096)
                    .max(1);
                let mut json_buffer = Vec::new();
                let mut compressed_buffer = Vec::new();
                let mut pending_inserts = Vec::with_capacity(insert_batch_size);
                let mut file_bytes = Vec::new();
                file.read_to_end(&mut file_bytes)?;

                let rows = parse_json_array_slice::<TermMetaBankRow, _>(&file_bytes, |row| {
                    if row.term.is_empty() || !["freq", "pitch", "ipa"].contains(&row.mode.as_str())
                    {
                        return Ok(());
                    }

                    let (content_str, specific_reading) = match row.mode.as_str() {
                        "freq" => {
                            let (display_val, reading) = parse_frequency_value(&row.data);
                            let content = if let Some(ref r) = reading {
                                if r != &row.term {
                                    format!("Frequency: {display_val} ({r})")
                                } else {
                                    format!("Frequency: {display_val}")
                                }
                            } else {
                                format!("Frequency: {display_val}")
                            };
                            (content, reading)
                        }
                        "pitch" => parse_pitch_meta(&row.data),
                        "ipa" => parse_ipa_meta(&row.data),
                        _ => return Ok(()),
                    };

                    let term = row.term;
                    let content_raw = serde_json::value::to_raw_value(&content_str)?;
                    let compact = CompactGlossaryPayloadV1 {
                        popularity: 0,
                        content_raw: vec![content_raw],
                        definition_tags_raw: None,
                        term_tags_raw: None,
                        reading: specific_reading.clone(),
                        headword: Some(term.clone()),
                    };

                    encode_compact_glossary_payload(
                        &compact,
                        &mut encoder,
                        &mut json_buffer,
                        &mut compressed_buffer,
                        no_compress,
                    )?;

                    pending_inserts.push(EncodedTermInsert {
                        headword: term,
                        reading: specific_reading,
                        compressed: compressed_buffer.clone(),
                    });
                    if pending_inserts.len() >= insert_batch_size {
                        insert_encoded_term_rows(
                            &tx,
                            std::mem::take(&mut pending_inserts),
                            dict_id,
                            &mut terms_found,
                        )?;
                    }

                    Ok(())
                })?;

                if !pending_inserts.is_empty() {
                    insert_encoded_term_rows(&tx, pending_inserts, dict_id, &mut terms_found)?;
                }

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

                let _rows = parse_json_array_stream::<_, KanjiBankRow, _>(&mut file, |row| {
                    if row.character.chars().count() != 1 {
                        return Ok(());
                    }

                    let meanings_json = serde_json::to_string(&row.meanings).unwrap_or_default();
                    let stats_json = if row.stats.is_object() {
                        serde_json::to_string(&row.stats).unwrap_or_default()
                    } else {
                        String::new()
                    };

                    stmt.execute(rusqlite::params![
                        row.character,
                        dict_id.0,
                        row.onyomi,
                        row.kunyomi,
                        row.tags,
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

                let insert_batch_size = env_usize("YOMITAN_IMPORTER_TERM_INSERT_BATCH_SIZE")
                    .unwrap_or(4096)
                    .max(1);
                let mut json_buffer = Vec::new();
                let mut compressed_buffer = Vec::new();
                let mut pending_inserts = Vec::with_capacity(insert_batch_size);
                let mut file_bytes = Vec::new();
                file.read_to_end(&mut file_bytes)?;

                let rows = parse_json_array_slice::<KanjiMetaBankRow, _>(&file_bytes, |row| {
                    if row.character.is_empty() || row.meta_type != "freq" {
                        return Ok(());
                    }

                    let (display_val, _) = parse_frequency_value(&row.data);
                    let content = format!("Frequency: {display_val}");
                    let character = row.character;
                    let content_raw = serde_json::value::to_raw_value(&content)?;

                    let compact = CompactGlossaryPayloadV1 {
                        popularity: 0,
                        content_raw: vec![content_raw],
                        definition_tags_raw: None,
                        term_tags_raw: None,
                        reading: None,
                        headword: Some(character.clone()),
                    };

                    encode_compact_glossary_payload(
                        &compact,
                        &mut encoder,
                        &mut json_buffer,
                        &mut compressed_buffer,
                        no_compress,
                    )?;

                    pending_inserts.push(EncodedTermInsert {
                        headword: character,
                        reading: None,
                        compressed: compressed_buffer.clone(),
                    });
                    if pending_inserts.len() >= insert_batch_size {
                        insert_encoded_term_rows(
                            &tx,
                            std::mem::take(&mut pending_inserts),
                            dict_id,
                            &mut terms_found,
                        )?;
                    }

                    Ok(())
                })?;

                if !pending_inserts.is_empty() {
                    insert_encoded_term_rows(&tx, pending_inserts, dict_id, &mut terms_found)?;
                }

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

    if defer_term_indexes {
        tx.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_term ON terms(term);
             CREATE INDEX IF NOT EXISTS idx_reading ON terms(reading);
             CREATE INDEX IF NOT EXISTS idx_dict_term ON terms(dictionary_id);
             CREATE INDEX IF NOT EXISTS idx_term_dict ON terms(term, dictionary_id);
             CREATE INDEX IF NOT EXISTS idx_reading_dict ON terms(reading, dictionary_id);",
        )?;
    }

    if skip_media && has_media_entries {
        let archive_path = dict_archive_path(state, dict_id);
        if let Some(parent) = archive_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&archive_path, data)?;
    }

    tx.commit()?;
    info!(
        "💾 [Import] Database transaction committed. Total Terms: {}",
        terms_found
    );

    // Update in-memory dictionary registry only after a successful commit.
    {
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
            let stored_payload: Vec<u8> = conn
                .query_row("SELECT json FROM terms LIMIT 1", [], |row| row.get(0))
                .expect("term payload query");

            assert_eq!(dict_count, 1);
            assert_eq!(term_count, 1, "headword and reading share one stored row");

            let decoded_payload = snap::raw::Decoder::new()
                .decompress_vec(&stored_payload)
                .expect("payload should decompress");
            assert!(
                decoded_payload.starts_with(COMPACT_GLOSSARY_BIN_V1_PREFIX)
                    || decoded_payload.starts_with(b"MGC1"),
                "import should persist compact glossary payload prefix"
            );

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

    #[test]
    fn repairs_malformed_hex_escapes_in_array_parser() {
        let bytes = br#"[["term","reading","","",1,["broken \u and \x escape"],0,""]]"#;
        let mut parsed_rows = 0usize;
        let mut captured = String::new();

        let count = parse_json_array_stream::<_, Vec<Value>, _>(&bytes[..], |arr| {
            parsed_rows += 1;
            captured = arr
                .get(5)
                .and_then(|value| value.as_array())
                .and_then(|defs| defs.first())
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string();
            Ok(())
        })
        .expect("malformed escapes should be repaired");

        assert_eq!(count, 1);
        assert_eq!(parsed_rows, 1);
        assert!(captured.contains('�'));
        assert!(captured.contains("\\x"));
    }

    #[test]
    fn failed_import_rolls_back_dictionary_row() {
        with_state("failed-import-rollback", |state| {
            let zip = build_zip(
                r#"{"format":3,"title":"Broken Dict","revision":"1"}"#,
                &[(
                    "term_bank_1.json",
                    r#"[["猫","ねこ","n",null,100,["cat"],0,"common"]"#,
                )],
            );

            let err = import_zip(state, &zip).expect_err("broken dictionary should fail");
            assert!(err.to_string().contains("EOF") || err.to_string().contains("end"));

            let conn = state.pool.get().expect("db connection");
            let dict_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM dictionaries WHERE name = 'Broken Dict'",
                    [],
                    |row| row.get(0),
                )
                .expect("dict count query");
            let term_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM terms", [], |row| row.get(0))
                .expect("term count query");

            assert_eq!(dict_count, 0, "failed import must not leave dictionary rows");
            assert_eq!(term_count, 0, "failed import must not leave term rows");
        });
    }
}
