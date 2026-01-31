use crate::{ServerState, import};
use axum::{
    Json,
    extract::{Multipart, Query, State},
    http::StatusCode,
};
use reqwest::Client;
use regex::Regex;
use scraper::{Html, Selector};
use sha2::{Digest, Sha256};
use serde::{Deserialize, Serialize};
use serde_json::{Value, Value as JsonValue, json};
use std::collections::HashMap;
use tracing::{error, info};
use wordbase_api::{DictionaryId, Record, Term, dict::yomitan::GlossaryTag};

use crate::state::AppState;

#[cfg(target_os = "ios")]
unsafe extern "C" {
    fn malloc_default_zone() -> *mut std::ffi::c_void;
    fn malloc_zone_pressure_relief(zone: *mut std::ffi::c_void, goal: usize);
}

#[derive(Deserialize)]
pub struct LookupParams {
    pub text: String,
    pub index: Option<usize>,
    // Optional toggle for grouping results (defaults to true in handler)
    pub group: Option<bool>,
    pub language: Option<DictionaryLanguage>,
}

#[derive(Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AudioSource {
    Jpod101,
    #[serde(rename = "language-pod-101")]
    LanguagePod101,
    Jisho,
    LinguaLibre,
    Wiktionary,
}

#[derive(Deserialize)]
pub struct AudioParams {
    pub term: String,
    pub reading: Option<String>,
    pub source: AudioSource,
    pub language: Option<DictionaryLanguage>,
}

