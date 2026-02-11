use std::{io::Cursor, time::Duration};

use anyhow::anyhow;
use chrome_lens_ocr::LensClient;
use image::{DynamicImage, GenericImageView, ImageBuffer, ImageFormat, ImageReader};
use reqwest::header::ACCEPT;
use serde::{Deserialize, Serialize};

use crate::{
    language::OcrLanguage,
    merge::{self, MergeConfig},
};

// --- REST Structs ---

#[derive(Deserialize)]
struct SettingsResponse {
    settings: Option<ProxySettingsRaw>,
}

#[derive(Deserialize)]
struct ProxySettingsRaw {
    #[serde(rename = "socksProxyEnabled")]
    socks_proxy_enabled: Option<bool>,
    #[serde(rename = "socksProxyVersion")]
    socks_proxy_version: Option<i32>,
    #[serde(rename = "socksProxyHost")]
    socks_proxy_host: Option<String>,
    #[serde(rename = "socksProxyPort")]
    socks_proxy_port: Option<String>,
    #[serde(rename = "socksProxyUsername")]
    socks_proxy_username: Option<String>,
    #[serde(rename = "socksProxyPassword")]
    socks_proxy_password: Option<String>,
}

#[derive(Clone, Debug)]
struct ProxySettings {
    socks_proxy_enabled: bool,
    socks_proxy_version: i32,
    socks_proxy_host: String,
    socks_proxy_port: String,
    socks_proxy_username: Option<String>,
    socks_proxy_password: Option<String>,
}

async fn get_proxy_settings(
    user: Option<String>,
    pass: Option<String>,
) -> anyhow::Result<Option<ProxySettings>> {
    let client = reqwest::Client::new();
    let settings_url = "http://127.0.0.1:4568/api/v1/settings";
    let mut request = client.get(settings_url).header(ACCEPT, "application/json");
    if let Some(username) = user {
        request = request.basic_auth(username, pass);
    }
    let response = request.send().await?;
    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "[Failed to read body]".to_string());
        return Err(anyhow!(
            "REST request failed (Status: {status}). Body: {body}"
        ));
    }
    let json_response: SettingsResponse = response
        .json()
        .await
        .map_err(|err| anyhow!("Error decoding settings REST response: {err}"))?;
    let Some(raw) = json_response.settings else {
        return Ok(None);
    };
    let settings = ProxySettings {
        socks_proxy_enabled: raw.socks_proxy_enabled.unwrap_or(false),
        socks_proxy_version: raw.socks_proxy_version.unwrap_or(5),
        socks_proxy_host: raw.socks_proxy_host.unwrap_or_default(),
        socks_proxy_port: raw.socks_proxy_port.unwrap_or_default(),
        socks_proxy_username: raw
            .socks_proxy_username
            .filter(|value| !value.is_empty()),
        socks_proxy_password: raw
            .socks_proxy_password
            .filter(|value| !value.is_empty()),
    };
    Ok(Some(settings))
}

pub async fn resolve_total_pages_from_graphql(
    chapter_base_url: &str,
    user: Option<String>,
    pass: Option<String>,
) -> anyhow::Result<usize> {
    resolve_total_pages_from_rest(chapter_base_url, user, pass).await
}

#[derive(Deserialize)]
struct RestPageList {
    pages: Vec<String>,
}

fn derive_api_base(chapter_base_url: &str) -> String {
    if let Ok(parsed) = reqwest::Url::parse(chapter_base_url) {
        let scheme = parsed.scheme();
        let host = parsed.host_str().unwrap_or("127.0.0.1");
        let port = parsed
            .port()
            .map(|value| format!(":{}", value))
            .unwrap_or_default();
        format!("{}://{}{}", scheme, host, port)
    } else {
        "http://127.0.0.1:4568".to_string()
    }
}

pub async fn resolve_total_pages_from_rest(
    chapter_base_url: &str,
    user: Option<String>,
    pass: Option<String>,
) -> anyhow::Result<usize> {
    let path = get_cache_key(chapter_base_url, None);
    let parts: Vec<&str> = path.split('/').collect();
    let manga_id_str = parts
        .iter()
        .find(|&part| *part == "manga")
        .and_then(|_| parts.get(parts.iter().position(|&part| part == "manga")? + 1))
        .ok_or_else(|| anyhow!("Failed to parse manga ID from URL: {chapter_base_url}"))?;
    let chapter_index_str = parts
        .iter()
        .find(|&part| *part == "chapter")
        .and_then(|_| parts.get(parts.iter().position(|&part| part == "chapter")? + 1))
        .ok_or_else(|| anyhow!("Failed to parse chapter index from URL: {chapter_base_url}"))?;

    let api_base = derive_api_base(chapter_base_url);
    let url = format!(
        "{}/api/v1/manga/{}/chapter/{}/pages",
        api_base, manga_id_str, chapter_index_str
    );

    let client = reqwest::Client::new();
    let mut request = client.get(url).header(ACCEPT, "application/json");
    if let Some(username) = user {
        request = request.basic_auth(username, pass);
    }
    let response = request.send().await?;
    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "[Failed to read body]".to_string());
        return Err(anyhow!(
            "REST request failed (Status: {status}). Body: {body}"
        ));
    }
    let list: RestPageList = response
        .json()
        .await
        .map_err(|err| anyhow!("Error decoding REST response: {err}"))?;
    Ok(list.pages.len())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OcrResult {
    pub text: String,

    #[serde(rename = "tightBoundingBox")]
    pub tight_bounding_box: BoundingBox,

    #[serde(rename = "isMerged", skip_serializing_if = "Option::is_none")]
    pub is_merged: Option<bool>,

    #[serde(rename = "forcedOrientation", skip_serializing_if = "Option::is_none")]
    pub forced_orientation: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f64>,
}

