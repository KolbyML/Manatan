use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("tagalog/transforms.json"))
        .expect("Failed to parse Tagalog deinflector data")
}
