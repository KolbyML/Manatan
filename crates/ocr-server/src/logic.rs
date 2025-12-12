use std::io::Cursor;

use anyhow::anyhow;
use chrome_lens_ocr::LensClient;
use image::{DynamicImage, GenericImageView, ImageBuffer, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};

use crate::merge::{self, MergeConfig};

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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Helper to strip the scheme/host from the URL for caching purposes.
pub fn get_cache_key(url: &str) -> String {
    if let Ok(mut parsed) = reqwest::Url::parse(url) {
        // 1. Capture and filter query parameters
        // We filter out 'user', 'pass', 'username', 'password' case-insensitively
        let filtered_params: Vec<(String, String)> = parsed
            .query_pairs()
            .filter(|(k, _)| {
                let key = k.to_lowercase();
                key != "user" && key != "pass" && key != "username" && key != "password"
            })
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        // 2. Clear the existing query string on the Url object
        parsed.query_pairs_mut().clear();

        // 3. Re-append only the safe parameters
        if filtered_params.is_empty() {
            // Explicitly remove the query component to avoid a trailing '?'
            parsed.set_query(None);
        } else {
            for (k, v) in filtered_params {
                parsed.query_pairs_mut().append_pair(&k, &v);
            }
        }

        // 4. Return the path + reconstructed query
        // Note: parsed.path() already excludes the scheme://host:port/ prefix
        let path = parsed.path();
        match parsed.query() {
            Some(q) => format!("{path}?{q}"),
            None => path.to_string(),
        }
    } else {
        // Fallback for invalid URLs
        url.to_string()
    }
}

