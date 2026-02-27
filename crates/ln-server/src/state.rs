use std::path::PathBuf;
use sled::Db;

#[derive(Clone)]
pub struct LnState {
    pub db: Db,
    pub storage_dir: PathBuf,
    pub local_ln_path: PathBuf,
}

impl LnState {
    pub fn new(data_dir: PathBuf, local_ln_path: PathBuf) -> Self {
        let ln_dir = data_dir.join("ln");
        std::fs::create_dir_all(&ln_dir).expect("Failed to create LN directory");

        let db_path = ln_dir.join("ln.db");
        let db = sled::open(db_path).expect("Failed to open LN database");

        Self {
            db,
            storage_dir: ln_dir,
            local_ln_path,
        }
    }

    pub fn get_local_ln_path(&self) -> PathBuf {
        self.local_ln_path.clone()
    }

    pub fn get_novel_dir(&self, id: &str) -> PathBuf {
        self.local_ln_path.join(id)
    }
}
