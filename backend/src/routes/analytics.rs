use axum::{
    extract::{Query, State},
    http::{header::CACHE_CONTROL, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use crate::{
    auth::CurrentUser,
    error::AppError,
    models::analytics::DateRangeParams,
    services::analytics_service::AnalyticsService,
    state::AppState,
};

pub async fn get_recent_listens_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<DateRangeParams>,
) -> Result<impl IntoResponse, AppError> {
    let events = AnalyticsService::get_recent_listens(
        &state.pool,
        user.id,
        params.from.as_deref(),
        params.to.as_deref(),
    )
    .await?;

    Ok((
        StatusCode::OK,
        [(CACHE_CONTROL, "no-cache, no-store, must-revalidate")],
        Json(events),
    ))
}

pub async fn get_top_records_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<DateRangeParams>,
) -> Result<impl IntoResponse, AppError> {
    let top = AnalyticsService::get_top_records(
        &state.pool,
        user.id,
        params.from.as_deref(),
        params.to.as_deref(),
    )
    .await?;

    Ok((
        StatusCode::OK,
        [(CACHE_CONTROL, "no-cache, no-store, must-revalidate")],
        Json(top),
    ))
}

pub async fn get_collection_value_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let value = AnalyticsService::get_collection_value(
        &state.discogs_client,
        &state.crypto,
        &user,
    )
    .await?;

    Ok((
        StatusCode::OK,
        [(CACHE_CONTROL, "no-cache, no-store, must-revalidate")],
        Json(value),
    ))
}

pub async fn get_genre_breakdown_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let genres = AnalyticsService::get_genre_breakdown(&state.pool, user.id).await?;

    Ok((
        StatusCode::OK,
        [(CACHE_CONTROL, "no-cache, no-store, must-revalidate")],
        Json(genres),
    ))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/recent", get(get_recent_listens_handler))
        .route("/top", get(get_top_records_handler))
        .route("/collection/value", get(get_collection_value_handler))
        .route("/collection/genres", get(get_genre_breakdown_handler))
}
