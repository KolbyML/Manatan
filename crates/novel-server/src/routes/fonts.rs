use std::{
    fs,
    path::{Path, PathBuf},
};

use axum::{
    Json,
    extract::{Path as AxumPath, State},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};

use crate::{error::NovelError, state::NovelState};

const ALLOWED_FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "woff", "woff2"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFontRequest {
    pub name: String,
    pub family: String,
    pub data_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredFont {
    pub name: String,
    pub family: Option<String>,
    pub data_url: String,
}

pub async fn list_fonts(
    State(state): State<NovelState>,
) -> Result<Json<Vec<StoredFont>>, NovelError> {
    let fonts_dir = ensure_fonts_dir(&state)?;
    list_fonts_from_dir(&fonts_dir).map(Json)
}

pub async fn save_font(
    State(state): State<NovelState>,
    Json(payload): Json<SaveFontRequest>,
) -> Result<(), NovelError> {
    let fonts_dir = ensure_fonts_dir(&state)?;
    save_font_to_dir(
        &fonts_dir,
        &payload.name,
        &payload.family,
        &payload.data_url,
    )
}

pub async fn delete_font(
    State(state): State<NovelState>,
    AxumPath(filename): AxumPath<String>,
) -> Result<(), NovelError> {
    let fonts_dir = ensure_fonts_dir(&state)?;
    delete_font_from_dir(&fonts_dir, &filename)
}

fn ensure_fonts_dir(state: &NovelState) -> Result<PathBuf, NovelError> {
    let fonts_dir = state.storage_dir.join("fonts");
    fs::create_dir_all(&fonts_dir)?;
    Ok(fonts_dir)
}

fn sanitize_font_filename(filename: &str) -> Result<String, NovelError> {
    let file_name = Path::new(filename)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| NovelError::BadRequest("invalid font filename".into()))?;

    let sanitized: String = file_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-' | '(' | ')' | ' ') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string();

    if sanitized.is_empty() {
        return Err(NovelError::BadRequest("invalid font filename".into()));
    }

    let extension = Path::new(&sanitized)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .ok_or_else(|| NovelError::BadRequest("font file must have an extension".into()))?;

    if !ALLOWED_FONT_EXTENSIONS.contains(&extension.as_str()) {
        return Err(NovelError::BadRequest("unsupported font type".into()));
    }

    Ok(sanitized)
}

fn decode_font_data_url(data_url: &str) -> Result<Vec<u8>, NovelError> {
    let (metadata, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| NovelError::BadRequest("invalid font payload".into()))?;

    if !metadata.contains(";base64") {
        return Err(NovelError::BadRequest(
            "font payload must be base64 encoded".into(),
        ));
    }

    STANDARD
        .decode(encoded)
        .map_err(|err| NovelError::BadRequest(format!("invalid font payload: {err}")))
}

fn guess_font_mime_type(filename: &str) -> &'static str {
    match Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn family_metadata_path(fonts_dir: &Path, filename: &str) -> Result<PathBuf, NovelError> {
    let sanitized_name = sanitize_font_filename(filename)?;
    let family_marker = Path::new(&sanitized_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| NovelError::BadRequest("invalid font filename".into()))?;
    Ok(fonts_dir.join(format!("{family_marker}.family")))
}

fn list_fonts_from_dir(fonts_dir: &Path) -> Result<Vec<StoredFont>, NovelError> {
    let mut fonts = Vec::new();
    let entries = fs::read_dir(fonts_dir)?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Ok(sanitized_name) = sanitize_font_filename(name) else {
            continue;
        };

        let bytes = fs::read(&path)?;
        let family = family_metadata_path(fonts_dir, &sanitized_name)
            .ok()
            .and_then(|metadata_path| fs::read_to_string(metadata_path).ok())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let data_url = format!(
            "data:{};base64,{}",
            guess_font_mime_type(&sanitized_name),
            STANDARD.encode(bytes)
        );
        fonts.push(StoredFont {
            name: sanitized_name,
            family,
            data_url,
        });
    }

    fonts.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(fonts)
}

fn save_font_to_dir(
    fonts_dir: &Path,
    filename: &str,
    family: &str,
    data_url: &str,
) -> Result<(), NovelError> {
    let sanitized_name = sanitize_font_filename(filename)?;
    let bytes = decode_font_data_url(data_url)?;
    fs::write(fonts_dir.join(&sanitized_name), bytes)?;
    fs::write(family_metadata_path(fonts_dir, &sanitized_name)?, family)?;
    Ok(())
}

fn delete_font_from_dir(fonts_dir: &Path, filename: &str) -> Result<(), NovelError> {
    let sanitized_name = sanitize_font_filename(filename)?;
    let path = fonts_dir.join(&sanitized_name);
    if path.exists() {
        fs::remove_file(path)?;
    }
    let family_path = family_metadata_path(fonts_dir, &sanitized_name)?;
    if family_path.exists() {
        fs::remove_file(family_path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sled::Config;

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("manatan-fonts-{label}-{nanos}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir should be created");
        dir
    }

    fn novel_state(storage_dir: PathBuf) -> NovelState {
        NovelState {
            db: Config::new()
                .temporary(true)
                .open()
                .expect("temporary db should open"),
            storage_dir,
            local_novel_path: PathBuf::new(),
        }
    }

    #[test]
    fn sanitize_font_filename_rejects_unsupported_extensions() {
        let err = sanitize_font_filename("font.txt").expect_err("txt should be rejected");
        assert!(matches!(err, NovelError::BadRequest(_)));
    }

    #[test]
    fn save_and_list_fonts_round_trip() {
        let dir = unique_temp_dir("round-trip");
        let state = novel_state(dir.join("novel"));
        let fonts_dir = ensure_fonts_dir(&state).expect("fonts dir");
        save_font_to_dir(
            &fonts_dir,
            "../Fancy Font.ttf",
            "Fancy Font Family",
            "data:font/ttf;base64,AAECAw==",
        )
        .expect("font should save");

        let fonts = list_fonts_from_dir(&fonts_dir).expect("fonts should list");
        assert_eq!(
            fonts,
            vec![StoredFont {
                name: "Fancy Font.ttf".to_string(),
                family: Some("Fancy Font Family".to_string()),
                data_url: "data:font/ttf;base64,AAECAw==".to_string(),
            }]
        );
    }

    #[test]
    fn delete_font_removes_saved_file() {
        let dir = unique_temp_dir("delete");
        let state = novel_state(dir.join("novel"));
        let fonts_dir = ensure_fonts_dir(&state).expect("fonts dir");
        save_font_to_dir(
            &fonts_dir,
            "DeleteMe.otf",
            "Delete Me Family",
            "data:font/otf;base64,AAECAw==",
        )
        .expect("font should save");

        delete_font_from_dir(&fonts_dir, "DeleteMe.otf").expect("delete should succeed");
        let fonts = list_fonts_from_dir(&fonts_dir).expect("fonts should list");
        assert!(fonts.is_empty());
    }
}
