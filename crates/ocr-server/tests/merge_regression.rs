use mangatan_ocr_server::logic::{self, RawChunk};
use mangatan_ocr_server::merge::{self, MergeConfig};
use pretty_assertions::StrComparison;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

fn sanitize_results(v: &mut Value) {
    match v {
        Value::Array(arr) => {
            for item in arr {
                sanitize_results(item);
            }
        }
        Value::Object(map) => {
            map.remove("tightBoundingBox");
            for (_, value) in map.iter_mut() {
                sanitize_results(value);
            }
        }
        _ => {}
    }
}

#[tokio::test]
async fn run_merge_regression_tests() {
    // 1. Path Resolution
    let env_path = std::env::var("OCR_TEST_DATA_PATH").ok().map(PathBuf::from);
    let fallback_path = PathBuf::from("../../ocr-test-data");

    let test_data_path = if let Some(p) = env_path {
        if p.exists() {
            Some(p)
        } else {
            eprintln!(
                "⚠️ OCR_TEST_DATA_PATH was set to {:?} but does not exist.",
                p
            );
            None
        }
    } else if fallback_path.exists() {
        Some(fallback_path)
    } else {
        None
    };

    if test_data_path.is_none() {
        if std::env::var("CI").is_ok() {
            return;
        }
        eprintln!("❌ Test data not found.");
        return;
    }

    let test_data_path = test_data_path.unwrap();
    println!(
        "📂 Using Test Data at: {:?}",
        test_data_path
            .canonicalize()
            .unwrap_or(test_data_path.clone())
    );

    // Env flags
    let force_regen_raw = std::env::var("REGENERATE_RAW").is_ok();
    let only_generate_missing = std::env::var("ONLY_GENERATE_MISSING").is_ok();
    let update_expected = std::env::var("UPDATE_EXPECTED").is_ok();

    let mut passed = 0;
    let mut generated = 0;
    let mut skipped = 0;
    let mut failures = Vec::new();

    for entry in WalkDir::new(&test_data_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ["png", "jpg", "jpeg", "webp", "avif"].contains(&ext.to_lowercase().as_str()) {
                let file_stem = path.file_stem().unwrap().to_str().unwrap();
                let parent_dir = path
                    .parent()
                    .and_then(|p| p.file_name())
                    .and_then(|s| s.to_str())
                    .unwrap_or("root");

                let test_name = format!("{}/{}", parent_dir, file_stem);

                let raw_cache_path = path.with_extension("raw.json");
                let expected_path = path.with_extension("expected.json");

                // Optimization: Skip processing if we only want new files and raw regen is NOT requested
                if only_generate_missing
                    && expected_path.exists()
                    && !update_expected
                    && !force_regen_raw
                {
                    skipped += 1;
                    continue;
                }

                // 1. Get OCR Data
                let raw_chunks: Vec<RawChunk> = if raw_cache_path.exists() && !force_regen_raw {
                    let content = fs::read_to_string(&raw_cache_path).expect("Read raw cache");
                    serde_json::from_str(&content).expect("Parse raw cache")
                } else {
                    println!("  [OCR] Running Lens OCR for {}...", test_name);
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

                // Sanitize
                let mut actual_value = serde_json::to_value(&final_results).expect("Serialize");
                sanitize_results(&mut actual_value);
                let actual_json_str = serde_json::to_string_pretty(&actual_value).unwrap();

                // 3. Validation Logic
                if expected_path.exists() {
                    if update_expected {
                        println!("  [UPDATE] Overwriting expected file for: {}", test_name);
                        fs::write(&expected_path, actual_json_str).expect("Write expected file");
                        generated += 1;
                    } else if force_regen_raw {
                        // skip validation during raw regen
                    } else {
                        // STANDARD TEST mode
                        let expected_content =
                            fs::read_to_string(&expected_path).expect("Read expected");
                        let mut expected: Value =
                            serde_json::from_str(&expected_content).expect("Invalid JSON");
                        sanitize_results(&mut expected);

                        let p_exp = serde_json::to_string_pretty(&expected).unwrap();
                        let p_act = serde_json::to_string_pretty(&actual_value).unwrap();

                        if p_act != p_exp {
                            println!(
                                "------------------------------------------------------------"
                            );
                            println!("❌ Mismatch in test case: {}", test_name);
                            println!("Diff < left (actual) / right (expected) > :");
                            println!("{}", StrComparison::new(&p_act, &p_exp));
                            println!(
                                "------------------------------------------------------------"
                            );
                            failures.push(test_name);
                        } else {
                            passed += 1;
                        }
                    }
                } else {
                    println!("  [NEW] Generating expected file for: {}", test_name);
                    fs::write(&expected_path, actual_json_str).expect("Bootstrap expected file");
                    generated += 1;
                }
            }
        }
    }

    if force_regen_raw {
        println!("✅ Raw Data Regeneration Complete.");
    } else if only_generate_missing {
        println!(
            "Generation Complete: {} files generated/updated, {} existing files skipped.",
            generated, skipped
        );
    } else {
        println!(
            "Tests Finished: {} passed | {} failed | {} generated",
            passed,
            failures.len(),
            generated
        );

        if !failures.is_empty() {
            panic!(
                "Validation failed for {} test cases:\n{:#?}",
                failures.len(),
                failures
            );
        }
    }
}