/// Helper to strip the scheme/host/query from the URL for caching purposes.
pub fn get_cache_key(url: &str, language: Option<OcrLanguage>) -> String {
    let raw = if let Ok(parsed) = reqwest::Url::parse(url) {
        let mut path = parsed.path().to_string();
        if let Some(query) = parsed.query() {
            if !query.is_empty() {
                // "sourceId" does not affect the actual image bytes for Suwayomi page URLs,
                // but it does vary between requests. Strip it to keep cache hits stable.
                let kept_parts: Vec<&str> = query
                    .split('&')
                    .filter(|part| {
                        let key = part.split('=').next().unwrap_or("");
                        key != "sourceId"
                    })
                    .collect();

                if !kept_parts.is_empty() {
                    path.push('?');
                    path.push_str(&kept_parts.join("&"));
                }
            }
        }
        path
    } else {
        url.to_string()
    };

    if let Some(language) = language {
        let trimmed = raw.trim_start_matches('/');
        if trimmed.is_empty() {
            format!("lang/{}/", language.as_str())
        } else {
            format!("lang/{}/{}", language.as_str(), trimmed)
        }
    } else {
        raw
    }
}

fn post_process_text(text: String, language: OcrLanguage) -> String {
    if language.prefers_no_space() {
        text.replace(char::is_whitespace, "")
    } else {
        text
    }
}

fn decode_avif_custom(bytes: &[u8]) -> anyhow::Result<DynamicImage> {
    let mut reader = Cursor::new(bytes);

    let decoder = avif_decode::Decoder::from_reader(&mut reader)
        .map_err(|e| anyhow!("avif-decode failed to parse: {e:?}"))?;

    let image = decoder
        .to_image()
        .map_err(|e| anyhow!("avif-decode failed to decode: {e:?}"))?;

    match image {
        avif_decode::Image::Rgb8(img) => {
            let raw_data: Vec<u8> = img.buf().iter().flat_map(|p| [p.r, p.g, p.b]).collect();
            let buffer = ImageBuffer::from_raw(img.width() as u32, img.height() as u32, raw_data)
                .ok_or_else(|| anyhow!("Failed to create RGB8 buffer"))?;
            Ok(DynamicImage::ImageRgb8(buffer))
        }
        avif_decode::Image::Rgba8(img) => {
            let raw_data: Vec<u8> = img
                .buf()
                .iter()
                .flat_map(|p| [p.r, p.g, p.b, p.a])
                .collect();
            let buffer = ImageBuffer::from_raw(img.width() as u32, img.height() as u32, raw_data)
                .ok_or_else(|| anyhow!("Failed to create RGBA8 buffer"))?;
            Ok(DynamicImage::ImageRgba8(buffer))
        }
        avif_decode::Image::Rgb16(img) => {
            let raw_data: Vec<u8> = img
                .buf()
                .iter()
                .flat_map(|p| [(p.r >> 8) as u8, (p.g >> 8) as u8, (p.b >> 8) as u8])
                .collect();
            let buffer = ImageBuffer::from_raw(img.width() as u32, img.height() as u32, raw_data)
                .ok_or_else(|| anyhow!("Failed to create RGB8 buffer from 16-bit"))?;
            Ok(DynamicImage::ImageRgb8(buffer))
        }
        avif_decode::Image::Rgba16(img) => {
            let raw_data: Vec<u8> = img
                .buf()
                .iter()
                .flat_map(|p| {
                    [
                        (p.r >> 8) as u8,
                        (p.g >> 8) as u8,
                        (p.b >> 8) as u8,
                        (p.a >> 8) as u8,
                    ]
                })
                .collect();
            let buffer = ImageBuffer::from_raw(img.width() as u32, img.height() as u32, raw_data)
                .ok_or_else(|| anyhow!("Failed to create RGBA8 buffer from 16-bit"))?;
            Ok(DynamicImage::ImageRgba8(buffer))
        }
        _ => Err(anyhow!("Unsupported AVIF color type")),
    }
}

