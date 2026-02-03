use std::path::PathBuf;

#[derive(Clone)]
pub struct AppState {
    pub suwayomi_base_url: String,
    pub data_dir: PathBuf,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        let suwayomi_base_url = std::env::var("MANATAN_SUWAYOMI_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:4566".to_string());
        Self {
            suwayomi_base_url,
            data_dir,
        }
    }
}
