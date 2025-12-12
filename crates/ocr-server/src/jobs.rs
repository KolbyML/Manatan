use std::{sync::atomic::Ordering, time::Duration};

use crate::state::AppState;

pub async fn run_chapter_job(
    state: AppState,
    base_url: String,
    user: Option<String>,
    pass: Option<String>,
    context: String,
) {
    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .insert(base_url.clone());
    }
    state.active_jobs.fetch_add(1, Ordering::Relaxed);
    tracing::info!("[Job] Started for {}", context);

    let mut page_idx = 0;
    let mut errors = 0;
    let max_errors = 3;

    while errors < max_errors {
        let url = format!("{base_url}{page_idx}");
        let cache_key = crate::logic::get_cache_key(&url);
        let exists = { state.cache.read().expect("lock").contains_key(&cache_key) };

        if exists {
            tracing::info!("[Job] Skip (Cached): {url}");
            page_idx += 1;
            errors = 0;
            continue;
        }

        match crate::logic::fetch_and_process(&url, user.clone(), pass.clone()).await {
            Ok(res) => {
                errors = 0;
                tracing::info!("[Job] Processed: {url}");
                let mut w = state.cache.write().expect("lock");
                w.insert(
                    cache_key,
                    crate::state::CacheEntry {
                        context: context.clone(),
                        data: res,
                    },
                );
            }
            Err(err) => {
                errors += 1;
                tracing::warn!("[Job] Failed: {url} (Error Count: {errors}, Error: {err:?})");
            }
        }

        if page_idx % 5 == 0 {
            state.save_cache();
        }
        page_idx += 1;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    state.save_cache();
    state.active_jobs.fetch_sub(1, Ordering::Relaxed);

    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .remove(&base_url);
    }
    tracing::info!("[Job] Finished for {} {}", base_url, context);
}
