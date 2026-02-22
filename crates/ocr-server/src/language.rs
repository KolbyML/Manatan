use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum OcrLanguage {
    #[default]
    Japanese,
    English,
    Chinese,
    Korean,
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
            OcrLanguage::Portuguese => "portuguese",
            OcrLanguage::Bulgarian => "bulgarian",
            OcrLanguage::Czech => "czech",
            OcrLanguage::Danish => "danish",
            OcrLanguage::Greek => "greek",
            OcrLanguage::Estonian => "estonian",
            OcrLanguage::Persian => "persian",
            OcrLanguage::Finnish => "finnish",
            OcrLanguage::Hebrew => "hebrew",
            OcrLanguage::Hindi => "hindi",
            OcrLanguage::Hungarian => "hungarian",
            OcrLanguage::Indonesian => "indonesian",
            OcrLanguage::Italian => "italian",
            OcrLanguage::Latin => "latin",
            OcrLanguage::Lao => "lao",
            OcrLanguage::Latvian => "latvian",
            OcrLanguage::Georgian => "georgian",
            OcrLanguage::Kannada => "kannada",
            OcrLanguage::Khmer => "khmer",
            OcrLanguage::Mongolian => "mongolian",
            OcrLanguage::Maltese => "maltese",
            OcrLanguage::Dutch => "dutch",
            OcrLanguage::Norwegian => "norwegian",
            OcrLanguage::Polish => "polish",
            OcrLanguage::Romanian => "romanian",
            OcrLanguage::Russian => "russian",
            OcrLanguage::Swedish => "swedish",
            OcrLanguage::Thai => "thai",
            OcrLanguage::Tagalog => "tagalog",
            OcrLanguage::Turkish => "turkish",
            OcrLanguage::Ukrainian => "ukrainian",
            OcrLanguage::Vietnamese => "vietnamese",
            OcrLanguage::Welsh => "welsh",
            OcrLanguage::Cantonese => "cantonese",
        }
    }

    pub fn prefers_vertical(&self) -> bool {
        matches!(
            self,
            OcrLanguage::Japanese | OcrLanguage::Chinese | OcrLanguage::Cantonese
        )
    }

    pub fn prefers_no_space(&self) -> bool {
        matches!(
            self,
            OcrLanguage::Japanese | OcrLanguage::Chinese | OcrLanguage::Cantonese
        )
    }

    pub fn is_japanese(&self) -> bool {
        matches!(self, OcrLanguage::Japanese)
    }
}