pub async fn fetch_and_process(
    url: &str,
    user: Option<String>,
    pass: Option<String>,
    add_space_on_merge: Option<bool>,
    language: OcrLanguage,
) -> anyhow::Result<Vec<OcrResult>> {
    let mut last_error = anyhow!("Unknown error");

    for attempt_number in 1..=3 {
        match fetch_and_process_internal(
            url,
            user.clone(),
            pass.clone(),
            add_space_on_merge,
            language,
        )
        .await
        {
            Ok(result) => return Ok(result),
            Err(error) => {
                last_error = error;
                tracing::warn!(
                    "Attempt {} failed for {}: {:?}",
                    attempt_number,
                    url,
                    last_error
                );
                tokio::time::sleep(Duration::from_secs(attempt_number)).await;
            }
        }
    }
    Err(last_error)
}

// --- Data Structure for Test Caching ---

#[derive(Serialize, Deserialize, Clone)]
pub struct RawChunk {
    pub lines: Vec<OcrResult>,
    pub width: u32,
    pub height: u32,
    pub global_y: u32,
    pub full_width: u32,
    pub full_height: u32,
}

// --- Public Helper for Testing ---
pub async fn get_raw_ocr_data(
    image_bytes: &[u8],
    user: Option<String>,
    pass: Option<String>,
    language: OcrLanguage,
) -> anyhow::Result<Vec<RawChunk>> {
    let reader = ImageReader::new(Cursor::new(image_bytes))
        .with_guessed_format()
        .map_err(|err| anyhow!("Failed with_guessed_format: {err:?}"))?;

    let decoded_image = if reader.format() == Some(ImageFormat::Avif) {
        decode_avif_custom(image_bytes)?
    } else {
        reader
            .decode()
            .map_err(|err| anyhow!("Failed decode: {err:?}"))?
    };

    let full_image_width = decoded_image.width();
    let full_image_height = decoded_image.height();
    let chunk_height_limit = 3000;

    let mut raw_chunks = Vec::new();

    // Fetch proxy settings
    let proxy_settings = get_proxy_settings(user.clone(), pass.clone())
        .await
        .ok()
        .flatten();

    // Create LensClient with optional proxy
    let lens_client = if let Some(ref proxy) = proxy_settings {
        if proxy.socks_proxy_enabled && !proxy.socks_proxy_host.is_empty() {
            // Build proxy URL with authentication if provided
            let proxy_url = if let (Some(username), Some(password)) =
                (&proxy.socks_proxy_username, &proxy.socks_proxy_password)
            {
                if !username.is_empty() && !password.is_empty() {
                    format!(
                        "socks{}://{}:{}@{}:{}",
                        proxy.socks_proxy_version,
                        username,
                        password,
                        proxy.socks_proxy_host,
                        proxy.socks_proxy_port
                    )
                } else {
                    format!(
                        "socks{}://{}:{}",
                        proxy.socks_proxy_version, proxy.socks_proxy_host, proxy.socks_proxy_port
                    )
                }
            } else {
                format!(
                    "socks{}://{}:{}",
                    proxy.socks_proxy_version, proxy.socks_proxy_host, proxy.socks_proxy_port
                )
            };

            tracing::info!(
                "Using SOCKS{} proxy for Google Lens: {}:{}",
                proxy.socks_proxy_version,
                proxy.socks_proxy_host,
                proxy.socks_proxy_port
            );

            LensClient::new_with_proxy(None, Some(&proxy_url))
                .map_err(|e| anyhow!("Failed to create LensClient with proxy: {}", e))?
        } else {
            LensClient::new(None)
        }
    } else {
        LensClient::new(None)
    };

    let mut current_y_position = 0;
    while current_y_position < full_image_height {
        let current_chunk_height =
            std::cmp::min(chunk_height_limit, full_image_height - current_y_position);
        if current_chunk_height == 0 {
            break;
        }

        let chunk_image = decoded_image
            .view(
                0,
                current_y_position,
                full_image_width,
                current_chunk_height,
            )
            .to_image();
        let mut image_buffer = Cursor::new(Vec::new());
        chunk_image
            .write_to(&mut image_buffer, ImageFormat::Png)
            .map_err(|err| anyhow!("Failed write_to: {err:?}"))?;
        let chunk_png_bytes = image_buffer.into_inner();

        let lens_response = lens_client
            .process_image_bytes(&chunk_png_bytes, Some("jp"))
            .await
            .map_err(|err| anyhow!("Failed process_image_bytes: {err:?}"))?;

        let mut flat_ocr_lines = Vec::new();
        for paragraph in lens_response.paragraphs {
            for line in paragraph.lines {
                if let Some(geometry) = line.geometry {
                    let clean_text = post_process_text(line.text, language);
                    if clean_text.trim().is_empty() {
                        continue;
                    }

                    let rotation = geometry.rotation_z as f64;
                    let cx = (geometry.center_x * full_image_width as f32) as f64;
                    let cy = (geometry.center_y * current_chunk_height as f32) as f64;
                    let w = (geometry.width * full_image_width as f32) as f64;
                    let h = (geometry.height * current_chunk_height as f32) as f64;

                    let hw = w / 2.0;
                    let hh = h / 2.0;
                    let cos_a = rotation.cos();
                    let sin_a = rotation.sin();

                    let corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)];

                    let mut min_x = f64::INFINITY;
                    let mut max_x = f64::NEG_INFINITY;
                    let mut min_y = f64::INFINITY;
                    let mut max_y = f64::NEG_INFINITY;

                    for (lx, ly) in corners {
                        let rx = lx * cos_a - ly * sin_a + cx;
                        let ry = lx * sin_a + ly * cos_a + cy;
                        min_x = min_x.min(rx);
                        max_x = max_x.max(rx);
                        min_y = min_y.min(ry);
                        max_y = max_y.max(ry);
                    }

                    let aabb_w = max_x - min_x;
                    let aabb_h = max_y - min_y;

                    let is_vertical = if language.prefers_vertical() {
                        if rotation.abs() > 0.1 {
                            (rotation.abs() - std::f32::consts::FRAC_PI_2 as f64).abs() < 0.5
                        } else {
                            aabb_w <= aabb_h
                        }
                    } else {
                        false
                    };

                    flat_ocr_lines.push(OcrResult {
                        text: clean_text,
                        is_merged: Some(false),
                        forced_orientation: Some(if is_vertical {
                            "vertical".into()
                        } else {
                            "horizontal".into()
                        }),
                        tight_bounding_box: BoundingBox {
                            x: min_x,
                            y: min_y,
                            width: aabb_w,
                            height: aabb_h,
                            rotation: None,
                        },
                    });
                }
            }
        }

        raw_chunks.push(RawChunk {
            lines: flat_ocr_lines,
            width: full_image_width,
            height: current_chunk_height,
            global_y: current_y_position,
            full_width: full_image_width,
            full_height: full_image_height,
        });

        current_y_position += chunk_height_limit;
    }

    Ok(raw_chunks)
}

