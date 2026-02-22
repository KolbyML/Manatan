use std::{
    collections::{HashMap, HashSet},
    sync::OnceLock,
};

use anyhow::{Context, Result};
use regex::Regex;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct LanguageTransformer {
    transforms: Vec<Transform>,
    condition_flags_map: HashMap<String, u32>,
}

#[derive(Debug, Clone)]
struct Transform {
    rules: Vec<Rule>,
}

#[derive(Debug, Clone)]
struct Rule {
    transform_id: String,
    rule_index: usize,
    conditions_in: u32,
    conditions_out: u32,
    kind: RuleKind,
}

#[derive(Debug, Clone)]
pub enum RuleKind {
    Suffix {
        inflected: String,
        deinflected: String,
    },
    Prefix {
        inflected: String,
        deinflected: String,
    },
    WholeWord {
        inflected: String,
        deinflected: String,
    },
    Affix {
        inflected_prefix: String,
        deinflected_prefix: String,
        inflected_suffix: String,
        deinflected_suffix: String,
        initial_disallow: Option<char>,
        final_disallow: Option<char>,
        require_arabic_letters: bool,
    },
    RegexReplace {
        regex: Regex,
        replacement: String,
    },
    SpanishPronominal,
    EnglishPhrasalInterposedObject,
    EnglishPhrasalSuffix {
        inflected: String,
        deinflected: String,
    },
}

#[derive(Debug, Clone)]
pub struct TransformDefinition {
    pub id: String,
    pub rules: Vec<RuleDefinition>,
}

