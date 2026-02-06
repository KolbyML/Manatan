use axum::Router;
use crate::state::SyncState;

mod auth;
mod config;
mod sync;

pub fn router() -> Router<SyncState> {
    Router::new()
        .nest("/auth", auth::router())
        .nest("/config", config::router())
        .merge(sync::router())
}
