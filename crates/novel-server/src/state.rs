use std::path::PathBuf;
use sled::Db;

#[derive(Clone)]
pub struct NovelState {
    pub db: Db,
    pub storage_dir: PathBuf,
    pub local_novel_path: PathBuf,
}

impl NovelState {
    pub fn new(data_dir: PathBuf, local_novel_path: PathBuf) -> Self {
        let novel_dir = data_dir.join("novel");
        std::fs::create_dir_all(&novel_dir).expect("Failed to create novel directory");

        let db_path = novel_dir.join("novel.db");
        let db = sled::open(db_path).expect("Failed to open novel database");

        Self {
            db,
            storage_dir: novel_dir,
            local_novel_path,
        }
    }

    pub fn get_local_novel_path(&self) -> PathBuf {
        self.local_novel_path.clone()
    }

    pub fn get_novel_dir(&self, id: &str) -> PathBuf {
        self.local_novel_path.join(id)
    }
}
