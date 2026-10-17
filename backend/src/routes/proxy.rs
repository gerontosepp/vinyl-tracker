use crate::{error::AppError, state::AppState};
use axum::{
    Router,
    extract::{Query, State},
    http::{StatusCode, header},
    response::IntoResponse,
    routing::get,
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct ProxyImageQuery {
    pub url: Option<String>,
}

pub async fn proxy_image_handler(
    State(state): State<AppState>,
    Query(params): Query<ProxyImageQuery>,
) -> Result<impl IntoResponse, AppError> {
    let raw_url = params.url.ok_or_else(|| {
        AppError::BadRequest("Missing required 'url' query parameter".to_string())
    })?;

    let (content_type, bytes) =
        state
            .image_proxy
            .proxy_image(&raw_url)
            .await
            .map_err(|e| match e {
                AppError::BadRequest(msg) => AppError::BadRequest(msg),
                _ => AppError::Internal(format!("Failed to proxy image: {e}")),
            })?;

    let headers = [
        (header::CONTENT_TYPE, content_type),
        (
            header::CACHE_CONTROL,
            header::HeaderValue::from_static("public, max-age=86400"),
        ),
    ];

    Ok((StatusCode::OK, headers, bytes))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/image", get(proxy_image_handler))
}
