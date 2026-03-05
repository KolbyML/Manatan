use sled::Db;
use std::path::PathBuf;

pub const NOVEL_METADATA_DIR_NAME: &str = ".manatan-metadata";

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

    pub fn get_novel_metadata_root(&self) -> PathBuf {
        self.local_novel_path.join(NOVEL_METADATA_DIR_NAME)
    }

    pub fn get_novel_dir(&self, id: &str) -> PathBuf {
        self.get_novel_metadata_root().join(id)
    }

    pub fn get_epub_path(&self, id: &str) -> PathBuf {
        self.local_novel_path.join(format!("{id}.epub"))
    }

    pub fn get_legacy_novel_dir(&self, id: &str) -> PathBuf {
        self.local_novel_path.join(id)
    }

    pub fn get_legacy_epub_path(&self, id: &str) -> PathBuf {
        self.get_legacy_novel_dir(id).join(format!("{id}.epub"))
    }
}