#[derive(Debug, Clone)]
pub struct RuleDefinition {
    pub kind: RuleKind,
    pub conditions_in: Vec<String>,
    pub conditions_out: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ConditionDefinition {
    pub sub_conditions: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct Descriptor {
    pub conditions: HashMap<String, ConditionDefinition>,
    pub transforms: Vec<TransformDefinition>,
}

#[derive(Debug, Clone)]
pub struct TransformedText {
    pub text: String,
    pub conditions: u32,
}

#[derive(Debug, Clone)]
pub struct TransformedTextTrace {
    pub text: String,
    pub conditions: u32,
    pub trace: Vec<TraceFrameInfo>,
}

#[derive(Debug, Clone)]
pub struct TraceFrameInfo {
    pub transform_id: String,
}

#[derive(Debug, Clone)]
struct TraceFrame {
    transform_id: String,
    rule_index: usize,
    text: String,
}

#[derive(Deserialize)]
struct JsonDescriptor {
    conditions: HashMap<String, JsonCondition>,
    transforms: Vec<JsonTransform>,
}

#[derive(Deserialize)]
struct JsonCondition {
    #[serde(rename = "subConditions")]
    sub_conditions: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct JsonTransform {
    id: String,
    rules: Vec<JsonRule>,
}

#[derive(Deserialize)]
struct JsonRule {
    #[serde(rename = "type")]
    rule_type: String,
    inflected: Option<String>,
    deinflected: Option<String>,
    #[serde(rename = "inflectedPrefix")]
    inflected_prefix: Option<String>,
    #[serde(rename = "deinflectedPrefix")]
    deinflected_prefix: Option<String>,
    #[serde(rename = "inflectedSuffix")]
    inflected_suffix: Option<String>,
    #[serde(rename = "deinflectedSuffix")]
    deinflected_suffix: Option<String>,
    #[serde(rename = "initialDisallow")]
    initial_disallow: Option<String>,
    #[serde(rename = "finalDisallow")]
    final_disallow: Option<String>,
    #[serde(rename = "requireArabicLetters")]
    require_arabic_letters: Option<bool>,
    pattern: Option<String>,
    replacement: Option<String>,
    #[serde(rename = "conditionsIn")]
    conditions_in: Vec<String>,
    #[serde(rename = "conditionsOut")]
    conditions_out: Vec<String>,
}

impl LanguageTransformer {
    pub fn empty() -> Self {
        Self {
            transforms: Vec::new(),
            condition_flags_map: HashMap::new(),
        }
    }

    pub fn from_descriptor(descriptor: Descriptor) -> Result<Self> {
        let condition_flags_map = build_condition_flags(&descriptor.conditions)?;
        let mut transforms = Vec::new();

        for transform_def in descriptor.transforms {
            let mut rules = Vec::new();
            for (rule_index, rule_def) in transform_def.rules.into_iter().enumerate() {
                let conditions_in =
                    get_condition_flags_strict(&condition_flags_map, &rule_def.conditions_in)
                        .with_context(|| {
                            format!(
                                "Invalid conditionsIn for transform {} rule {rule_index}",
                                transform_def.id
                            )
                        })?;
                let conditions_out =
                    get_condition_flags_strict(&condition_flags_map, &rule_def.conditions_out)
                        .with_context(|| {
                            format!(
                                "Invalid conditionsOut for transform {} rule {rule_index}",
                                transform_def.id
                            )
                        })?;

                rules.push(Rule {
                    transform_id: transform_def.id.clone(),
                    rule_index,
                    conditions_in,
                    conditions_out,
                    kind: rule_def.kind,
                });
            }

            transforms.push(Transform { rules });
        }

        Ok(Self {
            transforms,
            condition_flags_map,
        })
    }

    pub fn from_json(json: &str) -> Result<Self> {
        let descriptor: JsonDescriptor = serde_json::from_str(json)?;
        let conditions = descriptor
            .conditions
            .into_iter()
            .map(|(key, value)| {
                (
                    key,
                    ConditionDefinition {
                        sub_conditions: value.sub_conditions,
                    },
                )
            })
            .collect();

        let mut transforms = Vec::new();
        for transform in descriptor.transforms {
            let mut rules = Vec::new();
            for rule in transform.rules {
                let JsonRule {
                    rule_type,
                    inflected,
                    deinflected,
                    inflected_prefix,
                    deinflected_prefix,
                    inflected_suffix,
                    deinflected_suffix,
                    initial_disallow,
                    final_disallow,
                    require_arabic_letters,
                    pattern,
                    replacement,
                    conditions_in,
                    conditions_out,
                } = rule;
                let kind = match rule_type.as_str() {
                    "suffix" => RuleKind::Suffix {
                        inflected: inflected
                            .ok_or_else(|| anyhow::anyhow!("Missing inflected for suffix rule"))?,
                        deinflected: deinflected.unwrap_or_default(),
                    },
                    "prefix" => RuleKind::Prefix {
                        inflected: inflected
                            .ok_or_else(|| anyhow::anyhow!("Missing inflected for prefix rule"))?,
                        deinflected: deinflected.unwrap_or_default(),
                    },
                    "wholeWord" => RuleKind::WholeWord {
                        inflected: inflected.ok_or_else(|| {
                            anyhow::anyhow!("Missing inflected for wholeWord rule")
                        })?,
                        deinflected: deinflected.unwrap_or_default(),
                    },
                    "affix" => RuleKind::Affix {
                        inflected_prefix: inflected_prefix.unwrap_or_default(),
                        deinflected_prefix: deinflected_prefix.unwrap_or_default(),
                        inflected_suffix: inflected_suffix.unwrap_or_default(),
                        deinflected_suffix: deinflected_suffix.unwrap_or_default(),
                        initial_disallow: parse_json_char(initial_disallow.as_deref())?,
                        final_disallow: parse_json_char(final_disallow.as_deref())?,
                        require_arabic_letters: require_arabic_letters.unwrap_or(false),
                    },
                    "regexReplace" => {
                        let pattern = pattern.ok_or_else(|| {
                            anyhow::anyhow!("Missing pattern for regexReplace rule")
                        })?;
                        let replacement = replacement.unwrap_or_default();
                        let regex = Regex::new(&pattern)
                            .with_context(|| format!("Invalid regex pattern: {pattern}"))?;
                        RuleKind::RegexReplace { regex, replacement }
                    }
                    "spanishPronominal" => RuleKind::SpanishPronominal,
                    other => {
                        return Err(anyhow::anyhow!("Unsupported rule type: {other}"));
                    }
                };

                rules.push(RuleDefinition {
                    kind,
                    conditions_in,
                    conditions_out,
                });
            }
            transforms.push(TransformDefinition {
                id: transform.id,
                rules,
            });
        }

        Self::from_descriptor(Descriptor {
            conditions,
            transforms,
        })
    }

    pub fn transform(&self, source_text: &str) -> Vec<TransformedText> {
        self.transform_with_trace(source_text)
            .into_iter()
            .map(|item| TransformedText {
                text: item.text,
                conditions: item.conditions,
            })
            .collect()
    }

    pub fn transform_with_trace(&self, source_text: &str) -> Vec<TransformedTextTrace> {
        let mut results = Vec::new();
        let mut traces: Vec<Vec<TraceFrame>> = Vec::new();

        results.push(TransformedTextTrace {
            text: source_text.to_string(),
            conditions: 0,
            trace: Vec::new(),
        });
        traces.push(Vec::new());

        let mut i = 0;
        while i < results.len() {
            let current = results[i].clone();
            let current_trace = traces[i].clone();

            for transform in &self.transforms {
                for rule in &transform.rules {
                    if !conditions_match(current.conditions, rule.conditions_in) {
                        continue;
                    }
                    if !rule.kind.is_inflected(&current.text) {
                        continue;
                    }

                    if current_trace.iter().any(|frame| {
                        frame.transform_id == rule.transform_id
                            && frame.rule_index == rule.rule_index
                            && frame.text == current.text
                    }) {
                        continue;
                    }

                    if let Some(deinflected_text) = rule.kind.deinflect(&current.text) {
                        let mut new_trace = Vec::with_capacity(current_trace.len() + 1);
                        new_trace.push(TraceFrame {
                            transform_id: rule.transform_id.clone(),
                            rule_index: rule.rule_index,
                            text: current.text.clone(),
                        });
                        new_trace.extend(current_trace.iter().cloned());

                        results.push(TransformedTextTrace {
                            text: deinflected_text,
                            conditions: rule.conditions_out,
                            trace: new_trace
                                .iter()
                                .map(|frame| TraceFrameInfo {
                                    transform_id: frame.transform_id.clone(),
                                })
                                .collect(),
                        });
                        traces.push(new_trace);
                    }
                }
            }

            i += 1;
        }

        results
    }

    pub fn deinflect_terms(&self, source_text: &str) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut results = Vec::new();
        for item in self.transform(source_text) {
            if seen.insert(item.text.clone()) {
                results.push(item.text);
            }
        }
        results
    }

    pub fn condition_flags_for_type(&self, condition_type: &str) -> Option<u32> {
        self.condition_flags_map.get(condition_type).copied()
    }

    pub fn condition_flags_for_types(&self, condition_types: &[String]) -> u32 {
        let mut flags = 0;
        for condition_type in condition_types {
            if let Some(flag) = self.condition_flags_map.get(condition_type) {
                flags |= flag;
            }
        }
        flags
    }

    pub fn conditions_match(current: u32, next: u32) -> bool {
        conditions_match(current, next)
    }
}

fn parse_json_char(value: Option<&str>) -> Result<Option<char>> {
    let Some(value) = value else {
        return Ok(None);
    };
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return Ok(None);
    };
    if chars.next().is_some() {
        return Err(anyhow::anyhow!("Expected single character, got {value}"));
    }
    Ok(Some(first))
}

impl RuleKind {
    fn is_inflected(&self, text: &str) -> bool {
        match self {
            RuleKind::Suffix { inflected, .. } => text.ends_with(inflected),
            RuleKind::Prefix { inflected, .. } => text.starts_with(inflected),
            RuleKind::WholeWord { inflected, .. } => text == inflected,
            RuleKind::Affix {
                inflected_prefix,
                inflected_suffix,
                initial_disallow,
                final_disallow,
                require_arabic_letters,
                ..
            } => matches_affix(
                text,
                inflected_prefix,
                inflected_suffix,
                *initial_disallow,
                *final_disallow,
                *require_arabic_letters,
            ),
            RuleKind::RegexReplace { regex, .. } => regex.is_match(text),
            RuleKind::SpanishPronominal => spanish_pronominal(text).is_some(),
            RuleKind::EnglishPhrasalInterposedObject => {
                english_phrasal_interposed_object(text).is_some()
            }
            RuleKind::EnglishPhrasalSuffix { inflected, .. } => {
                english_phrasal_suffix(text, inflected).is_some()
            }
        }
    }

