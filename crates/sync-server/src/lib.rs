use std::path::PathBuf;

use axum::{Router, extract::DefaultBodyLimit};
use tower_http::cors::{Any, CorsLayer};

pub mod backend;
pub mod error;
pub mod merge;
pub mod routes;
pub mod state;
pub mod types;

pub use error::SyncError;
pub use state::SyncState;
pub use types::*;

pub fn create_router(data_dir: PathBuf) -> Router {
    let state = SyncState::new(data_dir);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    routes::router()
        .layer(cors)
        .layer(DefaultBodyLimit::disable())
        .with_state(state)
}
