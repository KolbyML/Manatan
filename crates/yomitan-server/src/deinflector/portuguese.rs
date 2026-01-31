use super::transformer::LanguageTransformer;

pub fn transformer() -> LanguageTransformer {
    LanguageTransformer::from_json(include_str!("portuguese/transforms.json"))
        .expect("Failed to parse Portuguese deinflector data")
}
