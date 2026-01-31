use std::cmp::Ordering;

use lazy_static::lazy_static;
use regex::Regex;

use crate::language::OcrLanguage;
use crate::logic::{BoundingBox, OcrResult};

lazy_static! {
    static ref JAPANESE_REGEX: Regex = Regex::new(r"[\p{Hiragana}\p{Katakana}\p{Han}]").unwrap();
    static ref LINE_NOISE_REGEX: Regex = Regex::new(r"^[|—_ノヘく/\\:;]$").unwrap();
    static ref KANJI_REGEX: Regex = Regex::new(r"\p{Han}").unwrap();
    static ref KATAKANA_REGEX: Regex = Regex::new(r"[\p{Katakana}]").unwrap();
}

#[derive(Clone)]
pub struct MergeConfig {
    pub enabled: bool,
    pub font_size_ratio: f64,
    pub add_space_on_merge: Option<bool>,
    pub language: OcrLanguage,
}

impl Default for MergeConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            font_size_ratio: 3.0,
            add_space_on_merge: None,
            language: OcrLanguage::default(),
        }
    }
}

// --- Geometry Helpers ---

#[derive(Debug, Clone, Copy, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}

fn get_bounding_box_corners(bbox: &BoundingBox) -> Vec<Point> {
    let center_x = bbox.x + bbox.width / 2.0;
    let center_y = bbox.y + bbox.height / 2.0;
    let half_width = bbox.width / 2.0;
    let half_height = bbox.height / 2.0;
    let rotation = bbox.rotation.unwrap_or(0.0);

    let corners = vec![
        Point {
            x: -half_width,
            y: -half_height,
        },
        Point {
            x: half_width,
            y: -half_height,
        },
        Point {
            x: half_width,
            y: half_height,
        },
        Point {
            x: -half_width,
            y: half_height,
        },
    ];

    let cos_angle = rotation.cos();
    let sin_angle = rotation.sin();

    corners
        .into_iter()
        .map(|point| Point {
            x: point.x * cos_angle - point.y * sin_angle + center_x,
            y: point.x * sin_angle + point.y * cos_angle + center_y,
        })
        .collect()
}

fn calculate_aabb(points: &[Point]) -> (f64, f64, f64, f64, f64) {
    if points.is_empty() {
        return (0.0, 0.0, 0.0, 0.0, 0.0);
    }

    let min_x = points.iter().fold(f64::INFINITY, |a, b| a.min(b.x));
    let max_x = points.iter().fold(f64::NEG_INFINITY, |a, b| a.max(b.x));
    let min_y = points.iter().fold(f64::INFINITY, |a, b| a.min(b.y));
    let max_y = points.iter().fold(f64::NEG_INFINITY, |a, b| a.max(b.y));

    let width = max_x - min_x;
    let height = max_y - min_y;
    let center_x = min_x + width / 2.0;
    let center_y = min_y + height / 2.0;

    (center_x, center_y, width, height, 0.0)
}

// --- Pre-Processing Filters ---