    fn deinflect(&self, text: &str) -> Option<String> {
        match self {
            RuleKind::Suffix {
                inflected,
                deinflected,
            } => {
                let stem = text.strip_suffix(inflected)?;
                Some(format!("{stem}{deinflected}"))
            }
            RuleKind::Prefix {
                inflected,
                deinflected,
            } => {
                let stem = text.strip_prefix(inflected)?;
                Some(format!("{deinflected}{stem}"))
            }
            RuleKind::WholeWord {
                inflected,
                deinflected,
            } => {
                if text == inflected {
                    Some(deinflected.clone())
                } else {
                    None
                }
            }
            RuleKind::Affix {
                inflected_prefix,
                deinflected_prefix,
                inflected_suffix,
                deinflected_suffix,
                ..
            } => deinflect_affix(
                text,
                inflected_prefix,
                deinflected_prefix,
                inflected_suffix,
                deinflected_suffix,
            ),
            RuleKind::RegexReplace { regex, replacement } => {
                if regex.is_match(text) {
                    Some(regex.replace(text, replacement.as_str()).to_string())
                } else {
                    None
                }
            }
            RuleKind::SpanishPronominal => spanish_pronominal(text),
            RuleKind::EnglishPhrasalInterposedObject => english_phrasal_interposed_object(text),
            RuleKind::EnglishPhrasalSuffix {
                inflected,
                deinflected,
            } => english_phrasal_suffix(text, inflected)
                .map(|(stem, particle)| format!("{stem}{deinflected} {particle}")),
        }
    }
}

fn matches_affix(
    text: &str,
    inflected_prefix: &str,
    inflected_suffix: &str,
    initial_disallow: Option<char>,
    final_disallow: Option<char>,
    require_arabic_letters: bool,
) -> bool {
    let stripped_prefix = match text.strip_prefix(inflected_prefix) {
        Some(value) => value,
        None => return false,
    };
    let middle = match stripped_prefix.strip_suffix(inflected_suffix) {
        Some(value) => value,
        None => return false,
    };
    if require_arabic_letters {
        if middle.is_empty() {
            return false;
        }
        if !middle.chars().all(is_arabic_letter) {
            return false;
        }
    }
    if let Some(disallow) = initial_disallow
        && matches!(middle.chars().next(), Some(value) if value == disallow)
    {
        return false;
    }
    if let Some(disallow) = final_disallow
        && matches!(middle.chars().last(), Some(value) if value == disallow)
    {
        return false;
    }
    true
}

fn deinflect_affix(
    text: &str,
    inflected_prefix: &str,
    deinflected_prefix: &str,
    inflected_suffix: &str,
    deinflected_suffix: &str,
) -> Option<String> {
    let stripped_prefix = text.strip_prefix(inflected_prefix)?;
    let middle = stripped_prefix.strip_suffix(inflected_suffix)?;
    Some(format!("{deinflected_prefix}{middle}{deinflected_suffix}"))
}

fn is_arabic_letter(c: char) -> bool {
    let u = c as u32;
    (0x0620..=0x065F).contains(&u)
        || (0x066E..=0x06D3).contains(&u)
        || u == 0x06D5
        || (0x06EE..=0x06EF).contains(&u)
        || (0x06FA..=0x06FC).contains(&u)
        || u == 0x06FF
}

fn conditions_match(current: u32, next: u32) -> bool {
    current == 0 || (current & next) != 0
}

fn build_condition_flags(
    conditions: &HashMap<String, ConditionDefinition>,
) -> Result<HashMap<String, u32>> {
    let mut condition_flags_map = HashMap::new();
    let mut next_flag_index = 0;
    let mut targets: Vec<(String, ConditionDefinition)> = conditions
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();

    while !targets.is_empty() {
        let target_len = targets.len();
        let mut next_targets = Vec::new();

        for (key, condition) in targets {
            let flags = if let Some(sub_conditions) = &condition.sub_conditions {
                if let Some(multi_flags) =
                    get_condition_flags_strict(&condition_flags_map, sub_conditions)
                {
                    multi_flags
                } else {
                    next_targets.push((key, condition));
                    continue;
                }
            } else {
                if next_flag_index >= 32 {
                    return Err(anyhow::anyhow!("Maximum number of conditions exceeded"));
                }
                let flags = 1 << next_flag_index;
                next_flag_index += 1;
                flags
            };

            condition_flags_map.insert(key, flags);
        }

        if next_targets.len() == target_len {
            return Err(anyhow::anyhow!("Cycle detected in condition flags"));
        }

        targets = next_targets;
    }

    Ok(condition_flags_map)
}

fn get_condition_flags_strict(
    condition_flags_map: &HashMap<String, u32>,
    condition_types: &[String],
) -> Option<u32> {
    let mut flags = 0;
    for condition_type in condition_types {
        let flag = condition_flags_map.get(condition_type)?;
        flags |= flag;
    }
    Some(flags)
}

fn english_phrasal_suffix(text: &str, inflected: &str) -> Option<(String, String)> {
    let mut parts = text.split_whitespace();
    let first = parts.next()?;
    let second = parts.next()?;
    if parts.next().is_some() {
        return None;
    }
    if !english_phrasal_word_set().contains(second) {
        return None;
    }
    let stem = first.strip_suffix(inflected)?;
    Some((stem.to_string(), second.to_string()))
}

fn english_phrasal_interposed_object(text: &str) -> Option<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() < 3 {
        return None;
    }
    let particle = *words.last()?;
    if !english_phrasal_particles().contains(&particle) {
        return None;
    }
    let word_set = english_phrasal_word_set();
    if words[1..words.len() - 1]
        .iter()
        .any(|word| word_set.contains(*word))
    {
        return None;
    }
    Some(format!("{} {particle}", words[0]))
}

