use crate::state::{AppState, StoredRecord};
use lindera::{
    dictionary::{DictionaryKind, load_dictionary_from_kind},
    mode::Mode,
    segmenter::Segmenter,
    tokenizer::Tokenizer,
};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tracing::{error, info};
use wordbase_api::{DictionaryId, FrequencyValue, Record, RecordEntry, RecordId, Span, Term};

pub struct LookupService {
    tokenizer: Arc<Tokenizer>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct Candidate {
    pub word: String,
    pub source_len: usize,
    pub _reason: String,
}

#[derive(Debug, PartialEq)]
enum Script {
    Japanese,
    Korean,
    Latin,
    Chinese,
    Other,
}

impl LookupService {
    pub fn new() -> Self {
        info!("⏳ [Lookup] Initializing Lindera (UniDic)...");
        let dictionary = load_dictionary_from_kind(DictionaryKind::UniDic)
            .expect("Failed to load UniDic dictionary");

        let segmenter = Segmenter::new(Mode::Normal, dictionary, None);
        let tokenizer = Tokenizer::new(segmenter);
        info!("✅ [Lookup] Lindera Initialized.");

        Self {
            tokenizer: Arc::new(tokenizer),
        }
    }

    pub fn search(&self, state: &AppState, text: &str, cursor_offset: usize) -> Vec<RecordEntry> {
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
        let script = self.detect_script(&chars);
        let mut decoder = snap::raw::Decoder::new();

        for len in (1..=chars.len()).rev() {
            let substring: String = chars[0..len].iter().collect();

            // Skip single character Latin/Symbol lookups unless explicitly desired
            if script == Script::Latin
                && len < 2
                && !substring.eq_ignore_ascii_case("a")
                && !substring.eq_ignore_ascii_case("i")
            {
                continue;
            }

            let candidates = self.generate_candidates(&substring, &script);

            for candidate in candidates {
                if !self.is_valid_candidate(&substring, &candidate.word, &script) {
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

                                    let term_obj = Term::from_parts(
                                        Some(candidate.word.as_str()),
                                        stored.reading.as_deref(),
                                    )
                                    .unwrap_or_else(|| {
                                        Term::from_headword(candidate.word.clone()).unwrap()
                                    });

                                    let mut freq = 0;
                                    if let Record::YomitanGlossary(g) = &stored.record {
                                        freq = g.popularity;
                                    }

                                    results.push(RecordEntry {
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
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        results.sort_by(|a, b| {
            let len_cmp = b.span_chars.end.cmp(&a.span_chars.end);
            if len_cmp != std::cmp::Ordering::Equal {
                return len_cmp;
            }

            let prio_a = dict_configs.get(&a.source).map(|(_, p)| *p).unwrap_or(999);
            let prio_b = dict_configs.get(&b.source).map(|(_, p)| *p).unwrap_or(999);

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
            get_val(b.source_sorting_frequency.as_ref())
                .cmp(&get_val(a.source_sorting_frequency.as_ref()))
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

    fn detect_script(&self, chars: &[char]) -> Script {
        for &c in chars {
            if (c >= '\u{AC00}' && c <= '\u{D7AF}') || (c >= '\u{1100}' && c <= '\u{11FF}') {
                return Script::Korean;
            }
            if c >= '\u{3040}' && c <= '\u{30FF}' {
                return Script::Japanese;
            }
        }
        for &c in chars {
            if c.is_ascii_alphabetic() || (c >= '\u{00C0}' && c <= '\u{00FF}') {
                return Script::Latin;
            }
            if c >= '\u{4E00}' && c <= '\u{9FFF}' {
                return Script::Chinese;
            }
        }
        Script::Other
    }

    fn is_valid_candidate(&self, source: &str, candidate: &str, script: &Script) -> bool {
        if source == candidate {
            return true;
        }
        match script {
            Script::Japanese | Script::Chinese => {
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

    fn generate_candidates(&self, text: &str, script: &Script) -> Vec<Candidate> {
        let mut candidates = Vec::new();

        candidates.push(Candidate {
            word: text.to_string(),
            source_len: text.chars().count(),
            _reason: "Original".to_string(),
        });

        match script {
            Script::Japanese => {
                if let Ok(mut tokens) = self.tokenizer.tokenize(text) {
                    if let Some(first_token) = tokens.first_mut() {
                        let details = first_token.details();
                        if details.len() >= 8 {
                            let lemma = &details[7];
                            if *lemma != "*" && *lemma != text {
                                candidates.push(Candidate {
                                    word: lemma.to_string(),
                                    source_len: first_token.text.chars().count(),
                                    _reason: "Lindera".to_string(),
                                });
                            }
                        }
                    }
                }
            }
            Script::Korean => {
                candidates.extend(self.generate_korean_candidates(text));
            }
            Script::Latin => {
                candidates.extend(self.generate_english_candidates(text));
            }
            _ => {}
        }

        candidates
    }

    fn generate_korean_candidates(&self, text: &str) -> Vec<Candidate> {
        let mut results = Vec::new();
        let src_len = text.chars().count();
        let jamo = self.decompose_hangul(text);

        let rules = vec![
            ("ㅎㅏㄱㅔ", "ㅎㅏㄷㅏ"),
            ("ㅅㅡㅂㄴㅣㄷㅏ", "ㄷㅏ"),
            ("ㅂㄴㅣㄷㅏ", "ㄷㅏ"),
            ("ㅎㅐ", "ㅎㅏㄷㅏ"),
            ("ㅎㅐㅇㅛ", "ㅎㅏㄷㅏ"),
            ("ㅇㅛ", ""),
            ("ㅇㅛ", "ㄷㅏ"),
            ("ㄱㅗ", "ㄷㅏ"),
            ("ㄱㅔ", "ㄷㅏ"),
            ("ㄱㅣ", "ㄷㅏ"),
            ("ㅈㅣ", "ㄷㅏ"),
            ("ㅁㅕ", "ㄷㅏ"),
            ("ㅁㅕㄴ", "ㄷㅏ"),
            ("ㄴㅣ", "ㄷㅏ"),
            ("ㄴㅏ", "ㄷㅏ"),
            ("ㄴㅡㄴ", "ㄷㅏ"),
            ("ㅇㅡㄴ", "ㄷㅏ"),
            ("ㄹ", "ㄷㅏ"),
            ("ㅇㅡㄹ", "ㄷㅏ"),
            ("ㄷㅓㄴ", "ㄷㅏ"),
            ("ㄷㅗ", ""),
            ("ㅁㅏㄴ", ""),
            ("ㄹㅡㄹ", ""),
            ("ㅇㅡㄹ", ""),
            ("ㄱㅏ", ""),
            ("ㅇㅣ", ""),
            ("ㄴㅡㄴ", ""),
            ("ㅇㅡㄴ", ""),
            ("ㅆㄷㅏ", "ㄷㅏ"),
            ("ㅆㅇㅓ", "ㄷㅏ"),
            ("ㅆㅇㅓㅇㅛ", "ㄷㅏ"),
            ("ㅇㅏㅆ", "ㄷㅏ"),
            ("ㅇㅓㅆ", "ㄷㅏ"),
            ("ㅈㅛ", "ㄷㅏ"),
            ("ㅈㅛ", ""),
            ("ㅅㅓ", "ㄷㅏ"),
        ];

        for (suffix, repl) in rules {
            if jamo.ends_with(suffix) {
                let stem_len = jamo.chars().count() - suffix.chars().count();
                let stem: String = jamo.chars().take(stem_len).collect();
                let new_jamo = format!("{}{}", stem, repl);
                let recomposed = self.compose_hangul(&new_jamo);

                if recomposed != text && !recomposed.is_empty() {
                    results.push(Candidate {
                        word: recomposed,
                        source_len: src_len,
                        _reason: "Ko-Deinflect".to_string(),
                    });
                }
            }
        }
        results
    }

    fn decompose_hangul(&self, text: &str) -> String {
        let mut result = String::new();
        let cho_map = [
            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ',
            'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
        ];
        let jung_map = [
            'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ',
            'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
        ];
        let jong_map = [
            '\0', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ',
            'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
        ];

        for c in text.chars() {
            let u = c as u32;
            if u >= 0xAC00 && u <= 0xD7A3 {
                let idx = u - 0xAC00;
                let jong = idx % 28;
                let jung = (idx / 28) % 21;
                let cho = idx / 28 / 21;

                result.push(cho_map[cho as usize]);
                result.push(jung_map[jung as usize]);
                if jong > 0 {
                    result.push(jong_map[jong as usize]);
                }
            } else {
                result.push(c);
            }
        }
        result
    }

    fn compose_hangul(&self, jamo: &str) -> String {
        let mut result = String::new();
        let chars: Vec<char> = jamo.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let c1 = chars[i];
            if self.is_cho(c1) {
                if i + 1 < chars.len() && self.is_jung(chars[i + 1]) {
                    let c2 = chars[i + 1];
                    let cho_idx = self.get_cho_idx(c1);
                    let jung_idx = self.get_jung_idx(c2);

                    let mut jong_idx = 0;
                    let mut consumed = 2;

                    if i + 2 < chars.len() {
                        let c3 = chars[i + 2];
                        if self.is_jong(c3) {
                            let is_next_vowel = if i + 3 < chars.len() {
                                self.is_jung(chars[i + 3])
                            } else {
                                false
                            };

                            if !is_next_vowel {
                                jong_idx = self.get_jong_idx(c3);
                                consumed = 3;

                                if i + 3 < chars.len() {
                                    let c4 = chars[i + 3];
                                    if let Some(complex_jong) = self.combine_jong(c3, c4) {
                                        let is_next_next_vowel = if i + 4 < chars.len() {
                                            self.is_jung(chars[i + 4])
                                        } else {
                                            false
                                        };
                                        if !is_next_next_vowel {
                                            jong_idx = self.get_jong_idx(complex_jong);
                                            consumed = 4;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let u = 0xAC00 + (cho_idx * 21 * 28) + (jung_idx * 28) + jong_idx;
                    if let Some(chr) = std::char::from_u32(u) {
                        result.push(chr);
                    }
                    i += consumed;
                    continue;
                }
            }
            result.push(c1);
            i += 1;
        }
        result
    }

    fn is_cho(&self, c: char) -> bool {
        "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".contains(c)
    }
    fn is_jung(&self, c: char) -> bool {
        "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".contains(c)
    }
    fn is_jong(&self, c: char) -> bool {
        "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ".contains(c)
    }
    fn get_cho_idx(&self, c: char) -> u32 {
        "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
            .chars()
            .position(|x| x == c)
            .unwrap_or(0) as u32
    }
    fn get_jung_idx(&self, c: char) -> u32 {
        "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
            .chars()
            .position(|x| x == c)
            .unwrap_or(0) as u32
    }
    fn get_jong_idx(&self, c: char) -> u32 {
        "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
            .chars()
            .position(|x| x == c)
            .map(|p| p as u32 + 1)
            .unwrap_or(0)
    }
    fn combine_jong(&self, c1: char, c2: char) -> Option<char> {
        match (c1, c2) {
            ('ㄱ', 'ㅅ') => Some('ㄳ'),
            ('ㄴ', 'ㅈ') => Some('ㄵ'),
            ('ㄴ', 'ㅎ') => Some('ㄶ'),
            ('ㄹ', 'ㄱ') => Some('ㄺ'),
            ('ㄹ', 'ㅁ') => Some('ㄻ'),
            ('ㄹ', 'ㅂ') => Some('ㄼ'),
            ('ㄹ', 'ㅅ') => Some('ㄽ'),
            ('ㄹ', 'ㅌ') => Some('ㄾ'),
            ('ㄹ', 'ㅍ') => Some('ㄿ'),
            ('ㄹ', 'ㅎ') => Some('ㅀ'),
            ('ㅂ', 'ㅅ') => Some('ㅄ'),
            _ => None,
        }
    }

    // --- ENGLISH PROCESSING ---

    fn generate_english_candidates(&self, text: &str) -> Vec<Candidate> {
        let mut results = Vec::new();
        let src_len = text.chars().count();
        let lower = text.to_lowercase();

        if lower != text {
            results.push(Candidate {
                word: lower.clone(),
                source_len: src_len,
                _reason: "Lowercase".to_string(),
            });
        }

        // 1. Prefixes
        let prefixes = vec![("un", ""), ("re", "")];

        for (pre, repl) in &prefixes {
            if lower.starts_with(pre) {
                let stem = &lower[pre.len()..];
                results.push(Candidate {
                    word: format!("{}{}", repl, stem),
                    source_len: src_len,
                    _reason: "En-Prefix".to_string(),
                });
            }
        }

        // 2. Suffixes (suffix, replacement, check_doubled_consonant)
        let suffixes = vec![
            ("s", "", false),
            ("es", "", false),
            ("ies", "y", false),  // cherries -> cherry
            ("ves", "f", false),  // wolves -> wolf
            ("ves", "fe", false), // knives -> knife
            ("ing", "", true),    // running -> run
            ("ing", "e", false),  // dancing -> dance
            ("ed", "", true),     // stopped -> stop
            ("ed", "e", false),   // baked -> bake
            ("er", "", true),     // hotter -> hot
            ("er", "e", false),   // later -> late
            ("est", "", true),
            ("est", "e", false),
            ("ly", "", false),
            ("able", "", true),
            ("able", "e", false),
        ];

        let double_consonants = "bdgklmnprstz";

        for (suffix, repl, check_double) in suffixes {
            if lower.ends_with(suffix) {
                let stem_len = lower.len() - suffix.len();
                let stem = &lower[0..stem_len];

                // Normal replacement
                results.push(Candidate {
                    word: format!("{}{}", stem, repl),
                    source_len: src_len,
                    _reason: "En-Suffix".to_string(),
                });

                // Double consonant check (e.g. running -> runn -> run)
                if check_double && stem.len() >= 2 {
                    let last_char = stem.chars().last().unwrap();
                    let second_last = stem.chars().nth(stem.len() - 2).unwrap();

                    if last_char == second_last && double_consonants.contains(last_char) {
                        let reduced_stem = &stem[0..stem.len() - 1];
                        results.push(Candidate {
                            word: format!("{}{}", reduced_stem, repl),
                            source_len: src_len,
                            _reason: "En-Double".to_string(),
                        });
                    }
                }
            }
        }

        results
    }
}
