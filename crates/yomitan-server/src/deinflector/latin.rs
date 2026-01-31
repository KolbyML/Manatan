use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("latin/transforms.json"))
        .expect("Failed to parse Latin deinflector data")
}
