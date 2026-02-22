use std::collections::HashMap;

use super::transformer::{
    ConditionDefinition, Descriptor, LanguageTransformer, RuleDefinition, RuleKind,
    TransformDefinition,
};

#[allow(clippy::vec_init_then_push)]
pub fn transformer() -> LanguageTransformer {
    let mut conditions = HashMap::new();
    conditions.insert(
        "v".to_string(),
        ConditionDefinition {
            sub_conditions: Some(vec!["v_phr".to_string()]),
        },
    );
    conditions.insert(
        "v_phr".to_string(),
        ConditionDefinition {
            sub_conditions: None,
        },
    );
    conditions.insert(
        "n".to_string(),
        ConditionDefinition {
            sub_conditions: Some(vec!["np".to_string(), "ns".to_string()]),
        },
    );
    conditions.insert(
        "np".to_string(),
        ConditionDefinition {
            sub_conditions: None,
        },
    );
    conditions.insert(
        "ns".to_string(),
        ConditionDefinition {
            sub_conditions: None,
        },
    );
    conditions.insert(
        "adj".to_string(),
        ConditionDefinition {
            sub_conditions: None,
        },
    );
    conditions.insert(
        "adv".to_string(),
        ConditionDefinition {
            sub_conditions: None,
        },
    );

    let past_suffix_inflections = vec![
        suffix_rule("ed", "", &["v"], &["v"]),
        suffix_rule("ed", "e", &["v"], &["v"]),
        suffix_rule("ied", "y", &["v"], &["v"]),
        suffix_rule("cked", "c", &["v"], &["v"]),
    ]
    .into_iter()
    .chain(doubled_consonant_inflection(
        "bdgklmnprstz",
        "ed",
        &["v"],
        &["v"],
    ))
    .chain([
        suffix_rule("laid", "lay", &["v"], &["v"]),
        suffix_rule("paid", "pay", &["v"], &["v"]),
        suffix_rule("said", "say", &["v"], &["v"]),
    ])
    .collect::<Vec<_>>();

    let ing_suffix_inflections = vec![
        suffix_rule("ing", "", &["v"], &["v"]),
        suffix_rule("ing", "e", &["v"], &["v"]),
        suffix_rule("ying", "ie", &["v"], &["v"]),
        suffix_rule("cking", "c", &["v"], &["v"]),
    ]
    .into_iter()
    .chain(doubled_consonant_inflection(
        "bdgklmnprstz",
        "ing",
        &["v"],
        &["v"],
    ))
    .collect::<Vec<_>>();

    let third_person_sg_present_suffix_inflections = vec![
        suffix_rule("s", "", &["v"], &["v"]),
        suffix_rule("es", "", &["v"], &["v"]),
        suffix_rule("ies", "y", &["v"], &["v"]),
    ];

    let mut transforms = Vec::new();

    transforms.push(TransformDefinition {
        id: "plural".to_string(),
        rules: vec![
            suffix_rule("s", "", &["np"], &["ns"]),
            suffix_rule("es", "", &["np"], &["ns"]),
            suffix_rule("ies", "y", &["np"], &["ns"]),
            suffix_rule("ves", "fe", &["np"], &["ns"]),
            suffix_rule("ves", "f", &["np"], &["ns"]),
        ],
    });

    transforms.push(TransformDefinition {
        id: "possessive".to_string(),
        rules: vec![
            suffix_rule("'s", "", &["n"], &["n"]),
            suffix_rule("s'", "s", &["n"], &["n"]),
        ],
    });

    transforms.push(TransformDefinition {
        id: "past".to_string(),
        rules: past_suffix_inflections
            .iter()
            .cloned()
            .chain(create_phrasal_verb_inflections_from_suffix_inflections(
                &past_suffix_inflections,
            ))
            .collect(),
    });

    transforms.push(TransformDefinition {
        id: "ing".to_string(),
        rules: ing_suffix_inflections
            .iter()
            .cloned()
            .chain(create_phrasal_verb_inflections_from_suffix_inflections(
                &ing_suffix_inflections,
            ))
            .collect(),
    });

    transforms.push(TransformDefinition {
        id: "3rd pers. sing. pres".to_string(),
        rules: third_person_sg_present_suffix_inflections
            .iter()
            .cloned()
            .chain(create_phrasal_verb_inflections_from_suffix_inflections(
                &third_person_sg_present_suffix_inflections,
            ))
            .collect(),
    });

    transforms.push(TransformDefinition {
        id: "interposed object".to_string(),
        rules: vec![RuleDefinition {
            kind: RuleKind::EnglishPhrasalInterposedObject,
            conditions_in: Vec::new(),
            conditions_out: vec!["v_phr".to_string()],
        }],
    });

    transforms.push(TransformDefinition {
        id: "archaic".to_string(),
        rules: vec![suffix_rule("'d", "ed", &["v"], &["v"])],
    });

    transforms.push(TransformDefinition {
        id: "adverb".to_string(),
        rules: vec![
            suffix_rule("ly", "", &["adv"], &["adj"]),
            suffix_rule("ily", "y", &["adv"], &["adj"]),
            suffix_rule("ly", "le", &["adv"], &["adj"]),
        ],
    });

    transforms.push(TransformDefinition {
        id: "comparative".to_string(),
        rules: vec![
            suffix_rule("er", "", &["adj"], &["adj"]),
            suffix_rule("er", "e", &["adj"], &["adj"]),
            suffix_rule("ier", "y", &["adj"], &["adj"]),
        ]
        .into_iter()
        .chain(doubled_consonant_inflection(
            "bdgmnt",
            "er",
            &["adj"],
            &["adj"],
        ))
        .collect(),
    });

    transforms.push(TransformDefinition {
        id: "superlative".to_string(),
        rules: vec![
            suffix_rule("est", "", &["adj"], &["adj"]),
            suffix_rule("est", "e", &["adj"], &["adj"]),
            suffix_rule("iest", "y", &["adj"], &["adj"]),
        ]
        .into_iter()
        .chain(doubled_consonant_inflection(
            "bdgmnt",
            "est",
            &["adj"],
            &["adj"],
        ))
        .collect(),
    });

    transforms.push(TransformDefinition {
        id: "dropped g".to_string(),
        rules: vec![suffix_rule("in'", "ing", &["v"], &["v"])],
    });

    transforms.push(TransformDefinition {
        id: "-y".to_string(),
        rules: vec![
            suffix_rule("y", "", &["adj"], &["n", "v"]),
            suffix_rule("y", "e", &["adj"], &["n", "v"]),
        ]
        .into_iter()
        .chain(doubled_consonant_inflection(
            "glmnprst",
            "y",
            &[],
            &["n", "v"],
        ))
        .collect(),
    });

    transforms.push(TransformDefinition {
        id: "un-".to_string(),
        rules: vec![prefix_rule(
            "un",
            "",
            &["adj", "adv", "v"],
            &["adj", "adv", "v"],
        )],
    });

    transforms.push(TransformDefinition {
        id: "going-to future".to_string(),
        rules: vec![prefix_rule("going to ", "", &["v"], &["v"])],
    });

    transforms.push(TransformDefinition {
        id: "will future".to_string(),
        rules: vec![prefix_rule("will ", "", &["v"], &["v"])],
    });

    transforms.push(TransformDefinition {
        id: "imperative negative".to_string(),
        rules: vec![
            prefix_rule("don't ", "", &["v"], &["v"]),
            prefix_rule("do not ", "", &["v"], &["v"]),
        ],
    });

    transforms.push(TransformDefinition {
        id: "-able".to_string(),
        rules: vec![
            suffix_rule("able", "", &["v"], &["adj"]),
            suffix_rule("able", "e", &["v"], &["adj"]),
            suffix_rule("iable", "y", &["v"], &["adj"]),
        ]
        .into_iter()
        .chain(doubled_consonant_inflection(
            "bdgklmnprstz",
            "able",
            &["v"],
            &["adj"],
        ))
        .collect(),
    });

    LanguageTransformer::from_descriptor(Descriptor {
        conditions,
        transforms,
    })
    .expect("Failed to build English deinflector")
}