#[derive(Serialize)]
pub struct AudioResponse {
    pub url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiForm {
    pub headword: String,
    pub reading: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDefinition {
    pub dictionary_name: String,
    pub tags: Vec<String>,
    pub content: JsonValue,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiFrequency {
    pub dictionary_name: String,
    pub value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiGroupedResult {
    pub headword: String,
    pub reading: String,
    pub furigana: Vec<(String, String)>,
    pub glossary: Vec<ApiDefinition>,
    pub frequencies: Vec<ApiFrequency>,
    pub forms: Vec<ApiForm>,
    pub term_tags: Vec<GlossaryTag>,
    // ADDED: Return the length of the match so the frontend can highlight it
    pub match_len: usize,
}

#[derive(Deserialize)]
#[serde(tag = "action", content = "payload")]
pub enum DictionaryAction {
    Toggle { id: i64, enabled: bool },
    Delete { id: i64 },
    Reorder { order: Vec<i64> },
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DictionaryLanguage {
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

impl DictionaryLanguage {
    fn as_str(&self) -> &'static str {
        match self {
            DictionaryLanguage::Japanese => "japanese",
            DictionaryLanguage::English => "english",
            DictionaryLanguage::Chinese => "chinese",
            DictionaryLanguage::Korean => "korean",
            DictionaryLanguage::Arabic => "arabic",
            DictionaryLanguage::Spanish => "spanish",
            DictionaryLanguage::French => "french",
            DictionaryLanguage::German => "german",
            DictionaryLanguage::Portuguese => "portuguese",
            DictionaryLanguage::Bulgarian => "bulgarian",
            DictionaryLanguage::Czech => "czech",
            DictionaryLanguage::Danish => "danish",
            DictionaryLanguage::Greek => "greek",
            DictionaryLanguage::Estonian => "estonian",
            DictionaryLanguage::Persian => "persian",
            DictionaryLanguage::Finnish => "finnish",
            DictionaryLanguage::Hebrew => "hebrew",
            DictionaryLanguage::Hindi => "hindi",
            DictionaryLanguage::Hungarian => "hungarian",
            DictionaryLanguage::Indonesian => "indonesian",
            DictionaryLanguage::Italian => "italian",
            DictionaryLanguage::Latin => "latin",
            DictionaryLanguage::Lao => "lao",
            DictionaryLanguage::Latvian => "latvian",
            DictionaryLanguage::Georgian => "georgian",
            DictionaryLanguage::Kannada => "kannada",
            DictionaryLanguage::Khmer => "khmer",
            DictionaryLanguage::Mongolian => "mongolian",
            DictionaryLanguage::Maltese => "maltese",
            DictionaryLanguage::Dutch => "dutch",
            DictionaryLanguage::Norwegian => "norwegian",
            DictionaryLanguage::Polish => "polish",
            DictionaryLanguage::Romanian => "romanian",
            DictionaryLanguage::Russian => "russian",
            DictionaryLanguage::Swedish => "swedish",
            DictionaryLanguage::Thai => "thai",
            DictionaryLanguage::Tagalog => "tagalog",
            DictionaryLanguage::Turkish => "turkish",
            DictionaryLanguage::Ukrainian => "ukrainian",
            DictionaryLanguage::Vietnamese => "vietnamese",
            DictionaryLanguage::Welsh => "welsh",
            DictionaryLanguage::Cantonese => "cantonese",
        }
    }

    fn to_deinflect_language(&self) -> crate::deinflector::Language {
        match self {
            DictionaryLanguage::Japanese => crate::deinflector::Language::Japanese,
            DictionaryLanguage::English => crate::deinflector::Language::English,
            DictionaryLanguage::Chinese => crate::deinflector::Language::Chinese,
            DictionaryLanguage::Korean => crate::deinflector::Language::Korean,
            DictionaryLanguage::Arabic => crate::deinflector::Language::Arabic,
            DictionaryLanguage::Spanish => crate::deinflector::Language::Spanish,
            DictionaryLanguage::French => crate::deinflector::Language::French,
            DictionaryLanguage::German => crate::deinflector::Language::German,
            DictionaryLanguage::Portuguese => crate::deinflector::Language::Portuguese,
            DictionaryLanguage::Bulgarian => crate::deinflector::Language::Bulgarian,
            DictionaryLanguage::Czech => crate::deinflector::Language::Czech,
            DictionaryLanguage::Danish => crate::deinflector::Language::Danish,
            DictionaryLanguage::Greek => crate::deinflector::Language::Greek,
            DictionaryLanguage::Estonian => crate::deinflector::Language::Estonian,
            DictionaryLanguage::Persian => crate::deinflector::Language::Persian,
            DictionaryLanguage::Finnish => crate::deinflector::Language::Finnish,
            DictionaryLanguage::Hebrew => crate::deinflector::Language::Hebrew,
            DictionaryLanguage::Hindi => crate::deinflector::Language::Hindi,
            DictionaryLanguage::Hungarian => crate::deinflector::Language::Hungarian,
            DictionaryLanguage::Indonesian => crate::deinflector::Language::Indonesian,
            DictionaryLanguage::Italian => crate::deinflector::Language::Italian,
            DictionaryLanguage::Latin => crate::deinflector::Language::Latin,
            DictionaryLanguage::Lao => crate::deinflector::Language::Lao,
            DictionaryLanguage::Latvian => crate::deinflector::Language::Latvian,
            DictionaryLanguage::Georgian => crate::deinflector::Language::Georgian,
            DictionaryLanguage::Kannada => crate::deinflector::Language::Kannada,
            DictionaryLanguage::Khmer => crate::deinflector::Language::Khmer,
            DictionaryLanguage::Mongolian => crate::deinflector::Language::Mongolian,
            DictionaryLanguage::Maltese => crate::deinflector::Language::Maltese,
            DictionaryLanguage::Dutch => crate::deinflector::Language::Dutch,
            DictionaryLanguage::Norwegian => crate::deinflector::Language::Norwegian,
            DictionaryLanguage::Polish => crate::deinflector::Language::Polish,
            DictionaryLanguage::Romanian => crate::deinflector::Language::Romanian,
            DictionaryLanguage::Russian => crate::deinflector::Language::Russian,
            DictionaryLanguage::Swedish => crate::deinflector::Language::Swedish,
            DictionaryLanguage::Thai => crate::deinflector::Language::Thai,
            DictionaryLanguage::Tagalog => crate::deinflector::Language::Tagalog,
            DictionaryLanguage::Turkish => crate::deinflector::Language::Turkish,
            DictionaryLanguage::Ukrainian => crate::deinflector::Language::Ukrainian,
            DictionaryLanguage::Vietnamese => crate::deinflector::Language::Vietnamese,
            DictionaryLanguage::Welsh => crate::deinflector::Language::Welsh,
            DictionaryLanguage::Cantonese => crate::deinflector::Language::Cantonese,
        }
    }

    fn from_str(value: &str) -> Option<Self> {
        match value.trim().to_lowercase().as_str() {
            "japanese" => Some(DictionaryLanguage::Japanese),
            "english" => Some(DictionaryLanguage::English),
            "chinese" => Some(DictionaryLanguage::Chinese),
            "korean" => Some(DictionaryLanguage::Korean),
            "arabic" => Some(DictionaryLanguage::Arabic),
            "spanish" => Some(DictionaryLanguage::Spanish),
            "french" => Some(DictionaryLanguage::French),
            "german" => Some(DictionaryLanguage::German),
            "portuguese" => Some(DictionaryLanguage::Portuguese),
            "bulgarian" => Some(DictionaryLanguage::Bulgarian),
            "czech" => Some(DictionaryLanguage::Czech),
            "danish" => Some(DictionaryLanguage::Danish),
            "greek" => Some(DictionaryLanguage::Greek),
            "estonian" => Some(DictionaryLanguage::Estonian),
            "persian" => Some(DictionaryLanguage::Persian),
            "finnish" => Some(DictionaryLanguage::Finnish),
            "hebrew" => Some(DictionaryLanguage::Hebrew),
            "hindi" => Some(DictionaryLanguage::Hindi),
            "hungarian" => Some(DictionaryLanguage::Hungarian),
            "indonesian" => Some(DictionaryLanguage::Indonesian),
            "italian" => Some(DictionaryLanguage::Italian),
            "latin" => Some(DictionaryLanguage::Latin),
            "lao" => Some(DictionaryLanguage::Lao),
            "latvian" => Some(DictionaryLanguage::Latvian),
            "georgian" => Some(DictionaryLanguage::Georgian),
            "kannada" => Some(DictionaryLanguage::Kannada),
            "khmer" => Some(DictionaryLanguage::Khmer),
            "mongolian" => Some(DictionaryLanguage::Mongolian),
            "maltese" => Some(DictionaryLanguage::Maltese),
            "dutch" => Some(DictionaryLanguage::Dutch),
            "norwegian" => Some(DictionaryLanguage::Norwegian),
            "polish" => Some(DictionaryLanguage::Polish),
            "romanian" => Some(DictionaryLanguage::Romanian),
            "russian" => Some(DictionaryLanguage::Russian),
            "swedish" => Some(DictionaryLanguage::Swedish),
            "thai" => Some(DictionaryLanguage::Thai),
            "tagalog" => Some(DictionaryLanguage::Tagalog),
            "turkish" => Some(DictionaryLanguage::Turkish),
            "ukrainian" => Some(DictionaryLanguage::Ukrainian),
            "vietnamese" => Some(DictionaryLanguage::Vietnamese),
            "welsh" => Some(DictionaryLanguage::Welsh),
            "cantonese" => Some(DictionaryLanguage::Cantonese),
            _ => None,
        }
    }
}

struct AudioLanguageSummary {
    iso: &'static str,
    iso639_3: &'static str,
    pod101_name: Option<&'static str>,
}

fn get_audio_language_summary(language: DictionaryLanguage) -> AudioLanguageSummary {
    match language {
        DictionaryLanguage::Japanese => AudioLanguageSummary { iso: "ja", iso639_3: "jpn", pod101_name: Some("Japanese") },
        DictionaryLanguage::English => AudioLanguageSummary { iso: "en", iso639_3: "eng", pod101_name: Some("English") },
        DictionaryLanguage::Chinese => AudioLanguageSummary { iso: "zh", iso639_3: "zho", pod101_name: Some("Chinese") },
        DictionaryLanguage::Korean => AudioLanguageSummary { iso: "ko", iso639_3: "kor", pod101_name: Some("Korean") },
        DictionaryLanguage::Arabic => AudioLanguageSummary { iso: "ar", iso639_3: "ara", pod101_name: Some("Arabic") },
        DictionaryLanguage::Spanish => AudioLanguageSummary { iso: "es", iso639_3: "spa", pod101_name: Some("Spanish") },
        DictionaryLanguage::French => AudioLanguageSummary { iso: "fr", iso639_3: "fra", pod101_name: Some("French") },
        DictionaryLanguage::German => AudioLanguageSummary { iso: "de", iso639_3: "deu", pod101_name: Some("German") },
        DictionaryLanguage::Portuguese => AudioLanguageSummary { iso: "pt", iso639_3: "por", pod101_name: Some("Portuguese") },
        DictionaryLanguage::Bulgarian => AudioLanguageSummary { iso: "bg", iso639_3: "bul", pod101_name: Some("Bulgarian") },
        DictionaryLanguage::Czech => AudioLanguageSummary { iso: "cs", iso639_3: "ces", pod101_name: Some("Czech") },
        DictionaryLanguage::Danish => AudioLanguageSummary { iso: "da", iso639_3: "dan", pod101_name: Some("Danish") },
        DictionaryLanguage::Greek => AudioLanguageSummary { iso: "el", iso639_3: "ell", pod101_name: Some("Greek") },
        DictionaryLanguage::Estonian => AudioLanguageSummary { iso: "et", iso639_3: "est", pod101_name: None },
        DictionaryLanguage::Persian => AudioLanguageSummary { iso: "fa", iso639_3: "fas", pod101_name: Some("Persian") },
        DictionaryLanguage::Finnish => AudioLanguageSummary { iso: "fi", iso639_3: "fin", pod101_name: Some("Finnish") },
        DictionaryLanguage::Hebrew => AudioLanguageSummary { iso: "he", iso639_3: "heb", pod101_name: Some("Hebrew") },
        DictionaryLanguage::Hindi => AudioLanguageSummary { iso: "hi", iso639_3: "hin", pod101_name: Some("Hindi") },
        DictionaryLanguage::Hungarian => AudioLanguageSummary { iso: "hu", iso639_3: "hun", pod101_name: Some("Hungarian") },
        DictionaryLanguage::Indonesian => AudioLanguageSummary { iso: "id", iso639_3: "ind", pod101_name: Some("Indonesian") },
        DictionaryLanguage::Italian => AudioLanguageSummary { iso: "it", iso639_3: "ita", pod101_name: Some("Italian") },
        DictionaryLanguage::Latin => AudioLanguageSummary { iso: "la", iso639_3: "lat", pod101_name: None },
        DictionaryLanguage::Lao => AudioLanguageSummary { iso: "lo", iso639_3: "lao", pod101_name: None },
        DictionaryLanguage::Latvian => AudioLanguageSummary { iso: "lv", iso639_3: "lav", pod101_name: None },
        DictionaryLanguage::Georgian => AudioLanguageSummary { iso: "ka", iso639_3: "kat", pod101_name: None },
        DictionaryLanguage::Kannada => AudioLanguageSummary { iso: "kn", iso639_3: "kan", pod101_name: None },
        DictionaryLanguage::Khmer => AudioLanguageSummary { iso: "km", iso639_3: "khm", pod101_name: None },
        DictionaryLanguage::Mongolian => AudioLanguageSummary { iso: "mn", iso639_3: "mon", pod101_name: None },
        DictionaryLanguage::Maltese => AudioLanguageSummary { iso: "mt", iso639_3: "mlt", pod101_name: None },
        DictionaryLanguage::Dutch => AudioLanguageSummary { iso: "nl", iso639_3: "nld", pod101_name: Some("Dutch") },
        DictionaryLanguage::Norwegian => AudioLanguageSummary { iso: "no", iso639_3: "nor", pod101_name: Some("Norwegian") },
        DictionaryLanguage::Polish => AudioLanguageSummary { iso: "pl", iso639_3: "pol", pod101_name: Some("Polish") },
        DictionaryLanguage::Romanian => AudioLanguageSummary { iso: "ro", iso639_3: "ron", pod101_name: Some("Romanian") },
        DictionaryLanguage::Russian => AudioLanguageSummary { iso: "ru", iso639_3: "rus", pod101_name: Some("Russian") },
        DictionaryLanguage::Swedish => AudioLanguageSummary { iso: "sv", iso639_3: "swe", pod101_name: Some("Swedish") },
        DictionaryLanguage::Thai => AudioLanguageSummary { iso: "th", iso639_3: "tha", pod101_name: Some("Thai") },
        DictionaryLanguage::Tagalog => AudioLanguageSummary { iso: "tl", iso639_3: "tgl", pod101_name: Some("Filipino") },
        DictionaryLanguage::Turkish => AudioLanguageSummary { iso: "tr", iso639_3: "tur", pod101_name: Some("Turkish") },
        DictionaryLanguage::Ukrainian => AudioLanguageSummary { iso: "uk", iso639_3: "ukr", pod101_name: None },
        DictionaryLanguage::Vietnamese => AudioLanguageSummary { iso: "vi", iso639_3: "vie", pod101_name: Some("Vietnamese") },
        DictionaryLanguage::Welsh => AudioLanguageSummary { iso: "cy", iso639_3: "cym", pod101_name: None },
        DictionaryLanguage::Cantonese => AudioLanguageSummary { iso: "yue", iso639_3: "yue", pod101_name: Some("Cantonese") },
    }
}

fn get_language_pod101_fetch_url(language: &str) -> Result<String, anyhow::Error> {
    let pod_or_class = match language {
        "Afrikaans" | "Arabic" | "Bulgarian" | "Dutch" | "Filipino" | "Finnish" | "French" | "German" | "Greek"
        | "Hebrew" | "Hindi" | "Hungarian" | "Indonesian" | "Italian" | "Japanese" | "Persian" | "Polish"
        | "Portuguese" | "Romanian" | "Russian" | "Spanish" | "Swahili" | "Swedish" | "Thai" | "Urdu"
        | "Vietnamese" => "pod",
        "Cantonese" | "Chinese" | "Czech" | "Danish" | "English" | "Korean" | "Norwegian" | "Turkish" => "class",
        _ => return Err(anyhow::anyhow!("Invalid language for LanguagePod101")),
    };
    let lower = language.to_lowercase();
    Ok(format!(
        "https://www.{}{}101.com/learningcenter/reference/dictionary_post",
        lower, pod_or_class
    ))
}

fn is_string_entirely_kana(text: &str) -> bool {
    if text.is_empty() {
        return false;
    }
    text.chars().all(|char| {
        let code = char as u32;
        (0x3040..=0x30ff).contains(&code) || (0x31f0..=0x31ff).contains(&code) || code == 0x30fc
    })
}

fn normalize_url(url: &str, base: &str) -> String {
    if url.starts_with("//") {
        format!("https:{}", url)
    } else if url.starts_with("/") {
        format!("{}{}", base.trim_end_matches('/'), url)
    } else {
        url.to_string()
    }
}

async fn fetch_language_pod101_urls(
    client: &Client,
    term: &str,
    reading: &str,
    summary: &AudioLanguageSummary,
) -> Result<Vec<String>, anyhow::Error> {
    let mut reading = reading.to_string();
    if reading.is_empty() && is_string_entirely_kana(term) {
        reading = term.to_string();
    }
    let language = match summary.pod101_name {
        Some(name) => name,
        None => return Ok(Vec::new()),
    };
    let fetch_url = get_language_pod101_fetch_url(language)?;
    let data = [
        ("post", "dictionary_reference"),
        ("match_type", "exact"),
        ("search_query", term),
        ("vulgar", "true"),
    ];
    let response = client
        .post(&fetch_url)
        .header("User-Agent", "Mozilla/5.0")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&data)
        .send()
        .await?;
    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let response_url = response.url().clone();
    let response_text = response.text().await?;
    let document = Html::parse_document(&response_text);
    let row_selector = match Selector::parse(".dc-result-row") {
        Ok(selector) => selector,
        Err(_) => return Ok(Vec::new()),
    };
    let audio_selector = match Selector::parse("audio source") {
        Ok(selector) => selector,
        Err(_) => return Ok(Vec::new()),
    };
    let reading_selector = match Selector::parse(".dc-vocab_kana") {
        Ok(selector) => selector,
        Err(_) => return Ok(Vec::new()),
    };
    let vocab_selector = match Selector::parse(".dc-vocab") {
        Ok(selector) => selector,
        Err(_) => return Ok(Vec::new()),
    };

    let mut urls = Vec::new();
    for row in document.select(&row_selector) {
        let src = row
            .select(&audio_selector)
            .next()
            .and_then(|node| node.value().attr("src"));
        let src = match src {
            Some(value) => value,
            None => continue,
        };

        if language == "Japanese" {
            let html_reading = row
                .select(&reading_selector)
                .next()
                .map(|node| node.text().collect::<String>().trim().to_string())
                .unwrap_or_default();
            if !reading.is_empty() && reading != term && reading != html_reading {
                continue;
            }
        } else {
            let html_term = row
                .select(&vocab_selector)
                .next()
                .map(|node| node.text().collect::<String>().trim().to_string())
                .unwrap_or_default();
            if !html_term.is_empty() && html_term != term {
                continue;
            }
        }

        urls.push(normalize_url(src, response_url.as_str()));
    }

    Ok(urls)
}

async fn fetch_wikimedia_audio_urls<F>(
    client: &Client,
    search_url: &str,
    validate: F,
) -> Result<Vec<String>, anyhow::Error>
where
    F: Fn(&str, &str) -> bool,
{
    let response = client.get(search_url).header("User-Agent", "Mozilla/5.0").send().await?;
    if !response.status().is_success() {
        return Ok(Vec::new());
    }
    let lookup_response: Value = response.json().await?;
    let lookup_results = lookup_response
        .get("query")
        .and_then(|q| q.get("search"))
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default();

    let mut urls = Vec::new();
    for entry in lookup_results {
        let title = match entry.get("title").and_then(|t| t.as_str()) {
            Some(value) => value,
            None => continue,
        };
        let file_info_url = format!(
            "https://commons.wikimedia.org/w/api.php?action=query&format=json&titles={}&prop=imageinfo&iiprop=user|url&origin=*",
            urlencoding::encode(title)
        );
        let response2 = client.get(&file_info_url).header("User-Agent", "Mozilla/5.0").send().await?;
        if !response2.status().is_success() {
            continue;
        }
        let file_response: Value = response2.json().await?;
        let pages = match file_response.get("query").and_then(|q| q.get("pages")).and_then(|p| p.as_object()) {
            Some(value) => value,
            None => continue,
        };
        for page in pages.values() {
            let image_info = match page.get("imageinfo").and_then(|info| info.as_array()).and_then(|arr| arr.get(0)) {
                Some(value) => value,
                None => continue,
            };
            let file_url = match image_info.get("url").and_then(|u| u.as_str()) {
                Some(value) => value,
                None => continue,
            };
            let file_user = match image_info.get("user").and_then(|u| u.as_str()) {
                Some(value) => value,
                None => continue,
            };
            if validate(title, file_user) {
                urls.push(file_url.to_string());
            }
        }
    }
    Ok(urls)
}

async fn fetch_lingua_libre_audio_url(
    client: &Client,
    term: &str,
    summary: &AudioLanguageSummary,
) -> Result<Option<String>, anyhow::Error> {
    let search_category = format!("incategory:\"Lingua_Libre_pronunciation-{}\"", summary.iso639_3);
    let search_string = format!("-{}.wav", term);
    let search_url = format!(
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=intitle:/{}/i+{}&srnamespace=6&origin=*",
        search_string,
        search_category
    );
    let urls = fetch_wikimedia_audio_urls(client, &search_url, |filename, file_user| {
        let pattern = format!(
            r"^File:LL-Q\d+\s+\({}\)-{}-{}\.wav$",
            summary.iso639_3,
            regex::escape(file_user),
            regex::escape(term)
        );
        Regex::new(&pattern).map(|re| re.is_match(filename)).unwrap_or(false)
    })
    .await?;
    Ok(urls.into_iter().next())
}

async fn fetch_wiktionary_audio_url(
    client: &Client,
    term: &str,
    summary: &AudioLanguageSummary,
) -> Result<Option<String>, anyhow::Error> {
    let search_string = format!("{}(-[a-zA-Z]{{2}})?-{}[0123456789]*.ogg", summary.iso, term);
    let search_url = format!(
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=intitle:/{}/i&srnamespace=6&origin=*",
        search_string
    );
    let urls = fetch_wikimedia_audio_urls(client, &search_url, |filename, _file_user| {
        let pattern = format!(r"^File:{}(-\w\w)?-{}\d*\.ogg$", summary.iso, regex::escape(term));
        Regex::new(&pattern).map(|re| re.is_match(filename)).unwrap_or(false)
    })
    .await?;
    Ok(urls.into_iter().next())
}

async fn fetch_jpod101_audio_url(client: &Client, term: &str, reading: &str) -> Result<Option<String>, anyhow::Error> {
    let mut final_term = term.to_string();
    let mut final_reading = reading.to_string();
    if final_reading.is_empty() && is_string_entirely_kana(term) {
        final_reading = term.to_string();
        final_term.clear();
    }
    if final_reading == final_term && is_string_entirely_kana(term) {
        final_reading = term.to_string();
        final_term.clear();
    }

    let mut parts: Vec<String> = Vec::new();
    if !final_term.is_empty() {
        parts.push(format!("kanji={}", urlencoding::encode(&final_term)));
    }
    if !final_reading.is_empty() {
        parts.push(format!("kana={}", urlencoding::encode(&final_reading)));
    }
    let url = format!(
        "https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?{}",
        parts.join("&")
    );

    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let bytes = response.bytes().await?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let digest = format!("{:x}", hasher.finalize());
    if digest == "ae6398b5a27bc8c0a771df6c907ade794be15518174773c58c7c7ddd17098906" {
        return Ok(None);
    }
    Ok(Some(url))
}

async fn fetch_jisho_audio_url(client: &Client, term: &str, reading: &str) -> Result<Option<String>, anyhow::Error> {
    let fetch_url = format!("https://jisho.org/search/{}", urlencoding::encode(term));
    let response = client
        .get(&fetch_url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await?;
    if !response.status().is_success() {
        return Ok(None);
    }
    let response_text = response.text().await?;
    let audio_re = Regex::new(r#"(?s)<audio[^>]*id=\"([^\"]+)\"[^>]*>.*?<source[^>]*src=\"([^\"]+)\""#)?;
    let mut candidates: Vec<(String, String)> = Vec::new();
    for cap in audio_re.captures_iter(&response_text) {
        let id = cap.get(1).map(|m| m.as_str()).unwrap_or("").to_string();
        let src = cap.get(2).map(|m| m.as_str()).unwrap_or("").to_string();
        if !id.is_empty() && !src.is_empty() {
            candidates.push((id, src));
        }
    }

    if candidates.is_empty() {
        return Ok(None);
    }

    let term_key = term.trim();
    let reading_key = reading.trim();
    let mut resolved: Option<(String, String)> = None;
    if !reading_key.is_empty() {
        let suffix = format!(":{}", reading_key);
        resolved = candidates.iter().find(|(id, _)| id.ends_with(&suffix)).cloned();
    }
    if resolved.is_none() && !term_key.is_empty() && term_key != reading_key {
        let suffix = format!(":{}", term_key);
        resolved = candidates.iter().find(|(id, _)| id.ends_with(&suffix)).cloned();
    }
    if resolved.is_none() && !term_key.is_empty() {
        let prefix = format!("audio_{}:", term_key);
        resolved = candidates.iter().find(|(id, _)| id.starts_with(&prefix)).cloned();
    }
    if resolved.is_none() && candidates.len() == 1 {
        resolved = candidates.first().cloned();
    }

    if let Some((_id, src)) = resolved {
        let normalized = normalize_url(&src, "https://jisho.org");
        return Ok(Some(normalized));
    }
    Ok(None)
}

pub async fn audio_handler(
    Query(params): Query<AudioParams>,
) -> Result<Json<AudioResponse>, (StatusCode, Json<Value>)> {
    let client = Client::new();
    let term = params.term.trim();
    let reading = params.reading.as_deref().unwrap_or("").trim();

    if term.is_empty() {
        return Ok(Json(AudioResponse { url: None }));
    }

    let language = params.language.unwrap_or(DictionaryLanguage::Japanese);
    let summary = get_audio_language_summary(language);

    let result = match params.source {
        AudioSource::Jpod101 => fetch_jpod101_audio_url(&client, term, reading).await,
        AudioSource::LanguagePod101 => fetch_language_pod101_urls(&client, term, reading, &summary)
            .await
            .map(|urls| urls.into_iter().next()),
        AudioSource::Jisho => fetch_jisho_audio_url(&client, term, reading).await,
        AudioSource::LinguaLibre => fetch_lingua_libre_audio_url(&client, term, &summary).await,
        AudioSource::Wiktionary => fetch_wiktionary_audio_url(&client, term, &summary).await,
    };

    match result {
        Ok(url) => Ok(Json(AudioResponse { url })),
        Err(err) => {
            error!("Audio lookup failed: {}", err);
            Err((
                StatusCode::BAD_GATEWAY,
                Json(json!({ "status": "error", "message": err.to_string() })),
            ))
        }
    }
}

impl std::fmt::Display for DictionaryLanguage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Deserialize)]
pub struct LanguageRequest {
    pub language: Option<DictionaryLanguage>,
}

pub fn load_preferred_language(app_state: &AppState) -> Option<DictionaryLanguage> {
    let mut conn = app_state.pool.get().ok()?;
    let mut stmt = conn
        .prepare("SELECT value FROM metadata WHERE key = ?")
        .ok()?;
    let value: Option<String> = stmt
        .query_row(["preferred_language"], |row| row.get(0))
        .ok();
    value.and_then(|val| DictionaryLanguage::from_str(&val))
}

fn store_preferred_language(app_state: &AppState, language: DictionaryLanguage) {
    if let Ok(mut conn) = app_state.pool.get() {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('preferred_language', ?)",
            [language.as_str()],
        );
    }
}

fn resolve_language(
    app_state: &AppState,
    language: Option<DictionaryLanguage>,
) -> DictionaryLanguage {
    language
        .or_else(|| load_preferred_language(app_state))
        .unwrap_or(DictionaryLanguage::Japanese)
}

fn dictionary_url(language: DictionaryLanguage) -> &'static str {
    match language {
        DictionaryLanguage::Japanese => {
            "https://github.com/yomidevs/jmdict-yomitan/releases/download/2026-01-26/JMdict_english.zip"
        }
        DictionaryLanguage::Korean => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ko-en.zip"
        }
        DictionaryLanguage::English => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-en-en.zip"
        }
        DictionaryLanguage::Chinese => {
            "https://github.com/MarvNC/cc-cedict-yomitan/releases/latest/download/CC-CEDICT.zip"
        }
        DictionaryLanguage::Arabic => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ar-en.zip"
        }
        DictionaryLanguage::Spanish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-es-en.zip"
        }
        DictionaryLanguage::French => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-fr-en.zip"
        }
        DictionaryLanguage::German => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-de-en.zip"
        }
        DictionaryLanguage::Portuguese => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-pt-en.zip"
        }
        DictionaryLanguage::Bulgarian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-bg-en.zip"
        }
        DictionaryLanguage::Czech => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-cs-en.zip"
        }
        DictionaryLanguage::Danish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-da-en.zip"
        }
        DictionaryLanguage::Greek => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-el-en.zip"
        }
        DictionaryLanguage::Estonian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-et-en.zip"
        }
        DictionaryLanguage::Persian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-fa-en.zip"
        }
        DictionaryLanguage::Finnish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-fi-en.zip"
        }
        DictionaryLanguage::Hebrew => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-he-en.zip"
        }
        DictionaryLanguage::Hindi => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-hi-en.zip"
        }
        DictionaryLanguage::Hungarian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-hu-en.zip"
        }
        DictionaryLanguage::Indonesian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-id-en.zip"
        }
        DictionaryLanguage::Italian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-it-en.zip"
        }
        DictionaryLanguage::Latin => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-la-en.zip"
        }
        DictionaryLanguage::Lao => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-lo-en.zip"
        }
        DictionaryLanguage::Latvian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-lv-en.zip"
        }
        DictionaryLanguage::Georgian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ka-en.zip"
        }
        DictionaryLanguage::Kannada => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-kn-en.zip"
        }
        DictionaryLanguage::Khmer => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-km-en.zip"
        }
        DictionaryLanguage::Mongolian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-mn-en.zip"
        }
        DictionaryLanguage::Maltese => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-mt-en.zip"
        }
        DictionaryLanguage::Dutch => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-nl-en.zip"
        }
        DictionaryLanguage::Norwegian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-no-en.zip"
        }
        DictionaryLanguage::Polish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-pl-en.zip"
        }
        DictionaryLanguage::Romanian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ro-en.zip"
        }
        DictionaryLanguage::Russian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-ru-en.zip"
        }
        DictionaryLanguage::Swedish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-sv-en.zip"
        }
        DictionaryLanguage::Thai => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-th-en.zip"
        }
        DictionaryLanguage::Tagalog => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-tl-en.zip"
        }
        DictionaryLanguage::Turkish => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-tr-en.zip"
        }
        DictionaryLanguage::Ukrainian => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-uk-en.zip"
        }
        DictionaryLanguage::Vietnamese => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-vi-en.zip"
        }
        DictionaryLanguage::Welsh => {
            "https://pub-c3d38cca4dc2403b88934c56748f5144.r2.dev/releases/latest/kty-cy-en.zip"
        }
        DictionaryLanguage::Cantonese => {
            "https://github.com/MarvNC/wordshk-yomitan/releases/download/2024-09-17/Words.hk.2024-09-16.zip"
        }
    }
}

