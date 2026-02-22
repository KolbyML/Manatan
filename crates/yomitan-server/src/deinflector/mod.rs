pub mod arabic;
mod chinese;
mod empty;
mod english;
mod french;
mod german;
mod japanese;
mod korean;
mod latin;
mod portuguese;
mod spanish;
mod tagalog;
pub mod transformer;

#[cfg(test)]
mod tests;

use std::collections::HashMap;

use transformer::LanguageTransformer;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Language {
    Japanese,
    English,
    Korean,
    Chinese,
    Arabic,
    Spanish,
    French,
    German,
    Portuguese,
    Bulgarian,
    Czech,
    Danish,
    Greek,
    Estonian,
    Persian,
    Finnish,
    Hebrew,
    Hindi,
    Hungarian,
    Indonesian,
    Italian,
    Latin,
    Lao,
    Latvian,
    Georgian,
    Kannada,
    Khmer,
    Mongolian,
    Maltese,
    Dutch,
    Norwegian,
    Polish,
    Romanian,
    Russian,
    Swedish,
    Thai,
    Tagalog,
    Turkish,
    Ukrainian,
    Vietnamese,
    Welsh,
    Cantonese,
}

#[derive(Debug, Clone)]
pub struct Deinflector {
    transformers: HashMap<Language, LanguageTransformer>,
}

impl Default for Deinflector {
    fn default() -> Self {
        Self::new()
    }
}

impl Deinflector {
    pub fn new() -> Self {
        let mut transformers = HashMap::new();
        transformers.insert(Language::Japanese, japanese::transformer());
        transformers.insert(Language::English, english::transformer());
        transformers.insert(Language::Korean, korean::transformer());
        transformers.insert(Language::Chinese, chinese::transformer());
        transformers.insert(Language::Arabic, arabic::transformer());
        transformers.insert(Language::Spanish, spanish::transformer());
        transformers.insert(Language::French, french::transformer());
        transformers.insert(Language::German, german::transformer());
        transformers.insert(Language::Portuguese, portuguese::transformer());
        transformers.insert(Language::Latin, latin::transformer());
        transformers.insert(Language::Tagalog, tagalog::transformer());
        transformers.insert(Language::Bulgarian, empty::transformer());
        transformers.insert(Language::Czech, empty::transformer());
        transformers.insert(Language::Danish, empty::transformer());
        transformers.insert(Language::Greek, empty::transformer());
        transformers.insert(Language::Estonian, empty::transformer());
        transformers.insert(Language::Persian, empty::transformer());
        transformers.insert(Language::Finnish, empty::transformer());
        transformers.insert(Language::Hebrew, empty::transformer());
        transformers.insert(Language::Hindi, empty::transformer());
        transformers.insert(Language::Hungarian, empty::transformer());
        transformers.insert(Language::Indonesian, empty::transformer());
        transformers.insert(Language::Italian, empty::transformer());
        transformers.insert(Language::Lao, empty::transformer());
        transformers.insert(Language::Latvian, empty::transformer());
        transformers.insert(Language::Georgian, empty::transformer());
        transformers.insert(Language::Kannada, empty::transformer());
        transformers.insert(Language::Khmer, empty::transformer());
        transformers.insert(Language::Mongolian, empty::transformer());
        transformers.insert(Language::Maltese, empty::transformer());
        transformers.insert(Language::Dutch, empty::transformer());
        transformers.insert(Language::Norwegian, empty::transformer());
        transformers.insert(Language::Polish, empty::transformer());
        transformers.insert(Language::Romanian, empty::transformer());
        transformers.insert(Language::Russian, empty::transformer());
        transformers.insert(Language::Swedish, empty::transformer());
        transformers.insert(Language::Thai, empty::transformer());
        transformers.insert(Language::Turkish, empty::transformer());
        transformers.insert(Language::Ukrainian, empty::transformer());
        transformers.insert(Language::Vietnamese, empty::transformer());
        transformers.insert(Language::Welsh, empty::transformer());
        transformers.insert(Language::Cantonese, empty::transformer());
        Self { transformers }
    }

    pub fn deinflect(&self, language: Language, text: &str) -> Vec<String> {
        let transformer = self
            .transformers
            .get(&language)
            .expect("Missing deinflector");
        match language {
            Language::Korean => korean::deinflect(transformer, text),
            _ => transformer.deinflect_terms(text),
        }
    }
}