fn filter_bad_boxes(
    lines: Vec<OcrResult>,
    page_w: u32,
    page_h: u32,
    config: &MergeConfig,
) -> Vec<OcrResult> {
    let mut keep = vec![true; lines.len()];
    let n = lines.len();
    let page_area = (page_w as f64) * (page_h as f64);

    // 1. Noise & SFX Filter
    for i in 0..n {
        let l = &lines[i];
        let text = l.text.trim();
        let text_len = text.chars().count();
        let box_area = l.tight_bounding_box.width * l.tight_bounding_box.height;

        if text_len == 1 {
            let ch = text.chars().next().unwrap();
            if ch.is_ascii_punctuation() || ch.is_ascii_digit() {
                keep[i] = false;
                continue;
            }
            if LINE_NOISE_REGEX.is_match(text) {
                keep[i] = false;
                continue;
            }
        }

        if box_area < page_area * 0.0005 {
            if !config.language.prefers_vertical() || !JAPANESE_REGEX.is_match(text) {
                keep[i] = false;
                continue;
            }
        }

        if box_area > page_area * 0.30 && text_len < 6 {
            keep[i] = false;
            continue;
        }
    }

    // 2. Overlap / Ghost Detection
    for i in 0..n {
        if !keep[i] {
            continue;
        }
        for j in 0..n {
            if i == j || !keep[j] {
                continue;
            }

            let a = &lines[i];
            let b = &lines[j];

            let x_overlap = (a.tight_bounding_box.x + a.tight_bounding_box.width)
                .min(b.tight_bounding_box.x + b.tight_bounding_box.width)
                - a.tight_bounding_box.x.max(b.tight_bounding_box.x);
            let y_overlap = (a.tight_bounding_box.y + a.tight_bounding_box.height)
                .min(b.tight_bounding_box.y + b.tight_bounding_box.height)
                - a.tight_bounding_box.y.max(b.tight_bounding_box.y);

            if x_overlap > 0.0 && y_overlap > 0.0 {
                let intersection_area = x_overlap * y_overlap;
                let b_area = b.tight_bounding_box.width * b.tight_bounding_box.height;

                if intersection_area > b_area * 0.3 {
                    let a_area = a.tight_bounding_box.width * a.tight_bounding_box.height;
                    if a_area > b_area * 3.0 && intersection_area > b_area * 0.8 {
                        if config.language.prefers_vertical() && JAPANESE_REGEX.is_match(&b.text) {
                            if !a.text.contains(&b.text) {
                                continue;
                            }
                        }
                        keep[j] = false;
                        continue;
                    }
                }
            }
        }
    }

    // 3. Furigana Check (Japanese only)
    if config.language.is_japanese() {
        for i in 0..n {
            if !keep[i] {
                continue;
            }
            for j in 0..n {
                if i == j || !keep[j] {
                    continue;
                }

                let main = &lines[i];
                let sub = &lines[j];

                if !KANJI_REGEX.is_match(&main.text) {
                    continue;
                }

                let main_thickness = main
                    .tight_bounding_box
                    .width
                    .min(main.tight_bounding_box.height);
                let sub_thickness = sub
                    .tight_bounding_box
                    .width
                    .min(sub.tight_bounding_box.height);

                if KANJI_REGEX.is_match(&sub.text) || KATAKANA_REGEX.is_match(&sub.text) {
                    continue;
                }

                if sub_thickness > main_thickness * 0.80 {
                    continue;
                }

                let proximity_limit = main_thickness * 0.5;

                let x_gap_v = sub.tight_bounding_box.x
                    - (main.tight_bounding_box.x + main.tight_bounding_box.width);
                let y_overlap_v = (main.tight_bounding_box.y + main.tight_bounding_box.height)
                    .min(sub.tight_bounding_box.y + sub.tight_bounding_box.height)
                    - main.tight_bounding_box.y.max(sub.tight_bounding_box.y);

                let is_vertical_furigana = x_gap_v > -main_thickness * 0.5
                    && x_gap_v < proximity_limit
                    && y_overlap_v > 0.0;

                let y_gap_h = main.tight_bounding_box.y
                    - (sub.tight_bounding_box.y + sub.tight_bounding_box.height);
                let x_overlap_h = (main.tight_bounding_box.x + main.tight_bounding_box.width)
                    .min(sub.tight_bounding_box.x + sub.tight_bounding_box.width)
                    - main.tight_bounding_box.x.max(sub.tight_bounding_box.x);

                let is_horizontal_furigana = y_gap_h > -main_thickness * 0.5
                    && y_gap_h < proximity_limit
                    && x_overlap_h > 0.0;

                if is_vertical_furigana || is_horizontal_furigana {
                    keep[j] = false;
                }
            }
        }
    }

    lines
        .into_iter()
        .enumerate()
        .filter(|(i, _)| keep[*i])
        .map(|(_, l)| l)
        .collect()
}

// --- Dynamic Merging Logic ---

struct ProcessedLine {
    is_vertical: bool,
    font_size: f64,
    length_main: f64,
    min_main: f64,
    max_main: f64,
    min_cross: f64,
    max_cross: f64,
}

