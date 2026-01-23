use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("transforms.json"))
        .expect("Failed to parse Japanese deinflector data")
}
