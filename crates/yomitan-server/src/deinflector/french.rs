use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("french/transforms.json"))
        .expect("Failed to parse French deinflector data")
}
