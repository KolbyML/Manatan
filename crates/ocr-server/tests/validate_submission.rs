use mangatan_ocr_server::logic::{self, RawChunk};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Validates that `source` contains enough of every character in `target`
/// to construct `target`, ignoring whitespace.
/// Returns a list of missing characters if validation fails.
fn get_missing_characters(source: &str, target: &str) -> Option<HashMap<char, usize>> {
    let mut source_counts = HashMap::new();

    // Count available characters in Raw (source)
    for c in source.chars().filter(|c| !c.is_whitespace()) {
        *source_counts.entry(c).or_insert(0) += 1;
    }

    let mut missing_counts: HashMap<char, usize> = HashMap::new();

    // Check if Expected (target) characters exist in Raw counts
    for c in target.chars().filter(|c| !c.is_whitespace()) {
        let count = source_counts.get_mut(&c);
        match count {
            Some(n) if *n > 0 => {
                *n -= 1;
            }
            _ => {
                *missing_counts.entry(c).or_insert(0) += 1;
            }
        }
    }

    if missing_counts.is_empty() {
        None
    } else {
        Some(missing_counts)
    }
}

#[tokio::test]
async fn validate_expected_is_subset_of_raw() {
    let possible_paths = [
        Path::new("../../../ocr-test-data"),
        Path::new("../../ocr-test-data"),
        Path::new("../ocr-test-data"),
    ];

    let test_data_path = possible_paths.iter().find(|p| p.exists());

    let test_data_path = match test_data_path {
        Some(p) => p,
        None => {
            if std::env::var("CI").is_ok() {
                panic!("CI Error: 'ocr-test-data' directory not found.");
            } else {
                println!("Skipping validation: 'ocr-test-data' not found.");
                return;
            }
        }
    };

    let mut errors = Vec::new();
    let mut total_validated = 0;

    for entry in WalkDir::new(test_data_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ["png", "jpg", "jpeg", "webp", "avif"].contains(&ext.to_lowercase().as_str()) {
                let file_stem = path.file_stem().unwrap().to_str().unwrap();
                // Get parent directory name for better identification
                let parent_dir = path
                    .parent()
                    .and_then(|p| p.file_name())
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown_dir");

                let test_identifier = format!("{}/{}", parent_dir, file_stem);

                let expected_path = path.with_extension("expected.json");
                let raw_path = path.with_extension("raw.json");

                // Only validate if an expected file exists
                if !expected_path.exists() {
                    continue;
                }

                total_validated += 1;
                println!("🔍 Validating {}...", test_identifier);

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

                // 3. Extract Expected Text
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

                // 4. Validate (Bag of Characters)
                if let Some(missing) = get_missing_characters(&full_raw_text, &full_expected_text) {
                    let mut missing_desc: Vec<String> = missing
                        .iter()
                        .map(|(char, count)| format!("'{}' (x{})", char, count))
                        .collect();
                    missing_desc.sort();

                    let err_msg = format!(
                        "❌ INVALID: '{}'. Expected text contains characters not found in Raw OCR.\n   Missing: {}",
                        test_identifier,
                        missing_desc.join(", ")
                    );
                    eprintln!("{}", err_msg);
                    errors.push(err_msg);
                } else {
                    println!("✅ {} is valid.", test_identifier);
                }
            }
        }
    }

    println!("---------------------------------------------------");
    println!("Total test cases validated: {}", total_validated);
    println!("---------------------------------------------------");

    if !errors.is_empty() {
        panic!(
            "Validation failed for {} test cases:\n{}",
            errors.len(),
            errors.join("\n\n")
        );
    }
}
