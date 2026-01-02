use mangatan_ocr_server::logic::{self, RawChunk};
use serde_json::Value;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

fn is_valid_subsequence(source: &str, target: &str) -> bool {
    let src_chars: Vec<char> = source.chars().filter(|c| !c.is_whitespace()).collect();
    let tgt_chars: Vec<char> = target.chars().filter(|c| !c.is_whitespace()).collect();

    let mut src_iter = src_chars.iter();
    for &t in &tgt_chars {
        if !src_iter.any(|&s| s == t) {
            return false;
        }
    }
    true
}

#[tokio::test]
async fn validate_expected_is_subset_of_raw() {
    // Attempt to locate the sibling folder relative to where cargo runs
    let possible_paths = [
        Path::new("../../../ocr-test-data"), // Standard relative path from crate root
        Path::new("../../ocr-test-data"),    // From workspace root
        Path::new("../ocr-test-data"),       // Direct sibling
    ];

    let test_data_path = possible_paths.iter().find(|p| p.exists());

    let test_data_path = match test_data_path {
        Some(p) => p,
        None => {
            // In CI, this is a hard failure. Locally, we just skip.
            if std::env::var("CI").is_ok() {
                panic!(
                    "CI Error: 'ocr-test-data' directory not found. Ensure it is checked out as a sibling."
                );
            } else {
                println!("Skipping validation: 'ocr-test-data' not found.");
                return;
            }
        }
    };

    let mut errors = Vec::new();

    for entry in WalkDir::new(test_data_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ["png", "jpg", "jpeg", "webp", "avif"].contains(&ext.to_lowercase().as_str()) {
                let test_name = path.file_stem().unwrap().to_str().unwrap();
                let expected_path = path.with_extension("expected.json");
                let raw_path = path.with_extension("raw.json");

                // Skip if this image doesn't have an expected file yet
                if !expected_path.exists() {
                    continue;
                }

                println!("🔍 Validating {}...", test_name);

                // 1. Get Raw Data
                let raw_chunks: Vec<RawChunk> = if raw_path.exists() {
                    let content = fs::read_to_string(&raw_path).expect("Failed to read raw.json");
                    serde_json::from_str(&content).expect("Failed to parse raw.json")
                } else {
                    println!("   -> Generating raw data from image...");
                    let image_bytes = fs::read(path).expect("Failed to read image");
                    logic::get_raw_ocr_data(&image_bytes)
                        .await
                        .expect("Failed to perform OCR extraction")
                };

                // 2. Extract Raw Text
                let mut full_raw_text = String::new();
                for chunk in &raw_chunks {
                    for line in &chunk.lines {
                        full_raw_text.push_str(&line.text);
                    }
                }

                // 3. Extract Expected Text (Cleanly)
                let expected_content =
                    fs::read_to_string(&expected_path).expect("Read expected.json");
                let expected_json: Value =
                    serde_json::from_str(&expected_content).expect("Invalid JSON");

                let mut full_expected_text = String::new();
                if let Some(arr) = expected_json.as_array() {
                    for item in arr {
                        if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                            full_expected_text.push_str(text);
                        }
                    }
                }

                // 4. Validate Subsequence
                if !is_valid_subsequence(&full_raw_text, &full_expected_text) {
                    let err_msg = format!(
                        "❌ INVALID: '{}'. Expected text contains characters not found in Raw OCR.",
                        test_name
                    );
                    eprintln!("{}", err_msg);
                    errors.push(err_msg);
                } else {
                    println!("✅ {} is valid.", test_name);
                }
            }
        }
    }

    if !errors.is_empty() {
        panic!(
            "Validation failed for {} test cases:\n{}",
            errors.len(),
            errors.join("\n")
        );
    }
}