async fn download_dictionary_bytes(language: DictionaryLanguage) -> Result<Vec<u8>, String> {
    let url = dictionary_url(language);
    let client = Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Dictionary download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Dictionary download failed ({}): {}",
            response.status(),
            url
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read dictionary bytes: {e}"))?;

    Ok(bytes.to_vec())
}

fn clear_dictionary_state(app_state: &AppState) {
    let mut dicts = app_state.dictionaries.write().expect("lock");
    dicts.clear();
    let mut next_id = app_state.next_dict_id.write().expect("lock");
    *next_id = 1;

    if let Ok(mut conn) = app_state.pool.get() {
        if let Ok(tx) = conn.transaction() {
            let _ = tx.execute("DELETE FROM terms", []);
            let _ = tx.execute("DELETE FROM dictionaries", []);
            let _ = tx.execute("DELETE FROM metadata", []);
            let _ = tx.commit();
        }
        info!("🧹 [Yomitan] Vacuuming after reset...");
        let _ = conn.execute("VACUUM", []);
    }
}

pub async fn install_language_internal(
    app_state: AppState,
    language: DictionaryLanguage,
) -> Result<String, String> {
    let dict_bytes = download_dictionary_bytes(language).await?;
    let app_state_for_task = app_state.clone();
    let res =
        tokio::task::spawn_blocking(move || import::import_zip(&app_state_for_task, &dict_bytes))
            .await
            .map_err(|e| e.to_string())?;
    res.map_err(|e| e.to_string())
}

