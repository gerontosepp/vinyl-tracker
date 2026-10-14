use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use crate::{auth::CurrentUser, error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct DiscogsSearchQuery {
    pub query: Option<String>,
    pub q: Option<String>,
    #[serde(rename = "type")]
    pub search_type: Option<String>,
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

pub async fn search_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<DiscogsSearchQuery>,
) -> Result<impl IntoResponse, AppError> {
    let query_str = params
        .query
        .or(params.q)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| {
            AppError::BadRequest("Search query parameter ('query' or 'q') is required".to_string())
        })?;

    let enc_token = user.discogs_token.ok_or_else(|| {
        AppError::BadRequest("User does not have a configured Discogs token".to_string())
    })?;

    let token = state.crypto.decrypt(&enc_token).ok_or_else(|| {
        AppError::Internal("Failed to decrypt user Discogs token".to_string())
    })?;

    let search_type = params.search_type.as_deref().unwrap_or("release");
    let page = params.page.unwrap_or(1);
    let per_page = params.per_page.unwrap_or(50);

    let search_res = state
        .discogs_client
        .search(&query_str, Some(search_type), page, per_page, &token)
        .await?;

    Ok((StatusCode::OK, Json(search_res)))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/search", get(search_handler))
}
