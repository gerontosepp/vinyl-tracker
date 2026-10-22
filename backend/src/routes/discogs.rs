use crate::{
    auth::CurrentUser, error::AppError, models::discogs::DiscogsSearchFilter, state::AppState,
};
use axum::{
    Json, Router,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct DiscogsSearchQuery {
    pub query: Option<String>,
    pub q: Option<String>,
    pub catno: Option<String>,
    pub label: Option<String>,
    pub artist: Option<String>,
    pub release_title: Option<String>,
    pub year: Option<String>,
    pub country: Option<String>,
    pub format: Option<String>,
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
    let filter = DiscogsSearchFilter {
        query: params.query.or(params.q),
        catno: params.catno,
        label: params.label,
        artist: params.artist,
        release_title: params.release_title,
        year: params.year,
        country: params.country,
        format: params.format,
    };
    if filter.is_empty() {
        return Err(AppError::BadRequest(
            "Search query ('query' or 'q') or at least one filter (catno, label, artist, release_title, year, country, format) is required".to_string(),
        ));
    }

    let enc_token = user.discogs_token.ok_or_else(|| {
        AppError::BadRequest("User does not have a configured Discogs token".to_string())
    })?;

    let token = state
        .crypto
        .decrypt(&enc_token)
        .ok_or_else(|| AppError::Internal("Failed to decrypt user Discogs token".to_string()))?;

    let search_type = params.search_type.as_deref().unwrap_or("release");
    let page = params.page.unwrap_or(1);
    let per_page = params.per_page.unwrap_or(50);

    let search_res = state
        .discogs_client
        .search(&filter, Some(search_type), page, per_page, &token)
        .await?;

    Ok((StatusCode::OK, Json(search_res)))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/search", get(search_handler))
}
