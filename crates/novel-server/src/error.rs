use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NovelError {
    #[error("Not found")]
    NotFound,
    #[error("Database error: {0}")]
    Sled(#[from] sled::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Multipart error: {0}")]
    Multipart(#[from] axum::extract::multipart::MultipartError),
    #[error("Bad request: {0}")]
    BadRequest(String),
}

impl IntoResponse for NovelError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            NovelError::NotFound => (StatusCode::NOT_FOUND, "Not Found"),
            NovelError::Sled(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database Error"),
            NovelError::Serde(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Serialization Error"),
            NovelError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "IO Error"),
            NovelError::Multipart(_) => (StatusCode::BAD_REQUEST, "Multipart Error"),
            NovelError::BadRequest(ref msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}
