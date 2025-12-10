use std::{sync::atomic::Ordering, time::Duration};

use crate::state::AppState;

pub async fn run_chapter_job(
    state: AppState,
    base_url: String,
    user: Option<String>,
    pass: Option<String>,
    context: String,
) {
    state.active_jobs.fetch_add(1, Ordering::Relaxed);
    tracing::info!("[Job] Started for {}", context);

    let mut page_idx = 0;
    let mut errors = 0;
    let max_errors = 3;

    while errors < max_errors {
        // FIX: Inlined variables into format string
        let url = format!("{base_url}{page_idx}");

        // Check cache first
        // FIX: Used expect instead of unwrap
        let exists = {
            state
                .cache
                .read()
                .expect("cache lock poisoned")
                .contains_key(&url)
        };
        if exists {
            tracing::info!("[Job] Skip (Cached): {}", url);
            page_idx += 1;
            errors = 0;
            continue;
        }

        // Logic call directly
        match crate::logic::fetch_and_process(&url, user.clone(), pass.clone()).await {
            Ok(res) => {
                errors = 0;
                tracing::info!("[Job] Processed: {}", url);
                // FIX: Used expect instead of unwrap
                let mut w = state.cache.write().expect("cache lock poisoned");
                w.insert(
                    url,
                    crate::state::CacheEntry {
                        context: context.clone(),
                        data: res,
                    },
                );
            }
            Err(_) => {
                errors += 1;
                tracing::warn!("[Job] Failed: {} (Errors: {})", url, errors);
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
    tracing::info!("[Job] Finished for {}", context);
}
