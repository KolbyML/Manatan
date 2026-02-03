use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use futures::StreamExt;

use crate::{
    language::OcrLanguage,
    state::{AppState, JobProgress},
};

pub async fn run_chapter_job(
    state: AppState,
    base_url: String,
    pages: Vec<String>,
    user: Option<String>,
    pass: Option<String>,
    context: String,
    add_space_on_merge: Option<bool>,
    language: OcrLanguage,
) {
    let total = pages.len();
    let job_id = crate::logic::get_cache_key(&base_url, Some(language));

    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .insert(job_id.clone(), JobProgress { current: 0, total });
    }

    state.active_jobs.fetch_add(1, Ordering::Relaxed);
    tracing::info!("[Job] Started for {} ({} pages)", context, total);

    let completed_counter = Arc::new(AtomicUsize::new(0));
    let processed_counter = Arc::new(AtomicUsize::new(0));
    let stream = futures::stream::iter(pages.into_iter());

    // Change from 6 to 2 or 3 for Android stability
    let concurrency_limit = if cfg!(target_os = "android") { 2 } else { 6 };

    stream
        .for_each_concurrent(concurrency_limit, |url| {
            let state = state.clone();
            let job_id = job_id.clone();
            let user = user.clone();
            let pass = pass.clone();
            let context = context.clone();
            let completed_counter = completed_counter.clone();
            let processed_counter = processed_counter.clone();

            let page_id = url.split('/').next_back().unwrap_or("unknown").to_string();

            async move {
                let cache_key = crate::logic::get_cache_key(&url, Some(language));
                let exists = state.has_cache_entry(&cache_key);
                if exists {
                    state.insert_chapter_cache(&job_id, &cache_key);
                    processed_counter.fetch_add(1, Ordering::Relaxed);
                    tracing::info!("[Page {page_id}] Skip (Cached)");
                } else {
                    tracing::info!("[Page {page_id}] Starting fetch_and_process (Async)...");

                    // None defaults to Smart Detection for space merging
                    match crate::logic::fetch_and_process(
                        &url,
                        user,
                        pass,
                        add_space_on_merge,
                        language,
                    )
                    .await
                    {
                        Ok(res) => {
                            state.insert_cache_entry(
                                &cache_key,
                                &crate::state::CacheEntry {
                                    context: context.clone(),
                                    data: res,
                                },
                            );
                            state.insert_chapter_cache(&job_id, &cache_key);
                            processed_counter.fetch_add(1, Ordering::Relaxed);
                        }
                        Err(err) => {
                            tracing::warn!("[Page {page_id}] Failed: {err:?}");
                        }
                    }
                }

                let current = completed_counter.fetch_add(1, Ordering::Relaxed) + 1;
                let processed_count = processed_counter.load(Ordering::Relaxed);
                state.set_chapter_progress(&job_id, total, processed_count);

                {
                    if let Some(prog) = state
                        .active_chapter_jobs
                        .write()
                        .expect("lock")
                        .get_mut(&job_id)
                    {
                        prog.current = current;
                    }
                }
            }
        })
        .await;

    tracing::info!("[Job {job_id}] Finalize...");
    let processed_count = processed_counter.load(Ordering::Relaxed);
    state.set_chapter_progress(&job_id, total, processed_count);

    state.active_jobs.fetch_sub(1, Ordering::Relaxed);

    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .remove(&job_id);
    }

    tracing::info!("[Job {job_id}] Finished for {}", context);
}
