use std::path::PathBuf;

use axum::{Router, routing::post};

mod handlers;
mod state;

pub fn create_router(data_dir: PathBuf) -> Router {
    let state = state::AppState::new(data_dir);

    Router::new()
        .route("/clip", post(handlers::clip_handler))
        .with_state(state)
}
