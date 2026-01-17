use std::collections::HashMap;
use std::sync::atomic::AtomicUsize;
use std::sync::{Arc, RwLock};

use mangatan_stats_server::StatsDb;

use crate::jobs::JobProgress;

#[derive(Clone)]
pub struct AppState {
    pub stats_db: StatsDb,
    pub active_jobs: Arc<AtomicUsize>,
    pub requests_processed: Arc<AtomicUsize>,
    pub active_chapter_jobs: Arc<RwLock<HashMap<String, JobProgress>>>,
}

impl AppState {
    pub fn new(stats_db: StatsDb) -> Self {
        Self {
            stats_db,
            active_jobs: Arc::new(AtomicUsize::new(0)),
            requests_processed: Arc::new(AtomicUsize::new(0)),
            active_chapter_jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
