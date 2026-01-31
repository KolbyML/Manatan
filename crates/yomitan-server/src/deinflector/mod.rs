pub mod arabic;
mod chinese;
mod english;
mod french;
mod german;
mod japanese;
mod korean;
mod spanish;
pub mod transformer;

#[cfg(test)]
mod tests;

use transformer::LanguageTransformer;

#[derive(Debug, Clone, Copy)]
pub enum Language {
    Japanese,
    English,
    Korean,
    Chinese,
    Arabic,
    Spanish,
    French,
    German,
}

#[derive(Debug, Clone)]
pub struct Deinflector {
    japanese: LanguageTransformer,
    english: LanguageTransformer,
    korean: LanguageTransformer,
    chinese: LanguageTransformer,
    arabic: LanguageTransformer,
    spanish: LanguageTransformer,
    french: LanguageTransformer,
    german: LanguageTransformer,
}

impl Deinflector {
    pub fn new() -> Self {
        Self {
            japanese: japanese::transformer(),
            english: english::transformer(),
            korean: korean::transformer(),
            chinese: chinese::transformer(),
            arabic: arabic::transformer(),
            spanish: spanish::transformer(),
            french: french::transformer(),
            german: german::transformer(),
        }
    }

    pub fn deinflect(&self, language: Language, text: &str) -> Vec<String> {
        match language {
            Language::Japanese => self.japanese.deinflect_terms(text),
            Language::English => self.english.deinflect_terms(text),
            Language::Korean => korean::deinflect(&self.korean, text),
            Language::Chinese => self.chinese.deinflect_terms(text),
            Language::Arabic => self.arabic.deinflect_terms(text),
            Language::Spanish => self.spanish.deinflect_terms(text),
            Language::French => self.french.deinflect_terms(text),
            Language::German => self.german.deinflect_terms(text),
        }
    }
}