struct UnionFind {
    parent: Vec<usize>,
}
impl UnionFind {
    fn new(n: usize) -> Self {
        Self {
            parent: (0..n).collect(),
        }
    }
    fn find(&mut self, i: usize) -> usize {
        if self.parent[i] != i {
            self.parent[i] = self.find(self.parent[i]);
        }
        self.parent[i]
    }
    fn union(&mut self, i: usize, j: usize) {
        let root_i = self.find(i);
        let root_j = self.find(j);
        if root_i != root_j {
            self.parent[root_i] = root_j;
        }
    }
}

fn are_lines_mergeable(a: &ProcessedLine, b: &ProcessedLine, config: &MergeConfig) -> bool {
    if a.is_vertical != b.is_vertical {
        return false;
    }

    let max_font = a.font_size.max(b.font_size);
    let min_font = a.font_size.min(b.font_size);
    let font_ratio = max_font / min_font;

    if font_ratio > config.font_size_ratio {
        return false;
    }

    let raw_overlap_main = a.max_main.min(b.max_main) - a.min_main.max(b.min_main);

    // Panel/Vertical Continuity Check
    if raw_overlap_main < -min_font * 0.5 {
        return false;
    }

    let overlap_main = 0.0f64.max(raw_overlap_main);
    let gap_cross = 0.0f64
        .max(b.min_cross - a.max_cross)
        .max(a.min_cross - b.max_cross);

    let base_metric = min_font;
    let global_overlap = overlap_main / a.length_main.max(b.length_main);

    // --- REFINED TIERED STRATEGY (INVERTED LOGIC) ---

    // 1. TOUCHING: Merge anything that touches horizontally.
    if gap_cross < base_metric * 0.2 {
        return true;
    }

    let is_highly_similar = font_ratio < 1.25;
    let mut allowed_gap: f64 = 0.0;

    if is_highly_similar {
        // TIER 2A: High Overlap (>80%) -> Wide Gap (2.0x)
        if global_overlap > 0.8 {
            allowed_gap = 2.0;
        }
        // TIER 2B: Medium Overlap (40%-80%) -> STRICT GAP (0.9x)
        // [FIX] This forces Distinct Bubbles (Right Side) to split.
        else if global_overlap > 0.4 {
            allowed_gap = 0.9;
        }
        // TIER 2C: Low Overlap (<40%) -> LOOSE GAP (1.3x)
        // [FIX] This allows Staggered Lines (Left Side) to merge.
        else {
            allowed_gap = 1.3;
        }
    } else {
        // TIER 3: Dissimilar Fonts -> Strict
        if global_overlap > 0.5 {
            allowed_gap = 0.8;
        }
    }

    // Sidebar Protection
    let len_ratio = a.length_main.max(b.length_main) / a.length_main.min(b.length_main);
    if len_ratio > 2.5 {
        allowed_gap = allowed_gap.min(0.8);
    }

    // Font Consistency Check
    if gap_cross > base_metric * 1.2 {
        if font_ratio > 1.15 {
            return false;
        }
    }

    if gap_cross > base_metric * allowed_gap {
        return false;
    }

    // Main Axis Proximity
    if overlap_main <= 0.0 {
        let gap_main = 0.0f64
            .max(b.min_main - a.max_main)
            .max(a.min_main - b.max_main);
        if gap_main > base_metric * 0.6 {
            return false;
        }
    }

    true
}