pub async fn manage_dictionaries_handler(
    State(state): State<ServerState>,
    Json(action): Json<DictionaryAction>,
) -> Json<Value> {
    let app_state = state.app.clone();

    let res = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let mut conn = app_state.pool.get().map_err(|e| e.to_string())?;
        let mut should_vacuum = false;

        {
            let tx = conn.transaction().map_err(|e| e.to_string())?;

            match action {
                DictionaryAction::Toggle { id, enabled } => {
                    tx.execute(
                        "UPDATE dictionaries SET enabled = ? WHERE id = ?",
                        rusqlite::params![enabled, id],
                    )
                    .map_err(|e| e.to_string())?;

                    let mut dicts = app_state.dictionaries.write().expect("lock");
                    if let Some(d) = dicts.get_mut(&DictionaryId(id)) {
                        d.enabled = enabled;
                    }
                }
                DictionaryAction::Delete { id } => {
                    info!("🗑️ [Yomitan] Deleting dictionary {}...", id);
                    tx.execute(
                        "DELETE FROM terms WHERE dictionary_id = ?",
                        rusqlite::params![id],
                    )
                    .map_err(|e| e.to_string())?;
                    tx.execute(
                        "DELETE FROM dictionaries WHERE id = ?",
                        rusqlite::params![id],
                    )
                    .map_err(|e| e.to_string())?;

                    let mut dicts = app_state.dictionaries.write().expect("lock");
                    dicts.remove(&DictionaryId(id));
                    should_vacuum = true;
                }
                DictionaryAction::Reorder { order } => {
                    let mut stmt = tx
                        .prepare("UPDATE dictionaries SET priority = ? WHERE id = ?")
                        .map_err(|e| e.to_string())?;
                    let mut dicts = app_state.dictionaries.write().expect("lock");

                    for (index, id) in order.iter().enumerate() {
                        let priority = index as i64;
                        stmt.execute(rusqlite::params![priority, id])
                            .map_err(|e| e.to_string())?;

                        if let Some(d) = dicts.get_mut(&DictionaryId(*id)) {
                            d.priority = priority;
                        }
                    }
                }
            }

            tx.commit().map_err(|e| e.to_string())?;
        }

        if should_vacuum {
            info!("🧹 [Yomitan] Vacuuming database to reclaim disk space...");
            conn.execute("VACUUM", []).map_err(|e| e.to_string())?;
            info!("✨ [Yomitan] Vacuum complete.");
        }

        Ok(())
    })
    .await
    .unwrap();

    match res {
        Ok(_) => Json(json!({ "status": "ok" })),
        Err(e) => Json(json!({ "status": "error", "message": e })),
    }
}

