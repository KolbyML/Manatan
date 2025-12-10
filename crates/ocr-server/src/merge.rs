use std::cmp::Ordering;

use crate::logic::{BoundingBox, OcrResult};

#[derive(Clone)]
pub struct MergeConfig {
    pub enabled: bool,
    pub dist_k: f64,
    pub font_ratio: f64,
    pub perp_tol: f64,
    pub overlap_min: f64,
    pub min_line_ratio: f64,
    pub font_ratio_for_mixed: f64,
    pub mixed_min_overlap_ratio: f64,
    pub add_space_on_merge: bool,
}

impl Default for MergeConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            dist_k: 1.2,
            font_ratio: 1.3,
            perp_tol: 0.5,
            overlap_min: 0.1,
            min_line_ratio: 0.5,
            font_ratio_for_mixed: 1.1,
            mixed_min_overlap_ratio: 0.5,
            add_space_on_merge: false,
        }
    }
}

// Internal structures for calculation
struct ProcessedLine {
    original_index: usize,
    is_vertical: bool,
    font_size: f64,
    bbox: NormBbox,
    pixel_top: f64,
    pixel_bottom: f64,
}

struct NormBbox {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    right: f64,
    bottom: f64,
}

struct UnionFind {
    parent: Vec<usize>,
    rank: Vec<usize>,
}

impl UnionFind {
    fn new(size: usize) -> Self {
        Self {
            parent: (0..size).collect(),
            rank: vec![0; size],
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
            match self.rank[root_i].cmp(&self.rank[root_j]) {
                Ordering::Greater => self.parent[root_j] = root_i,
                Ordering::Less => self.parent[root_i] = root_j,
                Ordering::Equal => {
                    self.parent[root_j] = root_i;
                    self.rank[root_i] += 1;
                }
            }
        }
    }
}

fn median(data: &[f64]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut s = data.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
    let mid = s.len() / 2;
    // FIX: used is_multiple_of
    if s.len().is_multiple_of(2) {
        (s[mid - 1] + s[mid]) / 2.0
    } else {
        s[mid]
    }
}

pub fn auto_merge(lines: Vec<OcrResult>, w: u32, h: u32, config: &MergeConfig) -> Vec<OcrResult> {
    if !config.enabled || lines.len() < 2 {
        return lines;
    }

    // 1. Group
    let groups = group_ocr_data(&lines, w, h, config);
    let mut final_data = Vec::new();

    // 2. Merge groups
    for mut group in groups {
        if group.len() == 1 {
            // FIX: used expect instead of unwrap
            final_data.push(group.pop().expect("group not empty"));
            continue;
        }

        let vert_count = group
            .iter()
            .filter(|l| l.tight_bounding_box.height > l.tight_bounding_box.width)
            .count();
        let is_vert_group = vert_count > group.len() / 2;

        // Sort based on orientation (Replicating JS Logic)
        group.sort_by(|a, b| {
            let ba = &a.tight_bounding_box;
            let bb = &b.tight_bounding_box;
            if is_vert_group {
                // Right-to-left primary
                let ca = ba.x + ba.width / 2.0;
                let cb = bb.x + bb.width / 2.0;
                if (ca - cb).abs() > 0.001 {
                    cb.partial_cmp(&ca).unwrap_or(Ordering::Equal)
                } else {
                    (ba.y + ba.height / 2.0)
                        .partial_cmp(&(bb.y + bb.height / 2.0))
                        .unwrap_or(Ordering::Equal)
                }
            } else {
                // Top-to-bottom primary
                let ca = ba.y + ba.height / 2.0;
                let cb = bb.y + bb.height / 2.0;
                if (ca - cb).abs() > 0.001 {
                    ca.partial_cmp(&cb).unwrap_or(Ordering::Equal)
                } else {
                    (ba.x + ba.width / 2.0)
                        .partial_cmp(&(bb.x + bb.width / 2.0))
                        .unwrap_or(Ordering::Equal)
                }
            }
        });

        let join = if config.add_space_on_merge {
            " "
        } else {
            "\u{200B}"
        };
        let text = group
            .iter()
            .map(|l| l.text.as_str())
            .collect::<Vec<_>>()
            .join(join);

        let min_x = group
            .iter()
            .map(|l| l.tight_bounding_box.x)
            .fold(f64::INFINITY, f64::min);
        let min_y = group
            .iter()
            .map(|l| l.tight_bounding_box.y)
            .fold(f64::INFINITY, f64::min);
        let max_r = group
            .iter()
            .map(|l| l.tight_bounding_box.x + l.tight_bounding_box.width)
            .fold(f64::NEG_INFINITY, f64::max);
        let max_b = group
            .iter()
            .map(|l| l.tight_bounding_box.y + l.tight_bounding_box.height)
            .fold(f64::NEG_INFINITY, f64::max);

        final_data.push(OcrResult {
            text,
            is_merged: Some(true),
            forced_orientation: Some(if is_vert_group {
                "vertical".into()
            } else {
                "horizontal".into()
            }),
            tight_bounding_box: BoundingBox {
                x: min_x,
                y: min_y,
                width: max_r - min_x,
                height: max_b - min_y,
            },
        });
    }

    final_data
}

