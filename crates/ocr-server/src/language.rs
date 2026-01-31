use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OcrLanguage {
    Japanese,
    English,
    Chinese,
    Korean,
    Arabic,
    Spanish,
    French,
    German,
}

impl OcrLanguage {
    pub fn as_str(&self) -> &'static str {
        match self {
            OcrLanguage::Japanese => "japanese",
            OcrLanguage::English => "english",
            OcrLanguage::Chinese => "chinese",
            OcrLanguage::Korean => "korean",
            OcrLanguage::Arabic => "arabic",
            OcrLanguage::Spanish => "spanish",
            OcrLanguage::French => "french",
            OcrLanguage::German => "german",
        }
    }

    pub fn prefers_vertical(&self) -> bool {
        matches!(self, OcrLanguage::Japanese | OcrLanguage::Chinese)
    }

    pub fn prefers_no_space(&self) -> bool {
        matches!(self, OcrLanguage::Japanese | OcrLanguage::Chinese)
    }

    pub fn is_japanese(&self) -> bool {
        matches!(self, OcrLanguage::Japanese)
    }
}

impl Default for OcrLanguage {
    fn default() -> Self {
        OcrLanguage::Japanese
    }
}
