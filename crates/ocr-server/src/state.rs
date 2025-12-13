use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Write, // Added Write trait
    path::PathBuf,
    sync::{Arc, RwLock, atomic::AtomicUsize},
};

use serde::{Deserialize, Serialize};

use crate::logic::OcrResult;

#[derive(Clone, Copy, Serialize, Debug)]
pub struct JobProgress {
    pub current: usize,
    pub total: usize,
}

#[derive(Clone)]
pub struct AppState {
    pub cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    pub cache_path: PathBuf,
    pub active_jobs: Arc<AtomicUsize>,
    pub requests_processed: Arc<AtomicUsize>,
    pub active_chapter_jobs: Arc<RwLock<HashMap<String, JobProgress>>>,
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
            active_chapter_jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn save_cache(&self) {
        let data = {
            let cache = self.cache.read().expect("cache lock poisoned");
            serde_json::to_vec_pretty(&*cache).unwrap_or_default()
        };

        let tmp_path = self.cache_path.with_extension("tmp");

        if let Ok(mut file) = fs::File::create(&tmp_path) {
            if file.write_all(&data).is_ok() {
                let _ = file.sync_all();
                let _ = fs::rename(&tmp_path, &self.cache_path);
            }
        } else {
            tracing::error!("Failed to create temp file for saving cache");
        }
    }
}
