use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("german/transforms.json"))
        .expect("Failed to parse German deinflector data")
}
