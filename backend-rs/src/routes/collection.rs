use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use crate::{
    auth::CurrentUser,
    error::AppError,
    models::collection::{CollectionQueryParams, ParsedCollectionFilter},
    services::{
        collection_query::CollectionQueryService,
        collection_sync::CollectionSyncService,
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct RandomQueryParams {
    pub genre: Option<String>,
    pub unplayed_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UnplayedQueryParams {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct PriceRefreshQueryParams {
    #[serde(rename = "onlyMissing")]
    pub only_missing_camel: Option<bool>,
    pub only_missing: Option<bool>,
}

pub async fn get_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<CollectionQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let filter = ParsedCollectionFilter::from(params);
    let res = CollectionQueryService::get_collection(&state.pool, user.id, filter).await?;
    Ok((StatusCode::OK, Json(res)))
}

pub async fn get_random_record_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<RandomQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let unplayed = params.unplayed_only.unwrap_or(false);
    let record_opt = CollectionQueryService::get_random_record(
        &state.pool,
        user.id,
        params.genre.as_deref(),
        unplayed,
    )
    .await?;

    match record_opt {
        Some(release) => Ok((StatusCode::OK, Json(release))),
        None => Err(AppError::NotFound("No records found matching the specified criteria".to_string())),
    }
}

pub async fn get_unplayed_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<UnplayedQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 100);

    let res = CollectionQueryService::get_unplayed_collection(&state.pool, user.id, page, per_page).await?;
    Ok((StatusCode::OK, Json(res)))
}

pub async fn sync_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let sync_res = CollectionSyncService::sync_collection(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
    )
    .await?;

    Ok((StatusCode::OK, Json(sync_res)))
}

pub async fn add_release_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(release_id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    let sync_res = CollectionSyncService::add_release_and_sync(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        release_id,
    )
    .await?;

    Ok((StatusCode::OK, Json(sync_res)))
}

pub async fn refresh_prices_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<PriceRefreshQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let only_missing = params
        .only_missing
        .or(params.only_missing_camel)
        .unwrap_or(true);

    let res = CollectionSyncService::refresh_collection_prices(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        only_missing,
    )
    .await?;

    Ok((StatusCode::OK, Json(res)))
}

pub async fn generate_selected_qr_codes_handler(
    _user: CurrentUser,
    Json(request): Json<crate::models::analytics::QrCodeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let pdf_bytes = crate::services::qr_pdf_service::QrPdfService::generate_qr_codes_pdf(&request.items)?;
    Ok((
        StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "application/pdf"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=collection_qr_codes.pdf"),
        ],
        pdf_bytes,
    ))
}

pub async fn generate_all_qr_codes_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let pdf_bytes = crate::services::qr_pdf_service::QrPdfService::generate_all_qr_codes_pdf(&state.pool, user.id).await?;
    Ok((
        StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "application/pdf"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=collection_qr_codes.pdf"),
        ],
        pdf_bytes,
    ))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_collection_handler))
        .route("/random", get(get_random_record_handler))
        .route("/unplayed", get(get_unplayed_collection_handler))
        .route("/sync", post(sync_collection_handler))
        .route("/releases/{release_id}", post(add_release_handler))
        .route("/prices/refresh", post(refresh_prices_handler))
        .route("/qr-codes/selected", post(generate_selected_qr_codes_handler))
        .route("/qr-codes/all", get(generate_all_qr_codes_handler))
}
