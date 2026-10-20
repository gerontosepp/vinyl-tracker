use crate::{
    auth::CurrentUser,
    error::AppError,
    models::collection::{CollectionQueryParams, ParsedCollectionFilter},
    services::{
        collection_query::CollectionQueryService, collection_restore::CollectionRestoreService,
        collection_sync::CollectionSyncService, export_service::ExportService,
    },
    state::AppState,
};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RemoveReleaseQueryParams {
    #[serde(rename = "instanceId")]
    pub instance_id_camel: Option<i64>,
    pub instance_id: Option<i64>,
}

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

#[derive(Debug, Deserialize)]
pub struct CollectionExportQueryParams {
    pub format: Option<String>,
    #[serde(flatten)]
    pub filter: CollectionQueryParams,
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
        None => Err(AppError::NotFound(
            "No records found matching the specified criteria".to_string(),
        )),
    }
}

pub async fn get_unplayed_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<UnplayedQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 100);

    let res = CollectionQueryService::get_unplayed_collection(&state.pool, user.id, page, per_page)
        .await?;
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

pub async fn remove_release_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(release_id): Path<i64>,
    Query(params): Query<RemoveReleaseQueryParams>,
) -> Result<StatusCode, AppError> {
    let instance_id = params.instance_id.or(params.instance_id_camel);
    CollectionSyncService::remove_release(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        release_id,
        instance_id,
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
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
    let pdf_bytes =
        crate::services::qr_pdf_service::QrPdfService::generate_qr_codes_pdf(&request.items)?;
    Ok((
        StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "application/pdf"),
            (
                axum::http::header::CONTENT_DISPOSITION,
                "attachment; filename=collection_qr_codes.pdf",
            ),
        ],
        pdf_bytes,
    ))
}

pub async fn generate_all_qr_codes_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let pdf_bytes = crate::services::qr_pdf_service::QrPdfService::generate_all_qr_codes_pdf(
        &state.pool,
        user.id,
    )
    .await?;
    Ok((
        StatusCode::OK,
        [
            (axum::http::header::CONTENT_TYPE, "application/pdf"),
            (
                axum::http::header::CONTENT_DISPOSITION,
                "attachment; filename=collection_qr_codes.pdf",
            ),
        ],
        pdf_bytes,
    ))
}

pub async fn export_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(params): Query<CollectionExportQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let format_str = params.format.as_deref().unwrap_or("").trim().to_lowercase();
    let filter = ParsedCollectionFilter::from(params.filter);
    let releases =
        CollectionQueryService::get_collection_for_export(&state.pool, user.id, filter).await?;

    match format_str.as_str() {
        "csv" => {
            let csv_bytes = ExportService::export_collection_csv(&releases)?;
            Ok((
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "attachment; filename=\"vinyl_collection_export.csv\"",
                    ),
                ],
                csv_bytes,
            ))
        }
        "json" => {
            let discogs_ids: Vec<i64> = releases.iter().map(|r| r.id).collect();
            let listen_history =
                CollectionQueryService::get_listen_history(&state.pool, user.id, &discogs_ids)
                    .await?;
            let json_bytes =
                ExportService::export_collection_json(&user.username, &releases, &listen_history)?;
            Ok((
                StatusCode::OK,
                [
                    (
                        axum::http::header::CONTENT_TYPE,
                        "application/json; charset=utf-8",
                    ),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "attachment; filename=\"vinyl_collection_backup.json\"",
                    ),
                ],
                json_bytes,
            ))
        }
        "pdf" => {
            let pdf_bytes = ExportService::export_collection_pdf(
                &user.username,
                &releases,
                Some(&state.image_proxy),
            )
            .await?;
            Ok((
                StatusCode::OK,
                [
                    (axum::http::header::CONTENT_TYPE, "application/pdf"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "attachment; filename=\"vinyl_collection_catalog.pdf\"",
                    ),
                ],
                pdf_bytes,
            ))
        }
        _ => Err(AppError::BadRequest(
            "Unsupported or missing export format. Supported formats: csv, json, pdf".to_string(),
        )),
    }
}

/// JSON backups of large collections exceed Axum's default body limit of 2 MB.
const RESTORE_BODY_LIMIT: usize = 25 * 1024 * 1024;

/// Merges a JSON backup (from `/export?format=json`) into the user's collection.
pub async fn restore_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    body: Bytes,
) -> Result<impl IntoResponse, AppError> {
    let (backup, releases) = CollectionRestoreService::parse_backup(&body)?;
    let result =
        CollectionRestoreService::restore(&state.pool, user.id, &backup, &releases).await?;
    Ok((StatusCode::OK, Json(result)))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_collection_handler))
        .route("/export", get(export_collection_handler))
        .route(
            "/restore",
            post(restore_collection_handler).layer(DefaultBodyLimit::max(RESTORE_BODY_LIMIT)),
        )
        .route("/random", get(get_random_record_handler))
        .route("/unplayed", get(get_unplayed_collection_handler))
        .route("/sync", post(sync_collection_handler))
        .route(
            "/releases/{release_id}",
            post(add_release_handler).delete(remove_release_handler),
        )
        .route("/prices/refresh", post(refresh_prices_handler))
        .route(
            "/qr-codes/selected",
            post(generate_selected_qr_codes_handler),
        )
        .route("/qr-codes/all", get(generate_all_qr_codes_handler))
}