fn spanish_pronominal(text: &str) -> Option<String> {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    if tokens.len() < 2 {
        return None;
    }

    let mut output: Vec<String> = Vec::with_capacity(tokens.len());
    let mut changed = false;
    let mut i = 0;
    while i < tokens.len() {
        let token = tokens[i];
        if is_spanish_pronoun(token) && i + 1 < tokens.len() {
            let next = tokens[i + 1];
            if is_spanish_infinitive(next) {
                output.push(format!("{next}se"));
                changed = true;
                i += 2;
                continue;
            }
        }
        output.push(token.to_string());
        i += 1;
    }

    if changed {
        Some(output.join(" "))
    } else {
        None
    }
}

fn is_spanish_pronoun(token: &str) -> bool {
    matches!(token, "me" | "te" | "se" | "nos" | "os")
}

fn is_spanish_infinitive(token: &str) -> bool {
    token.ends_with("ar") || token.ends_with("er") || token.ends_with("ir")
}

fn english_phrasal_word_set() -> &'static HashSet<&'static str> {
    static WORD_SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    WORD_SET.get_or_init(|| {
        english_phrasal_particles()
            .iter()
            .chain(english_phrasal_prepositions())
            .copied()
            .collect()
    })
}

fn english_phrasal_particles() -> &'static [&'static str] {
    &[
        "aboard",
        "about",
        "above",
        "across",
        "ahead",
        "alongside",
        "apart",
        "around",
        "aside",
        "astray",
        "away",
        "back",
        "before",
        "behind",
        "below",
        "beneath",
        "besides",
        "between",
        "beyond",
        "by",
        "close",
        "down",
        "east",
        "west",
        "north",
        "south",
        "eastward",
        "westward",
        "northward",
        "southward",
        "forward",
        "backward",
        "backwards",
        "forwards",
        "home",
        "in",
        "inside",
        "instead",
        "near",
        "off",
        "on",
        "opposite",
        "out",
        "outside",
        "over",
        "overhead",
        "past",
        "round",
        "since",
        "through",
        "throughout",
        "together",
        "under",
        "underneath",
        "up",
        "within",
        "without",
    ]
}

fn english_phrasal_prepositions() -> &'static [&'static str] {
    &[
        "aback", "about", "above", "across", "after", "against", "ahead", "along", "among",
        "apart", "around", "as", "aside", "at", "away", "back", "before", "behind", "below",
        "between", "beyond", "by", "down", "even", "for", "forth", "forward", "from", "in", "into",
        "of", "off", "on", "onto", "open", "out", "over", "past", "round", "through", "to",
        "together", "toward", "towards", "under", "up", "upon", "way", "with", "without",
    ]
}
