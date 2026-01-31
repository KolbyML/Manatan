use serde::Deserialize;

use super::transformer::LanguageTransformer;
use super::{arabic, english, french, german, japanese, korean, spanish};

#[derive(Deserialize)]
struct TestSuite {
    category: String,
    valid: bool,
    tests: Vec<TestCase>,
}

#[derive(Deserialize)]
struct TestCase {
    term: String,
    source: String,
    #[serde(default)]
    rule: Option<String>,
    #[serde(default)]
    reasons: Option<Vec<String>>,
}

#[derive(Default)]
struct TestSummary {
    total: usize,
    passed: usize,
}

fn run_language_tests(
    label: &str,
    transformer: &LanguageTransformer,
    suites: &[TestSuite],
    preprocess: impl Fn(&str) -> String,
    summary: &mut TestSummary,
) {
    for suite in suites {
        for test_case in &suite.tests {
            summary.total += 1;
            let source = preprocess(&test_case.source);
            let term = preprocess(&test_case.term);
            let has = has_term_reasons(
                transformer,
                &source,
                &term,
                test_case.rule.as_deref(),
                test_case.reasons.as_deref(),
            );
            let mut message = format!(
                "{} {} {} term candidate {:?}",
                label,
                test_case.source,
                if suite.valid { "has" } else { "does not have" },
                test_case.term
            );
            if let Some(rule) = test_case.rule.as_deref() {
                message.push_str(&format!(" with rule {:?}", rule));
            }
            if let Some(reasons) = test_case.reasons.as_deref() {
                message.push_str(&format!(" and reasons {:?}", reasons));
            }
            message.push_str(&format!(" (category: {})", suite.category));

            assert_eq!(has, suite.valid, "{}", message);
            summary.passed += 1;
        }
    }
}

fn has_term_reasons(
    transformer: &LanguageTransformer,
    source: &str,
    expected_term: &str,
    expected_condition_name: Option<&str>,
    expected_reasons: Option<&[String]>,
) -> bool {
    for candidate in transformer.transform_with_trace(source) {
        if candidate.text != expected_term {
            continue;
        }
        if let Some(condition_name) = expected_condition_name {
            let expected_conditions = match transformer.condition_flags_for_type(condition_name) {
                Some(flags) => flags,
                None => return false,
            };
            if !LanguageTransformer::conditions_match(candidate.conditions, expected_conditions) {
                continue;
            }
        }
        if let Some(reasons) = expected_reasons {
            if candidate.trace.len() != reasons.len() {
                continue;
            }
            let mut ok = true;
            for (frame, reason) in candidate.trace.iter().zip(reasons.iter()) {
                if frame.transform_id != *reason {
                    ok = false;
                    break;
                }
            }
            if !ok {
                continue;
            }
        }
        return true;
    }
    false
}

#[test]
fn english_deinflections() {
    let transformer = english::transformer();
    let suites: Vec<TestSuite> = serde_json::from_str(include_str!("test-data/english-tests.json"))
        .expect("english tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "English",
        &transformer,
        &suites,
        |input| input.to_string(),
        &mut summary,
    );
    println!(
        "English deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}

#[test]
fn japanese_deinflections() {
    let transformer = japanese::transformer();
    let suites: Vec<TestSuite> =
        serde_json::from_str(include_str!("test-data/japanese-tests.json"))
            .expect("japanese tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "Japanese",
        &transformer,
        &suites,
        |input| input.to_string(),
        &mut summary,
    );
    println!(
        "Japanese deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}

#[test]
fn korean_deinflections() {
    let transformer = korean::transformer();
    let suites: Vec<TestSuite> = serde_json::from_str(include_str!("test-data/korean-tests.json"))
        .expect("korean tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "Korean",
        &transformer,
        &suites,
        korean::disassemble,
        &mut summary,
    );
    println!(
        "Korean deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}

#[test]
fn arabic_deinflections() {
    let transformer = arabic::transformer();
    let suites: Vec<TestSuite> = serde_json::from_str(include_str!("test-data/arabic-tests.json"))
        .expect("arabic tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "Arabic",
        &transformer,
        &suites,
        arabic::strip_diacritics,
        &mut summary,
    );
    println!(
        "Arabic deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}

#[test]
fn spanish_deinflections() {
    let transformer = spanish::transformer();
    let suites: Vec<TestSuite> = serde_json::from_str(include_str!("test-data/spanish-tests.json"))
        .expect("spanish tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "Spanish",
        &transformer,
        &suites,
        |input| input.to_string(),
        &mut summary,
    );
    println!(
        "Spanish deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}

#[test]
fn french_deinflections() {
    let transformer = french::transformer();
    let suites: Vec<TestSuite> = serde_json::from_str(include_str!("test-data/french-tests.json"))
        .expect("french tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "French",
        &transformer,
        &suites,
        |input| input.to_string(),
        &mut summary,
    );
    println!(
        "French deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}

#[test]
fn german_deinflections() {
    let transformer = german::transformer();
    let suites: Vec<TestSuite> = serde_json::from_str(include_str!("test-data/german-tests.json"))
        .expect("german tests should deserialize");
    let mut summary = TestSummary::default();
    run_language_tests(
        "German",
        &transformer,
        &suites,
        |input| input.to_string(),
        &mut summary,
    );
    println!(
        "German deinflector: {}/{} passed",
        summary.passed, summary.total
    );
}