fn suffix_rule(
    inflected: &str,
    deinflected: &str,
    conditions_in: &[&str],
    conditions_out: &[&str],
) -> RuleDefinition {
    RuleDefinition {
        kind: RuleKind::Suffix {
            inflected: inflected.to_string(),
            deinflected: deinflected.to_string(),
        },
        conditions_in: conditions_in
            .iter()
            .map(|item| (*item).to_string())
            .collect(),
        conditions_out: conditions_out
            .iter()
            .map(|item| (*item).to_string())
            .collect(),
    }
}

fn prefix_rule(
    inflected: &str,
    deinflected: &str,
    conditions_in: &[&str],
    conditions_out: &[&str],
) -> RuleDefinition {
    RuleDefinition {
        kind: RuleKind::Prefix {
            inflected: inflected.to_string(),
            deinflected: deinflected.to_string(),
        },
        conditions_in: conditions_in
            .iter()
            .map(|item| (*item).to_string())
            .collect(),
        conditions_out: conditions_out
            .iter()
            .map(|item| (*item).to_string())
            .collect(),
    }
}

fn doubled_consonant_inflection(
    consonants: &str,
    suffix: &str,
    conditions_in: &[&str],
    conditions_out: &[&str],
) -> Vec<RuleDefinition> {
    consonants
        .chars()
        .map(|consonant| {
            let inflected = format!("{consonant}{consonant}{suffix}");
            suffix_rule(
                &inflected,
                &consonant.to_string(),
                conditions_in,
                conditions_out,
            )
        })
        .collect()
}

fn create_phrasal_verb_inflections_from_suffix_inflections(
    source_rules: &[RuleDefinition],
) -> Vec<RuleDefinition> {
    source_rules
        .iter()
        .filter_map(|rule| match &rule.kind {
            RuleKind::Suffix {
                inflected,
                deinflected,
            } => Some(RuleDefinition {
                kind: RuleKind::EnglishPhrasalSuffix {
                    inflected: inflected.clone(),
                    deinflected: deinflected.clone(),
                },
                conditions_in: vec!["v".to_string()],
                conditions_out: vec!["v_phr".to_string()],
            }),
            _ => None,
        })
        .collect()
}
