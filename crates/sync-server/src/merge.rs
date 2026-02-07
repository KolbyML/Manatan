use crate::types::{ConflictInfo, LNMetadata, LNProgress, SyncPayload};
use std::collections::HashMap;
use tracing::debug;

/// Merge two sync payloads, returning the merged result
pub fn merge_payloads(
    local: SyncPayload,
    remote: SyncPayload,
    local_device_id: &str,
) -> (SyncPayload, Vec<ConflictInfo>) {
    let mut conflicts = Vec::new();

    // Merge progress
    let (merged_progress, progress_conflicts) =
        merge_progress_maps(local.ln_progress, remote.ln_progress, local_device_id);
    conflicts.extend(progress_conflicts);

    // Merge metadata
    let (merged_metadata, metadata_conflicts) =
        merge_metadata_maps(local.ln_metadata, remote.ln_metadata);
    conflicts.extend(metadata_conflicts);

    // Merge content (simple: prefer local if exists, else remote)
    let merged_content = merge_simple_maps(local.ln_content, remote.ln_content);

    // Merge files (simple: prefer local if exists, else remote)
    let merged_files = merge_simple_maps(local.ln_files, remote.ln_files);

    // Merge file manifest
    let merged_manifest = merge_simple_maps(local.file_manifest, remote.file_manifest);

    let merged = SyncPayload {
        schema_version: SyncPayload::CURRENT_SCHEMA_VERSION,
        device_id: local_device_id.to_string(),
        last_modified: chrono::Utc::now().timestamp_millis(),
        ln_progress: merged_progress,
        ln_metadata: merged_metadata,
        ln_content: merged_content,
        ln_files: merged_files,
        file_manifest: merged_manifest,
    };

    (merged, conflicts)
}

fn merge_progress_maps(
    local: HashMap<String, LNProgress>,
    remote: HashMap<String, LNProgress>,
    local_device_id: &str,
) -> (HashMap<String, LNProgress>, Vec<ConflictInfo>) {
    let mut merged = HashMap::new();
    let mut conflicts = Vec::new();

    // Get all unique book IDs
    let all_keys: std::collections::HashSet<_> =
        local.keys().chain(remote.keys()).cloned().collect();

    for book_id in all_keys {
        let local_progress = local.get(&book_id);
        let remote_progress = remote.get(&book_id);

        let chosen = match (local_progress, remote_progress) {
            (Some(l), None) => {
                debug!("Progress for {}: local only", book_id);
                l.clone()
            }
            (None, Some(r)) => {
                debug!("Progress for {}: remote only", book_id);
                r.clone()
            }
            (Some(l), Some(r)) => {
                // Same device: use highest version
                if l.device_id.as_deref() == Some(local_device_id)
                    && r.device_id.as_deref() == Some(local_device_id)
                {
                    if l.has_higher_version(r) {
                        debug!("Progress for {}: same device, local version higher", book_id);
                        l.clone()
                    } else {
                        debug!("Progress for {}: same device, remote version higher", book_id);
                        r.clone()
                    }
                } else {
                    // Different devices: use furthest progress
                    if r.is_further_than(l) {
                        debug!(
                            "Progress for {}: remote further ({} > {})",
                            book_id, r.total_progress, l.total_progress
                        );
                        conflicts.push(ConflictInfo {
                            book_id: book_id.clone(),
                            field: "progress".to_string(),
                            local_value: format!("{:.1}%", l.total_progress * 100.0),
                            remote_value: format!("{:.1}%", r.total_progress * 100.0),
                            resolution: "remote (further)".to_string(),
                        });
                        r.clone()
                    } else if l.is_further_than(r) {
                        debug!(
                            "Progress for {}: local further ({} > {})",
                            book_id, l.total_progress, r.total_progress
                        );
                        conflicts.push(ConflictInfo {
                            book_id: book_id.clone(),
                            field: "progress".to_string(),
                            local_value: format!("{:.1}%", l.total_progress * 100.0),
                            remote_value: format!("{:.1}%", r.total_progress * 100.0),
                            resolution: "local (further)".to_string(),
                        });
                        l.clone()
                    } else {
                        // Same progress: use most recent
                        if r.is_newer_than(l) {
                            debug!("Progress for {}: same progress, remote newer", book_id);
                            r.clone()
                        } else {
                            debug!("Progress for {}: same progress, local newer", book_id);
                            l.clone()
                        }
                    }
                }
            }
            (None, None) => unreachable!(),
        };

        merged.insert(book_id, chosen);
    }

    (merged, conflicts)
}

fn merge_metadata_maps(
    local: HashMap<String, LNMetadata>,
    remote: HashMap<String, LNMetadata>,
) -> (HashMap<String, LNMetadata>, Vec<ConflictInfo>) {
    let mut merged = HashMap::new();
    let conflicts = Vec::new();

    let all_keys: std::collections::HashSet<_> =
        local.keys().chain(remote.keys()).cloned().collect();

    for book_id in all_keys {
        let local_meta = local.get(&book_id);
        let remote_meta = remote.get(&book_id);

        let chosen = match (local_meta, remote_meta) {
            (Some(l), None) => l.clone(),
            (None, Some(r)) => r.clone(),
            (Some(l), Some(r)) => {
                // Use higher sync version, or more recent if same version
                match (l.sync_version, r.sync_version) {
                    (Some(lv), Some(rv)) if lv >= rv => l.clone(),
                    (Some(_), Some(_)) => r.clone(),
                    (Some(_), None) => l.clone(),
                    (None, Some(_)) => r.clone(),
                    (None, None) => {
                        // Fall back to last_modified
                        match (l.last_modified, r.last_modified) {
                            (Some(lt), Some(rt)) if lt >= rt => l.clone(),
                            (Some(_), Some(_)) => r.clone(),
                            _ => l.clone(),
                        }
                    }
                }
            }
            (None, None) => unreachable!(),
        };

        merged.insert(book_id, chosen);
    }

    (merged, conflicts)
}

fn merge_simple_maps<V: Clone>(
    local: HashMap<String, V>,
    remote: HashMap<String, V>,
) -> HashMap<String, V> {
    let mut merged = remote;
    for (k, v) in local {
        merged.entry(k).or_insert(v);
    }
    merged
}