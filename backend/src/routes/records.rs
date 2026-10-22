use crate::{
    auth::CurrentUser,
    error::AppError,
    models::record::{RecordDetailDto, UpdateConditionRequestDto, UpdateSortKeyRequestDto},
    services::record_service::RecordService,
    state::AppState,
};
use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, patch, post},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{id}", get(get_record_details))
        .route("/{id}/listen", post(log_listen))
        .route("/{id}/condition", patch(update_condition))
        .route("/{id}/sort-key", patch(update_sort_key))
}

async fn get_record_details(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<RecordDetailDto>, AppError> {
    let details = RecordService::get_record_details(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
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