pub async fn unload_handler(State(state): State<ServerState>) -> Json<Value> {
    info!("♻️ [Memory] Unload requested...");

    // 1. Drop the heavy Rust struct (Logical Free)
    // This destroys the Vectors holding the 280MB data.
    state.lookup.unload_tokenizer();

    // 2. FORCE SYSTEM ALLOCATOR PURGE (Physical Free)
    // We tell iOS: "We just freed a ton of memory. Please release the cached pages to the OS now."
    #[cfg(any(target_os = "ios"))]
    unsafe {
        info!("🧹 [Memory] Triggering iOS malloc_zone_pressure_relief...");
        let zone = malloc_default_zone();
        if !zone.is_null() {
            // goal = 0 means "free as much as possible"
            malloc_zone_pressure_relief(zone, 0);
        }
    }

    // Optional: Log memory stats if you want to verify in console
    info!("✅ [Memory] Unload & Purge complete.");

    Json(json!({ "status": "ok", "message": "Tokenizer unloaded and memory purged" }))
}

pub async fn install_defaults_handler(
    State(state): State<ServerState>,
    payload: Option<Json<LanguageRequest>>,
) -> Json<Value> {
    let app_state = state.app.clone();
    let language = resolve_language(&app_state, payload.and_then(|val| val.0.language));

    {
        let dicts = app_state.dictionaries.read().expect("lock");
        if !dicts.is_empty() {
            store_preferred_language(&app_state, language);
            return Json(json!({ "status": "ok", "message": "Dictionaries already exist." }));
        }
    }

    info!("📥 [Yomitan] User requested dictionary install ({language})...");
    app_state.set_loading(true);

    let res = install_language_internal(app_state.clone(), language).await;

    app_state.set_loading(false);

    match res {
        Ok(msg) => {
            store_preferred_language(&app_state, language);
            Json(json!({ "status": "ok", "message": msg }))
        }
        Err(e) => {
            error!("❌ [Install Defaults] Failed: {}", e);
            Json(json!({ "status": "error", "message": e }))
        }
    }
}

