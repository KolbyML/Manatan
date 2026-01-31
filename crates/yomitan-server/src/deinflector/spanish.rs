use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("spanish/transforms.json"))
        .expect("Failed to parse Spanish deinflector data")
}
