use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{Arc, RwLock, atomic::AtomicUsize},
};

use serde::{Deserialize, Serialize};

use crate::logic::OcrResult;

#[derive(Clone)]
pub struct AppState {
    pub cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    pub cache_path: PathBuf,
    pub active_jobs: Arc<AtomicUsize>,
    pub requests_processed: Arc<AtomicUsize>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CacheEntry {
    pub context: String,
    pub data: Vec<OcrResult>,
}

impl AppState {
    pub fn new(cache_dir: PathBuf) -> Self {
        let cache_path = cache_dir.join("ocr-cache.json");
        let cache = if cache_path.exists() {
            if let Ok(file) = fs::File::open(&cache_path) {
                serde_json::from_reader(file).unwrap_or_default()
            } else {
                HashMap::new()
            }
        } else {
            HashMap::new()
        };

        Self {
            cache: Arc::new(RwLock::new(cache)),
            cache_path,
            active_jobs: Arc::new(AtomicUsize::new(0)),
            requests_processed: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub fn save_cache(&self) {
        // FIX: Collapsed if statements
        if let Ok(reader) = self.cache.read()
            && let Ok(file) = fs::File::create(&self.cache_path)
        {
            let _ = serde_json::to_writer_pretty(file, &*reader);
        }
    }
}
