use std::collections::{HashMap, HashSet};

use tracing::error;
use wordbase_api::{
    dict::yomitan::GlossaryTag, DictionaryId, FrequencyValue, Record, RecordEntry, RecordId, Span,
    Term,
};

use crate::deinflector::{Deinflector, Language as DeinflectLanguage};
use crate::state::{AppState, StoredRecord};

pub struct LookupService {
    deinflector: Deinflector,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct Candidate {
    pub word: String,
    pub source_len: usize,
    pub _reason: String,
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
            if matches!(
                language,
                DeinflectLanguage::English
                    | DeinflectLanguage::Spanish
                    | DeinflectLanguage::French
                    | DeinflectLanguage::German
                    | DeinflectLanguage::Portuguese
            ) && len < 2
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
                    for row_result in mapped_rows {
                        if let Ok((dict_id_raw, compressed_data)) = row_result {
                            let dict_id = DictionaryId(dict_id_raw);

                            if let Some((enabled, _)) = dict_configs.get(&dict_id) {
                                if !*enabled {
                                    continue;
                                }
                            }

                            if let Ok(decompressed) = decoder.decompress_vec(&compressed_data) {
                                if let Ok(stored) =
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
                                                Term::from_headword(headword.to_string()).unwrap()
                                            });

                                    let mut freq = 0;
                                    if let Record::YomitanGlossary(g) = &stored.record {
                                        freq = g.popularity;
                                    }

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
                                            source_sorting_frequency: Some(FrequencyValue::Rank(
                                                freq,
                                            )),
                                        },
                                        stored.term_tags,
                                    ));
                                }
                            }
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
        c >= '\u{4E00}' && c <= '\u{9FFF}'
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
            if c == 'ー' {
                if let Some(prev) = previous {
                    if let Some(vowel) = self.prolonged_vowel(prev) {
                        result.push(vowel);
                        previous = Some(vowel);
                        continue;
                    }
                }
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
            DeinflectLanguage::English
            | DeinflectLanguage::Spanish
            | DeinflectLanguage::French
            | DeinflectLanguage::German
            | DeinflectLanguage::Portuguese => {
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