/// Helper to decode AVIF manually using 'avif-decode' to avoid 'image' crate issues
fn decode_avif_custom(bytes: &[u8]) -> anyhow::Result<DynamicImage> {
    let mut reader = Cursor::new(bytes);

    // 1. Parse the AVIF
    let decoder = avif_decode::Decoder::from_reader(&mut reader)
        .map_err(|e| anyhow!("avif-decode failed to parse: {e:?}"))?;

    // 2. Decode into raw frames
    let image = decoder
        .to_image()
        .map_err(|e| anyhow!("avif-decode failed to decode: {e:?}"))?;

    // 3. Convert raw buffer to 'image::DynamicImage'
    // We explicitly cast width/height to u32 and flatten the pixel structs into Vec<u8>
    match image {
        avif_decode::Image::Rgb8(img) => {
            // Flatten Vec<Rgb<u8>> -> Vec<u8>
            let raw_data: Vec<u8> = img.buf().iter().flat_map(|p| [p.r, p.g, p.b]).collect();
            let buffer = ImageBuffer::from_raw(img.width() as u32, img.height() as u32, raw_data)
                .ok_or_else(|| anyhow!("Failed to create RGB8 buffer"))?;
            Ok(DynamicImage::ImageRgb8(buffer))
        }
        avif_decode::Image::Rgba8(img) => {
            // Flatten Vec<Rgba<u8>> -> Vec<u8>
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
            // Downsample 16-bit to 8-bit (take top 8 bits) and flatten
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
            // Downsample 16-bit to 8-bit and flatten
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
) -> anyhow::Result<Vec<OcrResult>> {
    // 1. Fetch
    let client = reqwest::Client::new();
    let mut req = client.get(url);
    if let Some(u) = user {
        req = req.basic_auth(u, pass);
    }
    let resp = req
        .send()
        .await?
        .error_for_status()
        .map_err(|err| anyhow!("Failed error_for_status: {err:?}"))?;
    let bytes = resp.bytes().await?.to_vec();

    // 2. Decode Image (With AVIF Fix)
    // We guess the format first. If it is AVIF, we use our custom function.
    let reader = ImageReader::new(Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|err| anyhow!("Failed with_guessed_format: {err:?}"))?;

    let img = if reader.format() == Some(ImageFormat::Avif) {
        decode_avif_custom(&bytes)?
    } else {
        reader
            .decode()
            .map_err(|err| anyhow!("Failed decode: {err:?}"))?
    };

    let full_w = img.width();
    let full_h = img.height();
    let chunk_h_limit = 3000;

    let mut final_results = Vec::new();
    let lens_client = LensClient::new(None);

    // 3. Chunking Loop
    let mut y_curr = 0;
    while y_curr < full_h {
        let h_curr = std::cmp::min(chunk_h_limit, full_h - y_curr);
        if h_curr == 0 {
            break;
        }

        let chunk_img = img.view(0, y_curr, full_w, h_curr).to_image();
        let mut buf = Cursor::new(Vec::new());
        chunk_img
            .write_to(&mut buf, ImageFormat::Png)
            .map_err(|err| anyhow!("Failed write_to: {err:?}"))?;
        let chunk_bytes = buf.into_inner();

        // 4. Call Lens
        let lens_res = lens_client
            .process_image_bytes(&chunk_bytes, Some("jp"))
            .await
            .map_err(|err| anyhow!("Failed process_image_bytes: {err:?}"))?;

        // 5. Flatten LensResult & Convert Normalized Coords to Chunk Pixels
        let mut flat_lines = Vec::new();
        for para in lens_res.paragraphs {
            for line in para.lines {
                if let Some(geom) = line.geometry {
                    // Lens returns normalized coords (0.0 - 1.0) relative to the chunk.
                    // We must convert them to pixels for the auto_merge logic to work.

                    let norm_x = (geom.center_x - geom.width / 2.0) as f64;
                    let norm_y = (geom.center_y - geom.height / 2.0) as f64;
                    let norm_w = geom.width as f64;
                    let norm_h = geom.height as f64;

                    // Convert to Chunk Pixels
                    let px_x = norm_x * full_w as f64;
                    let px_y = norm_y * h_curr as f64;
                    let px_w = norm_w * full_w as f64;
                    let px_h = norm_h * h_curr as f64;

                    // Logic from JS `_groupOcrData`: isVertical = width <= height
                    let is_vertical = px_w <= px_h;
                    let orientation = if is_vertical {
                        "vertical"
                    } else {
                        "horizontal"
                    };

                    flat_lines.push(OcrResult {
                        text: line.text,
                        is_merged: Some(false),
                        forced_orientation: Some(orientation.to_string()),
                        tight_bounding_box: BoundingBox {
                            x: px_x,
                            y: px_y,
                            width: px_w,
                            height: px_h,
                        },
                    });
                }
            }
        }

        // 6. Auto Merge (Operates on Pixels)
        let merged = merge::auto_merge(flat_lines, full_w, h_curr, &MergeConfig::default());

        // 7. Adjust Coordinates: Chunk Pixels -> Global Pixels -> Global Normalized
        for mut res in merged {
            // 1. Get Chunk Pixels (Result from merge is still in pixels relative to chunk)
            let x_chunk_px = res.tight_bounding_box.x;
            let y_chunk_px = res.tight_bounding_box.y;
            let w_chunk_px = res.tight_bounding_box.width;
            let h_chunk_px = res.tight_bounding_box.height;

            // 2. Convert to Global Pixels
            let y_global_px = y_chunk_px + (y_curr as f64);

            // 3. Normalize to Global Image (0.0 - 1.0)
            res.tight_bounding_box.x = x_chunk_px / full_w as f64;
            res.tight_bounding_box.width = w_chunk_px / full_w as f64;
            res.tight_bounding_box.y = y_global_px / full_h as f64;
            res.tight_bounding_box.height = h_chunk_px / full_h as f64;

            final_results.push(res);
        }

        y_curr += chunk_h_limit;
    }

    Ok(final_results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_cache_key_simple_path() {
        let url =
            "http://localhost:4568/api/v1/manga/12/chapter/1/page/57?sourceId=3349575794425308347";
        assert_eq!(
            get_cache_key(url),
            "/api/v1/manga/12/chapter/1/page/57?sourceId=3349575794425308347"
        );
    }

    #[test]
    fn test_get_cache_key_with_query() {
        let url = "http://localhost:3000/image.jpg?width=100&q=test";
        assert_eq!(get_cache_key(url), "/image.jpg?width=100&q=test");
    }

    #[test]
    fn test_get_cache_key_https_and_port() {
        let url = "https://api.mysite.org:8080/v1/ocr";
        assert_eq!(get_cache_key(url), "/v1/ocr");
    }

    #[test]
    fn test_get_cache_key_root() {
        let url = "http://google.com";
        assert_eq!(get_cache_key(url), "/");
    }

    #[test]
    fn test_get_cache_key_root_with_slash() {
        let url = "http://google.com/";
        assert_eq!(get_cache_key(url), "/");
    }

    #[test]
    fn test_get_cache_key_invalid_url() {
        // Should fallback to returning the input exactly
        let url = "not_a_valid_url";
        assert_eq!(get_cache_key(url), "not_a_valid_url");
    }

    #[test]
    fn test_get_cache_key_relative_path() {
        // reqwest::Url::parse usually fails on relative paths without a base.
        // The function should fallback to returning the input string.
        let url = "/local/path/only";
        assert_eq!(get_cache_key(url), "/local/path/only");
    }

    #[test]
    fn test_cache_key_basic_path() {
        let url = "http://example.com/api/v1/manga/123/chapter/1";
        assert_eq!(get_cache_key(url), "/api/v1/manga/123/chapter/1");
    }

    #[test]
    fn test_cache_key_preserves_valid_query() {
        let url = "http://example.com/image.jpg?width=800&format=webp";
        // Note: Order of query params isn't guaranteed by Url::parse,
        // but typically it preserves input order or sorts.
        // We check if it contains the expected path and params.
        let key = get_cache_key(url);
        assert!(key.starts_with("/image.jpg?"));
        assert!(key.contains("width=800"));
        assert!(key.contains("format=webp"));
    }

    #[test]
    fn test_cache_key_strips_user_pass() {
        let url = "http://example.com/resource?user=admin&pass=secret123";
        assert_eq!(get_cache_key(url), "/resource");
    }

    #[test]
    fn test_cache_key_strips_username_password() {
        let url = "http://example.com/resource?username=admin&password=secret123";
        assert_eq!(get_cache_key(url), "/resource");
    }

    #[test]
    fn test_cache_key_mixed_params() {
        // Should keep 'page' and 'sort', but remove 'user' and 'pass'
        let url = "http://example.com/list?page=1&user=bob&sort=asc&pass=12345";
        assert_eq!(get_cache_key(url), "/list?page=1&sort=asc");
    }

    #[test]
    fn test_cache_key_case_insensitivity() {
        // Should strip mixed case params
        let url = "http://example.com/data?User=admin&PASS=secret&UserName=root";
        assert_eq!(get_cache_key(url), "/data");
    }

    #[test]
    fn test_cache_key_invalid_url() {
        // Should return the input string as-is if it can't be parsed
        let url = "not-a-valid-url";
        assert_eq!(get_cache_key(url), "not-a-valid-url");
    }

    #[test]
    fn test_cache_key_no_host_relative_path() {
        // reqwest::Url::parse requires a base for relative URLs usually.
        // If your app handles relative URLs, verify how Url::parse treats them.
        // Often "http://dummy" is prepended if the input is relative,
        // or it fails.
        // Assuming your input always has a scheme:
        let url = "http://localhost:3000/test";
        assert_eq!(get_cache_key(url), "/test");
    }
}
