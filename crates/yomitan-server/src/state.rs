use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufReader, BufWriter},
    path::PathBuf,
    sync::{
        Arc, RwLock,
        atomic::{AtomicBool, Ordering},
    },
};
use tracing::{error, info};
use wordbase_api::{Dictionary, DictionaryId, Record};

#[derive(Clone)]
pub struct AppState {
    pub inner: Arc<RwLock<DictionaryState>>,
    pub data_dir: PathBuf,
    pub loading: Arc<AtomicBool>,
}

#[derive(Default, Serialize, Deserialize)]
pub struct DictionaryState {
    pub dictionaries: HashMap<DictionaryId, Dictionary>,
    pub index: HashMap<String, Vec<StoredRecord>>,
    pub next_dict_id: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct StoredRecord {
    pub dictionary_id: DictionaryId,
    pub record: Record,
    // NEW: Store the reading so we can generate furigana later
    pub reading: Option<String>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        let state_path = data_dir.join("yomitan-state.json");

        let inner_state = if state_path.exists() {
            info!("📂 [Yomitan] Loading saved state from {:?}...", state_path);
            match File::open(&state_path) {
                Ok(file) => {
                    let reader = BufReader::new(file);
                    match serde_json::from_reader(reader) {
                        Ok(state) => {
                            info!("✅ [Yomitan] State loaded successfully.");
                            state
                        }
                        Err(e) => {
                            error!(
                                "❌ [Yomitan] Failed to parse state file: {}. Starting fresh.",
                                e
                            );
                            DictionaryState::default()
                        }
                    }
                }
                Err(e) => {
                    error!(
                        "❌ [Yomitan] Failed to open state file: {}. Starting fresh.",
                        e
                    );
                    DictionaryState::default()
                }
            }
        } else {
            DictionaryState::default()
        };

        Self {
            inner: Arc::new(RwLock::new(inner_state)),
            data_dir,
            loading: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let state_path = self.data_dir.join("yomitan-state.json");
        let tmp_path = self.data_dir.join("yomitan-state.tmp");

        let state = self.inner.read().expect("lock");

        let file = File::create(&tmp_path)?;
        let writer = BufWriter::new(file);

        serde_json::to_writer(writer, &*state)?;

        fs::rename(tmp_path, state_path)?;
        Ok(())
    }

    pub fn set_loading(&self, val: bool) {
        self.loading.store(val, Ordering::SeqCst);
    }

    pub fn is_loading(&self) -> bool {
        self.loading.load(Ordering::Relaxed)
    }
}