pub async fn install_language_handler(
    State(state): State<ServerState>,
    payload: Option<Json<LanguageRequest>>,
) -> Json<Value> {
    let app_state = state.app.clone();
    let language = resolve_language(&app_state, payload.and_then(|val| val.0.language));

    {
        let dicts = app_state.dictionaries.read().expect("lock");
        if !dicts.is_empty() {
            store_preferred_language(&app_state, language);
            return Json(json!({ "status": "ok", "message": "Dictionaries already exist." }));
        }
    }

    info!("📥 [Yomitan] Installing dictionary ({language})...");
    app_state.set_loading(true);

    let res = install_language_internal(app_state.clone(), language).await;

    app_state.set_loading(false);

    match res {
        Ok(msg) => {
            store_preferred_language(&app_state, language);
            Json(json!({ "status": "ok", "message": msg }))
        }
        Err(e) => {
            error!("❌ [Install Language] Failed: {}", e);
            Json(json!({ "status": "error", "message": e }))
        }
    }
}

pub async fn reset_db_handler(
    State(state): State<ServerState>,
    payload: Option<Json<LanguageRequest>>,
) -> Json<Value> {
    let app_state = state.app.clone();
    let language = resolve_language(&app_state, payload.and_then(|val| val.0.language));
    info!("🧨 [Yomitan] Resetting Database ({language})...");
    state.app.set_loading(true);

    let clear_state = state.app.clone();
    let clear_res = tokio::task::spawn_blocking(move || {
        clear_dictionary_state(&clear_state);
    })
    .await;

    if let Err(e) = clear_res {
        state.app.set_loading(false);
        error!("❌ [Reset] Failed to clear database: {}", e);
        return Json(json!({ "status": "error", "message": e.to_string() }));
    }

    let res = install_language_internal(app_state.clone(), language).await;
    state.app.set_loading(false);

    match res {
        Ok(_) => {
            store_preferred_language(&app_state, language);
            Json(json!({ "status": "ok", "message": "Database reset successfully." }))
        }
        Err(e) => {
            error!("❌ [Reset] Failed: {}", e);
            Json(json!({ "status": "error", "message": e }))
        }
    }
}

