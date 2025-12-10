use std::io::Cursor;

use chrome_lens_ocr::LensClient;
use image::{GenericImageView, ImageFormat, ImageReader};
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
    let resp = req.send().await?.error_for_status()?;
    let bytes = resp.bytes().await?.to_vec();

    // 2. Decode Image
    let img = ImageReader::new(Cursor::new(&bytes))
        .with_guessed_format()?
        .decode()?;

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
        chunk_img.write_to(&mut buf, ImageFormat::Png)?;
        let chunk_bytes = buf.into_inner();

        // 4. Call Lens
        let lens_res = lens_client
            .process_image_bytes(&chunk_bytes, Some("en"))
            .await?;

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
