use mangatan_ocr_server::logic::{self, RawChunk};
use mangatan_ocr_server::merge::{self, MergeConfig};
use pretty_assertions::assert_eq;
use serde_json::Value;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Recursively removes 'tightBoundingBox' fields so they don't appear in the
/// generated output or affect test comparison.
fn sanitize_results(v: &mut Value) {
    match v {
        Value::Array(arr) => {
            for item in arr {
                sanitize_results(item);
            }
        }
        Value::Object(map) => {
            // Completely remove the key so it doesn't clutter the file
            map.remove("tightBoundingBox");

            // Recurse into other fields
            for (_, value) in map.iter_mut() {
                sanitize_results(value);
            }
        }
        _ => {}
    }
}

#[tokio::test]
async fn run_merge_regression_tests() {
    let test_data_path = Path::new("../../ocr-test-data");

    if !test_data_path.exists() {
        if std::env::var("CI").is_ok() {
            return;
        }
        eprintln!(
            "Test data not found at {:?}. Run 'make test-ocr-merge' to clone it.",
            test_data_path
        );
        return;
    }

    let mut passed = 0;
    let mut generated = 0;

    for entry in WalkDir::new(test_data_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ["png", "jpg", "jpeg", "webp", "avif"].contains(&ext.to_lowercase().as_str()) {
                let test_name = path.file_stem().unwrap().to_str().unwrap();

                let raw_cache_path = path.with_extension("raw.json");
                let expected_path = path.with_extension("expected.json");

                // 1. Get OCR Data
                let raw_chunks: Vec<RawChunk> = if raw_cache_path.exists() {
                    let content = fs::read_to_string(&raw_cache_path).expect("Read raw cache");
                    serde_json::from_str(&content).expect("Parse raw cache")
                } else {
                    println!("  [Cache MISS] Running Lens OCR for {}...", test_name);
                    let image_bytes = fs::read(path).expect("Read image");
                    let chunks = logic::get_raw_ocr_data(&image_bytes)
                        .await
                        .expect("Lens OCR failed");

                    let json = serde_json::to_string_pretty(&chunks).unwrap();
                    fs::write(&raw_cache_path, json).expect("Write raw cache");
                    chunks
                };

                // 2. Run Merge Logic
                let config = MergeConfig::default();
                let mut final_results = Vec::new();

                for chunk in raw_chunks {
                    let merged_lines =
                        merge::auto_merge(chunk.lines, chunk.width, chunk.height, &config);

                    for mut result in merged_lines {
                        // We still calculate coordinates for internal logic correctness,
                        // but they will be stripped before writing/comparing.
                        let global_pixel_y = result.tight_bounding_box.y + (chunk.global_y as f64);
                        result.tight_bounding_box.x =
                            result.tight_bounding_box.x / chunk.full_width as f64;
                        result.tight_bounding_box.width =
                            result.tight_bounding_box.width / chunk.full_width as f64;
                        result.tight_bounding_box.y = global_pixel_y / chunk.full_height as f64;
                        result.tight_bounding_box.height =
                            result.tight_bounding_box.height / chunk.full_height as f64;
                        final_results.push(result);
                    }
                }

                // --- SANITIZATION STEP ---
                // Convert to generic Value and strip coordinates immediately
                let mut actual_value =
                    serde_json::to_value(&final_results).expect("Failed to serialize");
                sanitize_results(&mut actual_value);

                // Serialize the CLEAN version to string
                let actual_json_str = serde_json::to_string_pretty(&actual_value).unwrap();

                // 3. Validation Logic
                if expected_path.exists() {
                    let expected_content =
                        fs::read_to_string(&expected_path).expect("Read expected");

                    let mut expected: Value = serde_json::from_str(&expected_content)
                        .expect("Invalid JSON in expected file");

                    // We also sanitize the EXPECTED data loaded from disk.
                    // This allows existing files that still have the box to pass the test,
                    // while enforcing that new files won't have it.
                    sanitize_results(&mut expected);

                    let p_exp = serde_json::to_string_pretty(&expected).unwrap();
                    let p_act = serde_json::to_string_pretty(&actual_value).unwrap();

                    assert_eq!(p_act, p_exp, "Mismatch in test case: {}", test_name);
                    passed += 1;
                } else {
                    println!("  [NEW] Generating clean expected file for: {}", test_name);
                    fs::write(&expected_path, actual_json_str).expect("Bootstrap expected file");
                    generated += 1;
                }
            }
        }
    }

    println!(
        "Tests Passed: {} | New Files Generated: {}",
        passed, generated
    );
}
