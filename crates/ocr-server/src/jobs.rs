use std::{sync::atomic::Ordering, time::Duration};

use crate::state::{AppState, JobProgress};

pub async fn run_chapter_job(
    state: AppState,
    base_url: String,
    pages: Vec<String>,
    user: Option<String>,
    pass: Option<String>,
    context: String,
) {
    let total = pages.len();

    {
        state
            .active_chapter_jobs
            .write()
            .expect("lock poisoned")
            .insert(base_url.clone(), JobProgress { current: 0, total });
    }

    state.active_jobs.fetch_add(1, Ordering::Relaxed);
    tracing::info!("[Job] Started for {} ({} pages)", context, total);

    for (i, url) in pages.iter().enumerate() {
        {
            if let Some(prog) = state
                .active_chapter_jobs
                .write()
                .expect("lock")
                .get_mut(&base_url)
            {
                prog.current = i + 1;
            }
        }

        let cache_key = crate::logic::get_cache_key(url);
        let exists = { state.cache.read().expect("lock").contains_key(&cache_key) };

        if exists {
            tracing::info!("[Job] Skip (Cached): {url}");
            continue;
        }

        // Process
        match crate::logic::fetch_and_process(url, user.clone(), pass.clone()).await {
            Ok(res) => {
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
                tracing::warn!("[Job] Failed: {url} (Error: {err:?})");
            }
        }

        if i % 5 == 0 {
            state.save_cache();
        }

        tokio::time::sleep(Duration::from_millis(200)).await;
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

    tracing::info!("[Job] Finished for {}", context);
}
