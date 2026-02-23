use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use tracing::error;
use wordbase_api::{
    DictionaryId, FrequencyValue, Record, RecordEntry, RecordId, Span, Term,
    dict::yomitan::GlossaryTag,
};

use crate::{
    deinflector::{Deinflector, Language as DeinflectLanguage},
    state::{AppState, StoredRecord},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanjiEntry {
    pub character: String,
    pub dictionary_name: String,
    pub onyomi: Vec<String>,
    pub kunyomi: Vec<String>,
    pub tags: Vec<String>,
    pub meanings: Vec<String>,
    pub stats: std::collections::HashMap<String, String>,
    pub frequencies: Vec<KanjiFrequency>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanjiFrequency {
    pub dictionary_name: String,
    pub value: String,
}

pub struct LookupService {
    deinflector: Deinflector,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct Candidate {
    pub word: String,
    pub source_len: usize,
    pub _reason: String,
}

impl Default for LookupService {
    fn default() -> Self {
        Self::new()
    }
}

impl LookupService {
    pub fn new() -> Self {
        Self {
            deinflector: Deinflector::new(),
        }
    }

    pub fn unload_tokenizer(&self) {}

    pub fn search(
        &self,
        state: &AppState,
        text: &str,
        cursor_offset: usize,
        language: DeinflectLanguage,
    ) -> Vec<(RecordEntry, Option<Vec<GlossaryTag>>)> {
        let mut results = Vec::new();
        let mut processed_candidates = HashSet::new();

        let conn = match state.pool.get() {
            Ok(c) => c,
            Err(e) => {
                error!("❌ Failed to get DB connection: {}", e);
                return vec![];
            }
        };

        let dict_configs: HashMap<DictionaryId, (bool, i64)> = {
            let dicts = state.dictionaries.read().expect("lock");
            dicts
                .iter()
                .map(|(id, d)| (*id, (d.enabled, d.priority)))
                .collect()
        };

        let mut stmt = match conn.prepare("SELECT dictionary_id, json FROM terms WHERE term = ?") {
            Ok(s) => s,
            Err(e) => {
                error!("❌ DB Prepare Error: {}", e);
                return vec![];
            }
        };

        let start_index = self.snap_to_char_boundary(text, cursor_offset);
        if start_index >= text.len() {
            return vec![];
        }

        let search_text = &text[start_index..];
        let chars: Vec<char> = search_text.chars().take(24).collect();
        let mut decoder = snap::raw::Decoder::new();

        for len in (1..=chars.len()).rev() {
            let substring: String = chars[0..len].iter().collect();

            // Skip single character Latin/Symbol lookups unless explicitly desired
            if should_skip_single_character(language)
                && len < 2
                && !substring.eq_ignore_ascii_case("a")
                && !substring.eq_ignore_ascii_case("i")
            {
                continue;
            }

            let candidates = self.generate_candidates(&substring, language);

            for candidate in candidates {
                if !self.is_valid_candidate(&substring, &candidate.word, language) {
                    continue;
                }

                if processed_candidates.contains(&candidate.word) {
                    continue;
                }
                processed_candidates.insert(candidate.word.clone());

                let rows = stmt.query_map(rusqlite::params![candidate.word], |row| {
                    let dict_id: i64 = row.get(0)?;
                    let compressed: Vec<u8> = row.get(1)?;
                    Ok((dict_id, compressed))
                });

                if let Ok(mapped_rows) = rows {
                    for (dict_id_raw, compressed_data) in mapped_rows.flatten() {
                        let dict_id = DictionaryId(dict_id_raw);

                        if let Some((enabled, _)) = dict_configs.get(&dict_id)
                            && !*enabled
                        {
                            continue;
                        }

                        if let Ok(decompressed) = decoder.decompress_vec(&compressed_data)
                            && let Ok(stored) =
                                serde_json::from_slice::<StoredRecord>(&decompressed)
                        {
                            let match_len = candidate.source_len;

                            let headword = stored
                                .headword
                                .as_deref()
                                .unwrap_or(candidate.word.as_str());
                            let term_obj =
                                Term::from_parts(Some(headword), stored.reading.as_deref())
                                    .unwrap_or_else(|| {
                                        Term::from_headword(headword.to_string())
                                            .expect("headword should produce a valid term")
                                    });

                            let freq = if let Record::YomitanGlossary(g) = &stored.record {
                                g.popularity
                            } else {
                                0
                            };

                            results.push((
                                RecordEntry {
                                    span_bytes: Span {
                                        start: 0,
                                        end: candidate.word.len() as u64,
                                    },
                                    span_chars: Span {
                                        start: 0,
                                        end: match_len as u64,
                                    },
                                    source: stored.dictionary_id,
                                    term: term_obj,
                                    record_id: RecordId(0),
                                    record: stored.record.clone(),
                                    profile_sorting_frequency: None,
                                    source_sorting_frequency: Some(FrequencyValue::Rank(freq)),
                                },
                                stored.term_tags,
                            ));
                        }
                    }
                }
            }
        }

        results.sort_by(|a, b| {
            let len_cmp = b.0.span_chars.end.cmp(&a.0.span_chars.end);
            if len_cmp != std::cmp::Ordering::Equal {
                return len_cmp;
            }

            let prio_a = dict_configs
                .get(&a.0.source)
                .map(|(_, p)| *p)
                .unwrap_or(999);
            let prio_b = dict_configs
                .get(&b.0.source)
                .map(|(_, p)| *p)
                .unwrap_or(999);

            let prio_cmp = prio_a.cmp(&prio_b);
            if prio_cmp != std::cmp::Ordering::Equal {
                return prio_cmp;
            }

            let get_val = |f: Option<&FrequencyValue>| -> i64 {
                match f {
                    Some(FrequencyValue::Rank(v)) => *v,
                    Some(FrequencyValue::Occurrence(v)) => *v,
                    None => 0,
                }
            };
            get_val(b.0.source_sorting_frequency.as_ref())
                .cmp(&get_val(a.0.source_sorting_frequency.as_ref()))
        });

        results
    }

    pub fn search_kanji(
        &self,
        state: &AppState,
        text: &str,
        cursor_offset: usize,
    ) -> Vec<KanjiEntry> {
        use wordbase_api::DictionaryId;
        let mut results = Vec::new();

        let conn = match state.pool.get() {
            Ok(c) => c,
            Err(_) => return results,
        };

        let dict_configs: std::collections::HashMap<DictionaryId, (bool, String)> = {
            let dicts = state.dictionaries.read().expect("lock");
            dicts
                .iter()
                .map(|(id, d)| (*id, (d.enabled, d.name.clone())))
                .collect()
        };

        let start_index = self.snap_to_char_boundary(text, cursor_offset);
        if start_index >= text.len() {
            return results;
        }

        let search_text = &text[start_index..];
        let chars: Vec<char> = search_text.chars().take(10).collect();

        for len in (1..=chars.len()).rev() {
            let character: String = chars[0..len].iter().collect();
            if character.chars().count() != len {
                continue;
            }

            let mut kanji_stmt = match conn.prepare(
                "SELECT dictionary_id, onyomi, kunyomi, tags, meanings, stats FROM kanji WHERE character = ?"
            ) {
                Ok(s) => s,
                Err(_) => continue,
            };

            let mut meta_stmt = match conn.prepare(
                "SELECT km.meta_type, km.data, d.name FROM kanji_meta km JOIN dictionaries d ON km.dictionary_id = d.id WHERE km.character = ?"
            ) {
                Ok(s) => s,
                Err(_) => continue,
            };

            // Use query_map to get ALL kanji entries for this character (not just first)
            let kanji_iter = match kanji_stmt.query_map(rusqlite::params![&character], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1).unwrap_or_default(),
                    row.get::<_, String>(2).unwrap_or_default(),
                    row.get::<_, String>(3).unwrap_or_default(),
                    row.get::<_, String>(4).unwrap_or_default(),
                    row.get::<_, String>(5).unwrap_or_default(),
                ))
            }) {
                Ok(iter) => iter,
                Err(_) => continue,
            };

            // Query kanji_meta for frequencies
            let meta_result = meta_stmt.query_map(rusqlite::params![&character], |row| {
                Ok::<_, rusqlite::Error>((
                    row.get::<_, String>(0)?,                    // meta_type
                    row.get::<_, String>(1).unwrap_or_default(), // data
                    row.get::<_, String>(2).unwrap_or_default(), // dict name
                ))
            });

            // Build frequencies map: dict_id -> Vec<(dict_name, value)>
            let mut freq_map: std::collections::HashMap<i64, Vec<(String, String)>> =
                std::collections::HashMap::new();

            if let Ok(meta_iter) = meta_result {
                for meta_item in meta_iter {
                    if let Ok((meta_type, data, dict_name)) = meta_item {
                        if meta_type == "freq" {
                            // Parse frequency data - try JSON first, otherwise use as-is
                            let freq_value: String =
                                serde_json::from_str(&data).unwrap_or_else(|_| data);
                            freq_map.entry(0).or_default().push((dict_name, freq_value));
                        }
                    }
                }
            }

            // Process ALL kanji entries for this character
            for kanji_result in kanji_iter.flatten() {
                let (dict_id, onyomi, kunyomi, tags, meanings_json, stats_json) = kanji_result;
                let dict_id = DictionaryId(dict_id);

                if let Some((enabled, _)) = dict_configs.get(&dict_id) {
                    if !*enabled {
                        continue;
                    }
                }

                // Get dictionary name for this kanji - look up from DB directly to ensure we get the name
                let dict_name: String = conn
                    .query_row(
                        "SELECT name FROM dictionaries WHERE id = ?",
                        rusqlite::params![dict_id.0],
                        |row| row.get(0),
                    )
                    .unwrap_or_else(|_| {
                        // Fallback to dict_configs if DB query fails
                        dict_configs
                            .get(&dict_id)
                            .map(|(_, name)| name.clone())
                            .unwrap_or_default()
                    });

                let onyomi_vec: Vec<String> = onyomi.split_whitespace().map(String::from).collect();
                let kunyomi_vec: Vec<String> =
                    kunyomi.split_whitespace().map(String::from).collect();
                let tags_vec: Vec<String> = tags.split_whitespace().map(String::from).collect();
                let meanings: Vec<String> =
                    serde_json::from_str(&meanings_json).unwrap_or_default();
                let stats: std::collections::HashMap<String, String> =
                    serde_json::from_str(&stats_json).unwrap_or_default();

                // Get frequencies for this dictionary
                let frequencies: Vec<KanjiFrequency> = freq_map
                    .get(&dict_id.0)
                    .map(|vec| {
                        vec.iter()
                            .map(|(dict_name, value)| KanjiFrequency {
                                dictionary_name: dict_name.clone(),
                                value: value.clone(),
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                results.push(KanjiEntry {
                    character: character.clone(),
                    dictionary_name: dict_name,
                    onyomi: onyomi_vec,
                    kunyomi: kunyomi_vec,
                    tags: tags_vec,
                    meanings,
                    stats,
                    frequencies,
                });
            }
        }

        results.sort_by(|a, b| {
            let len_a = a.character.chars().count();
            let len_b = b.character.chars().count();
            if len_a != len_b {
                return len_b.cmp(&len_a);
            }
            let freq_a = a
                .frequencies
                .first()
                .and_then(|f| f.value.parse::<i64>().ok())
                .unwrap_or(999999);
            let freq_b = b
                .frequencies
                .first()
                .and_then(|f| f.value.parse::<i64>().ok())
                .unwrap_or(999999);
            freq_a.cmp(&freq_b)
        });

        results
    }

    fn snap_to_char_boundary(&self, text: &str, index: usize) -> usize {
        if index >= text.len() {
            return text.len();
        }
        let mut i = index;
        while i > 0 && !text.is_char_boundary(i) {
            i -= 1;
        }
        i
    }

    fn is_valid_candidate(
        &self,
        source: &str,
        candidate: &str,
        language: DeinflectLanguage,
    ) -> bool {
        if source == candidate {
            return true;
        }
        match language {
            DeinflectLanguage::Japanese | DeinflectLanguage::Chinese => {
                let source_kanji: Vec<char> =
                    source.chars().filter(|c| self.is_ideograph(*c)).collect();
                let cand_kanji: Vec<char> = candidate
                    .chars()
                    .filter(|c| self.is_ideograph(*c))
                    .collect();
                if !cand_kanji.is_empty() {
                    for k in cand_kanji {
                        if source_kanji.contains(&k) {
                            return true;
                        }
                    }
                    return false;
                }
                true
            }
            _ => true,
        }
    }

    fn is_ideograph(&self, c: char) -> bool {
        ('\u{4E00}'..='\u{9FFF}').contains(&c)
    }

    fn katakana_to_hiragana(&self, text: &str) -> String {
        text.chars()
            .map(|c| {
                let code = c as u32;
                if (0x30A1..=0x30F6).contains(&code) {
                    std::char::from_u32(code - 0x60).unwrap_or(c)
                } else {
                    c
                }
            })
            .collect()
    }

    fn replace_prolonged_sound_mark(&self, text: &str) -> String {
        let mut result = String::with_capacity(text.len());
        let mut previous = None;

        for c in text.chars() {
            if c == 'ー'
                && let Some(prev) = previous
                && let Some(vowel) = self.prolonged_vowel(prev)
            {
                result.push(vowel);
                previous = Some(vowel);
                continue;
            }

            result.push(c);
            previous = Some(c);
        }

        result
    }

    fn prolonged_vowel(&self, kana: char) -> Option<char> {
        const A_ROW: &str = "ぁあかがさざただなはばぱまやゃらわゎ";
        const I_ROW: &str = "ぃいきぎしじちぢにひびぴみりゐ";
        const U_ROW: &str = "ぅうくぐすずつづぬふぶぷむゆゅる";
        const E_ROW: &str = "ぇえけげせぜてでねへべぺめれゑ";
        const O_ROW: &str = "ぉおこごそぞとどのほぼぽもよょろを";

        if A_ROW.contains(kana) {
            Some('あ')
        } else if I_ROW.contains(kana) {
            Some('い')
        } else if U_ROW.contains(kana) {
            Some('う')
        } else if E_ROW.contains(kana) {
            Some('え')
        } else if O_ROW.contains(kana) {
            Some('う')
        } else {
            None
        }
    }

    fn generate_candidates(&self, text: &str, language: DeinflectLanguage) -> Vec<Candidate> {
        let mut candidates = Vec::new();
        let source_len = text.chars().count();

        candidates.push(Candidate {
            word: text.to_string(),
            source_len,
            _reason: "Original".to_string(),
        });

        match language {
            DeinflectLanguage::Japanese => {
                let mut variants = HashSet::new();
                variants.insert(text.to_string());

                let normalized = self.katakana_to_hiragana(text);
                variants.insert(normalized.clone());

                let prolonged = self.replace_prolonged_sound_mark(&normalized);
                variants.insert(prolonged);

                for variant in variants {
                    self.add_deinflections(
                        DeinflectLanguage::Japanese,
                        &variant,
                        source_len,
                        &mut candidates,
                    );
                }
            }
            DeinflectLanguage::Korean => {
                self.add_deinflections(
                    DeinflectLanguage::Korean,
                    text,
                    source_len,
                    &mut candidates,
                );
            }
            language if should_lowercase(language) => {
                let lower = text.to_lowercase();
                let sources = if lower == text {
                    vec![text.to_string()]
                } else {
                    vec![text.to_string(), lower]
                };

                for source in sources {
                    self.add_deinflections(language, &source, source_len, &mut candidates);
                }
            }
            DeinflectLanguage::Chinese => {
                self.add_deinflections(
                    DeinflectLanguage::Chinese,
                    text,
                    source_len,
                    &mut candidates,
                );
            }
            DeinflectLanguage::Arabic => {
                let mut variants = HashSet::new();
                variants.insert(text.to_string());
                let normalized = crate::deinflector::arabic::strip_diacritics(text);
                variants.insert(normalized);
                for variant in variants {
                    self.add_deinflections(
                        DeinflectLanguage::Arabic,
                        &variant,
                        source_len,
                        &mut candidates,
                    );
                }
            }
            _ => {
                self.add_deinflections(language, text, source_len, &mut candidates);
            }
        }

        candidates
    }

    fn add_deinflections(
        &self,
        language: DeinflectLanguage,
        text: &str,
        source_len: usize,
        candidates: &mut Vec<Candidate>,
    ) {
        for word in self.deinflector.deinflect(language, text) {
            if word.is_empty() {
                continue;
            }
            candidates.push(Candidate {
                word,
                source_len,
                _reason: "Deinflect".to_string(),
            });
        }
    }
}

fn should_skip_single_character(language: DeinflectLanguage) -> bool {
    should_lowercase(language)
}

fn should_lowercase(language: DeinflectLanguage) -> bool {
    matches!(
        language,
        DeinflectLanguage::English
            | DeinflectLanguage::Spanish
            | DeinflectLanguage::French
            | DeinflectLanguage::German
            | DeinflectLanguage::Portuguese
            | DeinflectLanguage::Italian
            | DeinflectLanguage::Dutch
            | DeinflectLanguage::Norwegian
            | DeinflectLanguage::Swedish
            | DeinflectLanguage::Danish
            | DeinflectLanguage::Finnish
            | DeinflectLanguage::Estonian
            | DeinflectLanguage::Latvian
            | DeinflectLanguage::Romanian
            | DeinflectLanguage::Polish
            | DeinflectLanguage::Czech
            | DeinflectLanguage::Hungarian
            | DeinflectLanguage::Turkish
            | DeinflectLanguage::Indonesian
            | DeinflectLanguage::Vietnamese
            | DeinflectLanguage::Tagalog
            | DeinflectLanguage::Maltese
            | DeinflectLanguage::Welsh
            | DeinflectLanguage::Bulgarian
            | DeinflectLanguage::Russian
            | DeinflectLanguage::Ukrainian
            | DeinflectLanguage::Greek
            | DeinflectLanguage::Latin
            | DeinflectLanguage::Mongolian
    )
}
