use std::collections::HashSet;

use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("transforms.json"))
        .expect("Failed to parse Korean deinflector data")
}

pub fn deinflect(transformer: &LanguageTransformer, text: &str) -> Vec<String> {
    let disassembled = disassemble(text);
    let mut results = Vec::new();
    let mut seen = HashSet::new();
    for term in transformer.deinflect_terms(&disassembled) {
        let recomposed = reassemble_hangul(&term);
        if seen.insert(recomposed.clone()) {
            results.push(recomposed);
        }
    }
    results
}

pub fn disassemble(text: &str) -> String {
    disassemble_hangul(text)
}

fn disassemble_hangul(text: &str) -> String {
    let mut result = String::new();

    for c in text.chars() {
        let u = c as u32;
        if !(0xAC00..=0xD7A3).contains(&u) {
            result.push(c);
            continue;
        }

        let idx = u - 0xAC00;
        let jong = idx % 28;
        let jung = (idx / 28) % 21;
        let cho = idx / 28 / 21;

        let cho_char = CHO_MAP[cho as usize];
        let jung_char = JUNG_MAP[jung as usize];
        let jong_char = JONG_MAP[jong as usize];

        result.push(cho_char);
        for vowel in decompose_jung(jung_char) {
            result.push(vowel);
        }
        if jong > 0 {
            for consonant in decompose_jong(jong_char) {
                result.push(consonant);
            }
        }
    }

    result
}

fn reassemble_hangul(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut result = String::new();
    let mut i = 0;

    while i < chars.len() {
        let c1 = chars[i];
        if is_cho(c1) && i + 1 < chars.len() && is_jung(chars[i + 1]) {
            let mut consumed = 2;
            let mut jung_char = chars[i + 1];

            if i + 2 < chars.len()
                && is_jung(chars[i + 2])
                && let Some(combined) = combine_jung(jung_char, chars[i + 2])
            {
                jung_char = combined;
                consumed = 3;
            }

            let cho_idx = get_cho_idx(c1);
            let jung_idx = get_jung_idx(jung_char);
            let mut jong_idx = 0;

            if i + consumed < chars.len() {
                let c3 = chars[i + consumed];
                if is_jong(c3) {
                    let mut jong_char = c3;
                    let mut jong_consumed = 1;

                    if i + consumed + 1 < chars.len() {
                        let c4 = chars[i + consumed + 1];
                        if is_jong(c4)
                            && let Some(combined) = combine_jong(c3, c4)
                        {
                            let next_is_vowel = if i + consumed + 2 < chars.len() {
                                is_jung(chars[i + consumed + 2])
                            } else {
                                false
                            };

                            if !next_is_vowel {
                                jong_char = combined;
                                jong_consumed = 2;
                            }
                        }
                    }

                    let next_is_vowel = if i + consumed + jong_consumed < chars.len() {
                        is_jung(chars[i + consumed + jong_consumed])
                    } else {
                        false
                    };

                    if !next_is_vowel {
                        jong_idx = get_jong_idx(jong_char);
                        consumed += jong_consumed;
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

        result.push(c1);
        i += 1;
    }

    result
}

const CHO_MAP: [char; 19] = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ',
    'ㅌ', 'ㅍ', 'ㅎ',
];

const JUNG_MAP: [char; 21] = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ',
    'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const JONG_MAP: [char; 28] = [
    '\0', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
    'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

fn decompose_jung(jung: char) -> Vec<char> {
    match jung {
        'ㅘ' => vec!['ㅗ', 'ㅏ'],
        'ㅙ' => vec!['ㅗ', 'ㅐ'],
        'ㅚ' => vec!['ㅗ', 'ㅣ'],
        'ㅝ' => vec!['ㅜ', 'ㅓ'],
        'ㅞ' => vec!['ㅜ', 'ㅔ'],
        'ㅟ' => vec!['ㅜ', 'ㅣ'],
        'ㅢ' => vec!['ㅡ', 'ㅣ'],
        _ => vec![jung],
    }
}

fn decompose_jong(jong: char) -> Vec<char> {
    match jong {
        'ㄳ' => vec!['ㄱ', 'ㅅ'],
        'ㄵ' => vec!['ㄴ', 'ㅈ'],
        'ㄶ' => vec!['ㄴ', 'ㅎ'],
        'ㄺ' => vec!['ㄹ', 'ㄱ'],
        'ㄻ' => vec!['ㄹ', 'ㅁ'],
        'ㄼ' => vec!['ㄹ', 'ㅂ'],
        'ㄽ' => vec!['ㄹ', 'ㅅ'],
        'ㄾ' => vec!['ㄹ', 'ㅌ'],
        'ㄿ' => vec!['ㄹ', 'ㅍ'],
        'ㅀ' => vec!['ㄹ', 'ㅎ'],
        'ㅄ' => vec!['ㅂ', 'ㅅ'],
        _ => vec![jong],
    }
}

fn combine_jung(c1: char, c2: char) -> Option<char> {
    match (c1, c2) {
        ('ㅗ', 'ㅏ') => Some('ㅘ'),
        ('ㅗ', 'ㅐ') => Some('ㅙ'),
        ('ㅗ', 'ㅣ') => Some('ㅚ'),
        ('ㅜ', 'ㅓ') => Some('ㅝ'),
        ('ㅜ', 'ㅔ') => Some('ㅞ'),
        ('ㅜ', 'ㅣ') => Some('ㅟ'),
        ('ㅡ', 'ㅣ') => Some('ㅢ'),
        _ => None,
    }
}

fn combine_jong(c1: char, c2: char) -> Option<char> {
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

fn is_cho(c: char) -> bool {
    "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".contains(c)
}

fn is_jung(c: char) -> bool {
    "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".contains(c)
}

fn is_jong(c: char) -> bool {
    "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ".contains(c)
}

fn get_cho_idx(c: char) -> u32 {
    "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
        .chars()
        .position(|x| x == c)
        .unwrap_or(0) as u32
}

fn get_jung_idx(c: char) -> u32 {
    "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
        .chars()
        .position(|x| x == c)
        .unwrap_or(0) as u32
}

fn get_jong_idx(c: char) -> u32 {
    "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"
        .chars()
        .position(|x| x == c)
        .map(|p| p as u32 + 1)
        .unwrap_or(0)
}