async fn fetch_and_process_internal(
    url: &str,
    user: Option<String>,
    pass: Option<String>,
    add_space_on_merge: Option<bool>,
    language: OcrLanguage,
) -> anyhow::Result<Vec<OcrResult>> {
    // 0. Force URL to Localhost
    let target_url = match reqwest::Url::parse(url) {
        Ok(mut parsed) => {
            let _ = parsed.set_scheme("http");
            let _ = parsed.set_host(Some("127.0.0.1"));
            let _ = parsed.set_port(Some(4568));
            parsed.to_string()
        }
        Err(_) => url.to_string(),
    };

    // 1. Fetch
    let client = reqwest::Client::new();
    let mut request = client.get(&target_url);
    if let Some(username) = &user {
        request = request.basic_auth(username, pass.as_ref());
    }
    let response = request
        .send()
        .await?
        .error_for_status()
        .map_err(|err| anyhow!("Failed error_for_status (URL: {target_url}): {err:?}"))?;
    let image_bytes = response.bytes().await?.to_vec();

    // 2. Decode & OCR (Wrapped) - now passes user/pass for proxy settings
    let raw_chunks = get_raw_ocr_data(&image_bytes, user, pass, language).await?;

    // 3. Merge & Normalize
    let mut final_results = Vec::new();
    let mut merge_config = MergeConfig::default();
    merge_config.add_space_on_merge = add_space_on_merge;
    merge_config.language = language;

    for chunk in raw_chunks {
        let merged_lines = merge::auto_merge(chunk.lines, chunk.width, chunk.height, &merge_config);

        for mut result in merged_lines {
            // Adjust Coordinates: Chunk Pixels -> Global Pixels -> Global Normalized
            let chunk_pixel_x = result.tight_bounding_box.x;
            let chunk_pixel_y = result.tight_bounding_box.y;
            let chunk_pixel_width = result.tight_bounding_box.width;
            let chunk_pixel_height = result.tight_bounding_box.height;

            let global_pixel_y = chunk_pixel_y + (chunk.global_y as f64);

            result.tight_bounding_box.x = chunk_pixel_x / chunk.full_width as f64;
            result.tight_bounding_box.width = chunk_pixel_width / chunk.full_width as f64;
            result.tight_bounding_box.y = global_pixel_y / chunk.full_height as f64;
            result.tight_bounding_box.height = chunk_pixel_height / chunk.full_height as f64;

            final_results.push(result);
        }
    }

    Ok(final_results)
}
