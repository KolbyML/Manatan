use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LnError {
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

impl IntoResponse for LnError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            LnError::NotFound => (StatusCode::NOT_FOUND, "Not Found"),
            LnError::Sled(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database Error"),
            LnError::Serde(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Serialization Error"),
            LnError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "IO Error"),
            LnError::Multipart(_) => (StatusCode::BAD_REQUEST, "Multipart Error"),
            LnError::BadRequest(ref msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}