pub async fn lookup_handler(
    State(state): State<ServerState>,
    Query(params): Query<LookupParams>,
) -> Result<Json<Vec<ApiGroupedResult>>, (StatusCode, Json<Value>)> {
    let cursor_idx = params.index.unwrap_or(0);
    let language = params
        .language
        .or_else(|| load_preferred_language(&state.app))
        .unwrap_or(DictionaryLanguage::Japanese);
    // determine if we should group results or return raw dictionary entries
    let should_group = params.group.unwrap_or(true);

    if state.app.is_loading() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "loading", "message": "Dictionaries are importing..." })),
        ));
    }

    let raw_results = state
        .lookup
        .search(&state.app, &params.text, cursor_idx, language.to_deinflect_language());

    let dict_meta: std::collections::HashMap<DictionaryId, String> = {
        let dicts = state.app.dictionaries.read().expect("lock");
        dicts.iter().map(|(k, v)| (*k, v.name.clone())).collect()
    };

    struct Aggregator {
        headword: String,
        reading: String,
        term_tags: Vec<GlossaryTag>,
        furigana: Vec<(String, String)>,
        glossary: Vec<ApiDefinition>,
        frequencies: Vec<ApiFrequency>,
        forms_set: Vec<(String, String)>,
        match_len: usize, // Added to aggregator
    }

    let mut map: Vec<Aggregator> = Vec::new();

    let mut freq_map: HashMap<(String, String), Vec<ApiFrequency>> = HashMap::new();

    let mut flat_results: Vec<ApiGroupedResult> = Vec::new();

    for entry in raw_results {
        let (headword, reading) = match &entry.0.term {
            Term::Full(h, r) => (h.to_string(), r.to_string()),
            Term::Headword(h) => (h.to_string(), "".to_string()),
            Term::Reading(r) => (r.to_string(), "".to_string()),
        };

        if headword.is_empty() {
            continue;
        }

        let match_len = entry.0.span_chars.end as usize;

        let mut is_freq = false;

        let (content_val, tags) = if let Record::YomitanGlossary(gloss) = &entry.0.record {
            use wordbase_api::dict::yomitan::structured::Content;
            if let Some(Content::String(s)) = gloss.content.first() {
                is_freq = s.starts_with("Frequency: ");
            }
            // Simply extract the name field as a string
            let t: Vec<String> = gloss.tags.iter().map(|tag| tag.name.clone()).collect();
            (json!(gloss.content), t)
        } else {
            (json!(entry.0.record), vec![])
        };

        let dict_name = dict_meta
            .get(&entry.0.source)
            .cloned()
            .unwrap_or("Unknown".to_string());

        if is_freq {
            let mut val_str = "Unknown".to_string();
            if let Some(arr) = content_val.as_array() {
                if let Some(first) = arr.get(0) {
                    let raw = first.as_str().unwrap_or("");
                    val_str = raw.replace("Frequency: ", "").trim().to_string();
                    if raw.is_empty() {
                        if let Some(obj) = first.get("content") {
                            if let Some(s) = obj.as_str() {
                                val_str = s.replace("Frequency: ", "").trim().to_string();
                            }
                        }
                    }
                }
            }

            let freq_obj = ApiFrequency {
                dictionary_name: dict_name,
                value: val_str,
            };

            // Store in map instead of pushing to results immediately.
            freq_map
                .entry((headword.clone(), reading.clone()))
                .or_default()
                .push(freq_obj);
        } else {
            // === DEFINITION LOGIC ===
            let def_obj = ApiDefinition {
                dictionary_name: dict_name,
                tags,
                content: content_val,
            };

            if should_group {
                if let Some(existing) = map
                    .iter_mut()
                    .find(|agg| agg.headword == headword && agg.reading == reading)
                {
                    let is_dup = existing.glossary.iter().any(|d| {
                        d.dictionary_name == def_obj.dictionary_name
                            && d.content.to_string() == def_obj.content.to_string()
                    });
                    if !is_dup {
                        existing.glossary.push(def_obj);
                    }
                } else {
                    map.push(Aggregator {
                        headword: headword.clone(),
                        reading: reading.clone(),
                        furigana: calculate_furigana(&headword, &reading),
                        glossary: vec![def_obj],
                        frequencies: vec![], // Will be filled in final pass
                        term_tags: entry.1.unwrap_or_default(),
                        forms_set: vec![(headword.clone(), reading.clone())],
                        match_len,
                    });
                }
            } else {
                flat_results.push(ApiGroupedResult {
                    headword: headword.clone(),
                    reading: reading.clone(),
                    furigana: calculate_furigana(&headword, &reading),
                    glossary: vec![def_obj],
                    frequencies: vec![], // Will be filled in final pass
                    term_tags: entry.1.unwrap_or_default(),
                    forms: vec![ApiForm {
                        headword: headword.clone(),
                        reading: reading.clone(),
                    }],
                    match_len,
                });
            }
        }
    }

    if should_group {
        let final_results = map
            .into_iter()
            .map(|mut agg| {
                // Attach frequencies if they exist for this word
                if let Some(freqs) = freq_map.get(&(agg.headword.clone(), agg.reading.clone())) {
                    agg.frequencies.extend(freqs.clone());
                }

                ApiGroupedResult {
                    headword: agg.headword,
                    reading: agg.reading,
                    furigana: agg.furigana,
                    glossary: agg.glossary,
                    frequencies: agg.frequencies,
                    term_tags: agg.term_tags,
                    forms: agg
                        .forms_set
                        .into_iter()
                        .map(|(h, r)| ApiForm {
                            headword: h,
                            reading: r,
                        })
                        .collect(),
                    match_len: agg.match_len,
                }
            })
            .collect();

        Ok(Json(final_results))
    } else {
        // Iterate through results and attach frequencies to ALL of them.
        for res in &mut flat_results {
            if let Some(freqs) = freq_map.get(&(res.headword.clone(), res.reading.clone())) {
                res.frequencies.extend(freqs.clone());
            }
        }

        Ok(Json(flat_results))
    }
}

