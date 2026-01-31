use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("empty/transforms.json"))
        .expect("Failed to parse empty deinflector data")
}
