use super::transformer::LanguageTransformer;

const OPTIONAL_DIACRITICS: [char; 16] = [
    '\u{0618}', '\u{0619}', '\u{061A}', '\u{064B}', '\u{064C}', '\u{064D}', '\u{064E}', '\u{064F}',
    '\u{0650}', '\u{0651}', '\u{0652}', '\u{0653}', '\u{0654}', '\u{0655}', '\u{0656}', '\u{0670}',
];

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("arabic/transforms.json"))
        .expect("Failed to parse Arabic deinflector data")
}

pub fn strip_diacritics(text: &str) -> String {
    text.chars()
        .filter(|c| !OPTIONAL_DIACRITICS.contains(c))
        .collect()
}