fn calculate_furigana(headword: &str, reading: &str) -> Vec<(String, String)> {
    if reading.is_empty() || headword == reading {
        return vec![(headword.to_string(), String::new())];
    }
    let h_chars: Vec<char> = headword.chars().collect();
    let r_chars: Vec<char> = reading.chars().collect();
    let mut h_start = 0;
    let mut h_end = h_chars.len();
    let mut r_start = 0;
    let mut r_end = r_chars.len();
    while h_start < h_end && r_start < r_end && h_chars[h_start] == r_chars[r_start] {
        h_start += 1;
        r_start += 1;
    }
    while h_end > h_start && r_end > r_start && h_chars[h_end - 1] == r_chars[r_end - 1] {
        h_end -= 1;
        r_end -= 1;
    }
    let mut parts = Vec::new();
    if h_start > 0 {
        parts.push((h_chars[0..h_start].iter().collect(), String::new()));
    }
    if h_start < h_end {
        parts.push((
            h_chars[h_start..h_end].iter().collect(),
            r_chars[r_start..r_end].iter().collect(),
        ));
    }
    if h_end < h_chars.len() {
        parts.push((h_chars[h_end..].iter().collect(), String::new()));
    }
    parts
}

pub async fn list_dictionaries_handler(State(state): State<ServerState>) -> Json<Value> {
    let dicts = state.app.dictionaries.read().expect("lock");
    let mut list: Vec<_> = dicts.values().cloned().collect();
    list.sort_by_key(|d| d.priority);
    Json(
        json!({ "dictionaries": list, "status": if state.app.is_loading() { "loading" } else { "ready" } }),
    )
}

pub async fn import_handler(
    State(state): State<ServerState>,
    mut multipart: Multipart,
) -> Json<Value> {
    loop {
        match multipart.next_field().await {
            Ok(Some(field)) => {
                if field.name() == Some("file") {
                    match field.bytes().await {
                        Ok(data) => {
                            info!("📥 [Import API] Received upload ({} bytes)", data.len());
                            let app_state = state.app.clone();
                            let res = tokio::task::spawn_blocking(move || {
                                import::import_zip(&app_state, &data)
                            })
                            .await
                            .unwrap();
                            return match res {
                                Ok(msg) => {
                                    info!("✅ {}", msg);
                                    Json(json!({ "status": "ok", "message": msg }))
                                }
                                Err(e) => {
                                    error!("❌ {}", e);
                                    Json(json!({ "status": "error", "message": e.to_string() }))
                                }
                            };
                        }
                        Err(e) => {
                            return Json(
                                json!({ "status": "error", "message": format!("Upload Failed: {}", e) }),
                            );
                        }
                    }
                }
            }
            Ok(None) => break,
            Err(e) => {
                error!("❌ [Import API] Multipart error: {}", e);
                return Json(
                    json!({ "status": "error", "message": format!("Multipart Error: {}", e) }),
                );
            }
        }
    }
    Json(json!({ "status": "error", "message": "No file field found" }))
}
