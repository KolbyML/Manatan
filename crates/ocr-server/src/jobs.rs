use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use futures::StreamExt;
use serde::Serialize;

use crate::state::AppState;

#[derive(Clone, Copy, Serialize, Debug)]
pub struct JobProgress {
    pub current: usize,
    pub total: usize,
}

pub async fn run_chapter_job(
    state: AppState,
    base_url: String,
    pages: Vec<String>,
    user: Option<String>,
    pass: Option<String>,
    context: String,
) {
    let total = pages.len();
    let job_id = base_url.clone();

    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .insert(base_url.clone(), JobProgress { current: 0, total });
    }

    state.active_jobs.fetch_add(1, Ordering::Relaxed);
    tracing::info!("[Job] Started for {} ({} pages)", context, total);

    let completed_counter = Arc::new(AtomicUsize::new(0));
    let stream = futures::stream::iter(pages.into_iter());

    // Change from 6 to 2 or 3 for Android stability
    let concurrency_limit = if cfg!(target_os = "android") { 2 } else { 6 };

    stream
        .for_each_concurrent(concurrency_limit, |url| {
            let state = state.clone();
            let base_url = base_url.clone();
            let user = user.clone();
            let pass = pass.clone();
            let context = context.clone();
            let completed_counter = completed_counter.clone();

            let page_id = url.split('/').next_back().unwrap_or("unknown").to_string();

            async move {
                let cache_key = crate::logic::get_cache_key(&url);
                let exists = mangatan_stats_server::get_ocr_cache(&state.stats_db, &cache_key).is_some();
                if exists {
                    tracing::info!("[Page {page_id}] Skip (Cached)");
                } else {
                    tracing::info!("[Page {page_id}] Starting fetch_and_process (Async)...");

                    match crate::logic::fetch_and_process(&url, user, pass).await {
                        Ok(res) => {
                            // Convert OcrResult to OcrResultEntry for storage
                            let entries: Vec<mangatan_stats_server::OcrResultEntry> = res
                                .iter()
                                .map(|r| mangatan_stats_server::OcrResultEntry {
                                    text: r.text.clone(),
                                    tight_bounding_box: mangatan_stats_server::BoundingBox {
                                        x: r.tight_bounding_box.x,
                                        y: r.tight_bounding_box.y,
                                        width: r.tight_bounding_box.width,
                                        height: r.tight_bounding_box.height,
                                    },
                                    is_merged: r.is_merged,
                                    forced_orientation: r.forced_orientation.clone(),
                                })
                                .collect();
                            let _ = mangatan_stats_server::set_ocr_cache(&state.stats_db, &cache_key, &context, &entries);
                        }
                        Err(err) => {
                            tracing::warn!("[Page {page_id}] Failed: {err:?}");
                        }
                    }
                }

                let current = completed_counter.fetch_add(1, Ordering::Relaxed) + 1;

                {
                    if let Some(prog) = state
                        .active_chapter_jobs
                        .write()
                        .expect("lock")
                        .get_mut(&base_url)
                    {
                        prog.current = current;
                    }
                }
            }
        })
        .await;

    tracing::info!("[Job {job_id}] Processing complete.");

    state.active_jobs.fetch_sub(1, Ordering::Relaxed);

    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .remove(&base_url);
    }

    tracing::info!("[Job {job_id}] Finished for {}", context);
}