fn group_ocr_data(
    lines: &[OcrResult],
    w: u32,
    h: u32,
    config: &MergeConfig,
) -> Vec<Vec<OcrResult>> {
    let wf = w as f64;
    let hf = h as f64;
    let norm_scale = 1000.0 / wf;

    // Pre-calc metrics
    let mut processed: Vec<ProcessedLine> = lines
        .iter()
        .enumerate()
        .map(|(idx, l)| {
            let b = &l.tight_bounding_box;
            let nx = b.x * wf * norm_scale;
            let ny = b.y * hf * norm_scale;
            let nw = b.width * wf * norm_scale;
            let nh = b.height * hf * norm_scale;

            let is_v = nw <= nh;

            ProcessedLine {
                original_index: idx,
                is_vertical: is_v,
                font_size: if is_v { nw } else { nh },
                bbox: NormBbox {
                    x: nx,
                    y: ny,
                    width: nw,
                    height: nh,
                    right: nx + nw,
                    bottom: ny + nh,
                },
                pixel_top: b.y * hf,
                pixel_bottom: (b.y + b.height) * hf,
            }
        })
        .collect();

    processed.sort_by(|a, b| {
        a.pixel_top
            .partial_cmp(&b.pixel_top)
            .unwrap_or(Ordering::Equal)
    });

    let mut all_groups = Vec::new();
    let mut curr_idx = 0;
    let chunk_limit = 3000.0;

    while curr_idx < processed.len() {
        let start = curr_idx;
        let mut end = processed.len() - 1;

        if hf > chunk_limit {
            let top = processed[start].pixel_top;
            // FIX: Removed range loop, used explicit iterator
            for (i, p) in processed.iter().enumerate().skip(start + 1) {
                if p.pixel_bottom - top <= chunk_limit {
                    end = i;
                } else {
                    break;
                }
            }
        }

        let slice = &processed[start..=end];
        let mut uf = UnionFind::new(slice.len());

        let h_lines: Vec<&ProcessedLine> = slice.iter().filter(|l| !l.is_vertical).collect();
        let v_lines: Vec<&ProcessedLine> = slice.iter().filter(|l| l.is_vertical).collect();

        let med_h = median(&h_lines.iter().map(|l| l.bbox.height).collect::<Vec<_>>());
        let med_w = median(&v_lines.iter().map(|l| l.bbox.width).collect::<Vec<_>>());

        let rob_h = if med_h > 0.0 { med_h } else { 20.0 };
        let rob_w = if med_w > 0.0 { med_w } else { 20.0 };

        for i in 0..slice.len() {
            for j in (i + 1)..slice.len() {
                let la = &slice[i];
                let lb = &slice[j];
                if la.is_vertical != lb.is_vertical {
                    continue;
                }

                let med_o = if la.is_vertical { rob_w } else { rob_h };
                let is_a_prim = la.font_size >= med_o * config.min_line_ratio;
                let is_b_prim = lb.font_size >= med_o * config.min_line_ratio;

                let ratio_t = if is_a_prim != is_b_prim {
                    config.font_ratio_for_mixed
                } else {
                    config.font_ratio
                };
                let f_ratio = f64::max(la.font_size / lb.font_size, lb.font_size / la.font_size);

                if f_ratio > ratio_t {
                    continue;
                }

                let dist_t = med_o * config.dist_k;
                let (gap, overlap) = if la.is_vertical {
                    (
                        f64::max(
                            0.0,
                            f64::max(la.bbox.x, lb.bbox.x) - f64::min(la.bbox.right, lb.bbox.right),
                        ),
                        f64::max(
                            0.0,
                            f64::min(la.bbox.bottom, lb.bbox.bottom)
                                - f64::max(la.bbox.y, lb.bbox.y),
                        ),
                    )
                } else {
                    (
                        f64::max(
                            0.0,
                            f64::max(la.bbox.y, lb.bbox.y)
                                - f64::min(la.bbox.bottom, lb.bbox.bottom),
                        ),
                        f64::max(
                            0.0,
                            f64::min(la.bbox.right, lb.bbox.right) - f64::max(la.bbox.x, lb.bbox.x),
                        ),
                    )
                };

                if gap > dist_t {
                    continue;
                }

                let min_perp = f64::min(
                    if la.is_vertical {
                        la.bbox.height
                    } else {
                        la.bbox.width
                    },
                    if lb.is_vertical {
                        lb.bbox.height
                    } else {
                        lb.bbox.width
                    },
                );

                if min_perp > 0.0 && (overlap / min_perp) < config.overlap_min {
                    continue;
                }
                if is_a_prim != is_b_prim
                    && min_perp > 0.0
                    && (overlap / min_perp) < config.mixed_min_overlap_ratio
                {
                    continue;
                }

                uf.union(i, j);
            }
        }

        let mut map: std::collections::HashMap<usize, Vec<usize>> =
            std::collections::HashMap::new();
        // FIX: Removed range loop, used explicit iterator
        for (i, _) in slice.iter().enumerate() {
            let r = uf.find(i);
            map.entry(r).or_default().push(slice[i].original_index);
        }

        for idxs in map.values() {
            all_groups.push(idxs.iter().map(|&ix| lines[ix].clone()).collect());
        }

        curr_idx = end + 1;
    }

    all_groups
}