pub fn auto_merge(lines: Vec<OcrResult>, w: u32, h: u32, config: &MergeConfig) -> Vec<OcrResult> {
    if !config.enabled || lines.is_empty() {
        return lines;
    }

    let clean_lines = filter_bad_boxes(lines, w, h, config);

    let processed: Vec<ProcessedLine> = clean_lines
        .iter()
        .map(|l| {
            let b = &l.tight_bounding_box;
            let prefers_vertical = config.language.prefers_vertical();
            let lens_is_vertical = l.forced_orientation.as_deref() == Some("vertical");
            let char_count = l.text.chars().count();

            let is_v = if prefers_vertical {
                if char_count == 1 {
                    b.height > b.width * 0.8
                } else {
                    let is_physically_vertical = b.height > b.width;
                    lens_is_vertical || is_physically_vertical
                }
            } else {
                lens_is_vertical && b.height > b.width * 1.1
            };

            let (min_main, max_main, min_cross, max_cross) = if is_v {
                (b.y, b.y + b.height, b.x, b.x + b.width)
            } else {
                (b.x, b.x + b.width, b.y, b.y + b.height)
            };

            ProcessedLine {
                is_vertical: is_v,
                font_size: if is_v { b.width } else { b.height },
                length_main: if is_v { b.height } else { b.width },
                min_main,
                max_main,
                min_cross,
                max_cross,
            }
        })
        .collect();

    let mut uf = UnionFind::new(processed.len());
    for i in 0..processed.len() {
        for j in (i + 1)..processed.len() {
            if are_lines_mergeable(&processed[i], &processed[j], config) {
                uf.union(i, j);
            }
        }
    }

    let mut groups: std::collections::HashMap<usize, Vec<usize>> = std::collections::HashMap::new();
    for i in 0..processed.len() {
        groups.entry(uf.find(i)).or_default().push(i);
    }

    let mut results = Vec::new();
    for (_, indices) in groups {
        if indices.is_empty() {
            continue;
        }

        if indices.len() == 1 {
            let mut line = clean_lines[indices[0]].clone();
            let is_v = processed[indices[0]].is_vertical;
            line.forced_orientation = Some(if is_v {
                "vertical".into()
            } else {
                "horizontal".into()
            });
            results.push(line);
            continue;
        }

        let mut group_lines: Vec<&OcrResult> = indices.iter().map(|&i| &clean_lines[i]).collect();
        let is_vertical = processed[indices[0]].is_vertical;

        group_lines.sort_by(|a, b| {
            let ba = &a.tight_bounding_box;
            let bb = &b.tight_bounding_box;
            if is_vertical {
                let ra = ba.x + ba.width;
                let rb = bb.x + bb.width;
                if (ra - rb).abs() > 5.0 {
                    rb.partial_cmp(&ra).unwrap_or(Ordering::Equal)
                } else {
                    ba.y.partial_cmp(&bb.y).unwrap_or(Ordering::Equal)
                }
            } else {
                if (ba.y - bb.y).abs() > 5.0 {
                    ba.y.partial_cmp(&bb.y).unwrap_or(Ordering::Equal)
                } else {
                    ba.x.partial_cmp(&bb.x).unwrap_or(Ordering::Equal)
                }
            }
        });

        let use_space_separator = if let Some(forced) = config.add_space_on_merge {
            forced
        } else {
            !config.language.prefers_no_space()
        };

        let mut text_content = String::new();
        for (i, line) in group_lines.iter().enumerate() {
            if i == 0 {
                text_content.push_str(&line.text);
                continue;
            }
            let prev = &group_lines[i - 1];
            let curr = line;
            let is_new_line = if is_vertical {
                let p_x2 = prev.tight_bounding_box.x + prev.tight_bounding_box.width;
                let c_x1 = curr.tight_bounding_box.x;
                (p_x2 - c_x1).abs() > 0.0
            } else {
                let p_y2 = prev.tight_bounding_box.y + prev.tight_bounding_box.height;
                let c_y1 = curr.tight_bounding_box.y;
                (c_y1 - p_y2).max(0.0) > 0.0
            };

            if is_new_line {
                text_content.push('\n');
                text_content.push_str(&curr.text);
            } else {
                if use_space_separator {
                    text_content.push(' ');
                }
                text_content.push_str(&curr.text);
            }
        }

        let mut points = Vec::new();
        for l in &group_lines {
            points.extend(get_bounding_box_corners(&l.tight_bounding_box));
        }
        let (cx, cy, w, h, _rot) = calculate_aabb(&points);

        results.push(OcrResult {
            text: text_content,
            tight_bounding_box: BoundingBox {
                x: cx - w / 2.0,
                y: cy - h / 2.0,
                width: w,
                height: h,
                rotation: None,
            },
            is_merged: Some(true),
            forced_orientation: Some(if is_vertical {
                "vertical".into()
            } else {
                "horizontal".into()
            }),
        });
    }
    results
}
