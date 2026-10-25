use crate::{
    auth::CurrentUser,
    error::AppError,
    models::record::{
        DiscogsCandidateDto, ManualRecordCreatedDto, ManualRecordRequest, RecordDetailDto,
        TakeoverRequest, TakeoverResultDto, UpdateConditionRequestDto, UpdateSortKeyRequestDto,
    },
    services::{
        manual_record_service::ManualRecordService, manual_takeover_service::ManualTakeoverService,
        record_service::RecordService,
    },
    state::AppState,
};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{StatusCode, header},
    response::IntoResponse,
    routing::{get, patch, post, put},
};
use serde::Deserialize;

/// Upload limit for a raw cover photo (the frontend sends an already downscaled JPEG).
const COVER_BODY_LIMIT: usize = 15 * 1024 * 1024;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/manual", post(create_manual_record))
        .route("/{id}/manual", put(update_manual_record))
        .route("/{id}/discogs-candidates", get(discogs_candidates))
        .route("/{id}/takeover", post(take_over))
        .route(
            "/{id}/cover",
            put(upload_cover).layer(DefaultBodyLimit::max(COVER_BODY_LIMIT)),
        )
        .route("/{id}", get(get_record_details))
        .route("/{id}/listen", post(log_listen))
        .route("/{id}/condition", patch(update_condition))
        .route("/{id}/sort-key", patch(update_sort_key))
}

/// `instance_id` selects the copy when a release is in the collection more than once.
#[derive(Debug, Deserialize)]
struct DetailQuery {
    instance_id: Option<i64>,
}

async fn get_record_details(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Query(query): Query<DetailQuery>,
) -> Result<Json<RecordDetailDto>, AppError> {
    let details = RecordService::get_copy_details(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
        query.instance_id,
    )
    .await?;

    Ok(Json(details))
}

async fn log_listen(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<RecordDetailDto>, AppError> {
    let details =
        RecordService::log_listen(&state.pool, &state.discogs_client, &state.crypto, &user, id)
            .await?;

    Ok(Json(details))
}

async fn update_condition(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateConditionRequestDto>,
) -> Result<Json<RecordDetailDto>, AppError> {
    let details = RecordService::update_condition(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
        req,
    )
    .await?;

    Ok(Json(details))
}

async fn update_sort_key(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateSortKeyRequestDto>,
) -> Result<Json<RecordDetailDto>, AppError> {
    let details = RecordService::update_sort_key(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
        req,
    )
    .await?;

    Ok(Json(details))
}

async fn create_manual_record(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(req): Json<ManualRecordRequest>,
) -> Result<(StatusCode, Json<ManualRecordCreatedDto>), AppError> {
    let created = ManualRecordService::create(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        req,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(created)))
}

async fn update_manual_record(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<ManualRecordRequest>,
) -> Result<Json<RecordDetailDto>, AppError> {
    let details = ManualRecordService::update(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
        req,
    )
    .await?;
    Ok(Json(details))
}

async fn discogs_candidates(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<Vec<DiscogsCandidateDto>>, AppError> {
    let candidates = ManualTakeoverService::candidates(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
    )
    .await?;
    Ok(Json(candidates))
}

async fn take_over(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<TakeoverRequest>,
) -> Result<Json<TakeoverResultDto>, AppError> {
    let result = ManualTakeoverService::take_over(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
        req,
    )
    .await?;
    Ok(Json(result))
}

async fn upload_cover(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    body: Bytes,
) -> Result<Json<RecordDetailDto>, AppError> {
    if body.is_empty() {
        return Err(AppError::BadRequest("Image body is required".to_string()));
    }
    let details = ManualRecordService::set_cover(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
        body,
    )
    .await?;
    Ok(Json(details))
}

/// Cover of a manual record without login: the UUID is not guessable and changes of the cover
/// change the URL (`?v=`), so it can be cached for good.
pub async fn get_cover(
    State(state): State<AppState>,
    Path(uid): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let (image, mime_type) = ManualRecordService::cover(&state.pool, &uid).await?;
    Ok((
        [
            (header::CONTENT_TYPE, mime_type),
            (
                header::CACHE_CONTROL,
                "public, max-age=31536000, immutable".to_string(),
            ),
        ],
        image,
    ))
}
