use crate::{
    auth::CurrentUser,
    error::AppError,
    models::storage::{
        CreateStorageTypeRequest, RedistributePreviewDto, RedistributeRequest,
        ReorderStorageUnitsRequest, StorageLayoutDto, StorageMedia, StoragePlacementDto,
        StorageTypeDto, StorageTypesDto, StorageUnitDto, StorageUnitRequest, StorageUnitsDto,
        UpdateStorageTypeRequest,
    },
    services::storage::{StorageService, config::StorageConfigService},
    state::AppState,
};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
};
use serde::Deserialize;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/types", get(list_types).post(create_type))
        .route("/types/{id}", put(update_type).delete(delete_type))
        .route("/units", get(list_units).post(create_unit))
        .route("/units/order", put(reorder_units))
        .route("/units/{id}", put(update_unit).delete(delete_unit))
        .route("/layout", get(layout))
        .route("/redistribute/preview", get(preview_redistribution))
        .route("/redistribute", post(redistribute))
        .route("/placement/{discogs_id}", get(placement))
}

async fn list_types(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<Json<Vec<StorageTypeDto>>, AppError> {
    Ok(Json(
        StorageConfigService::list_types(&state.pool, user.id).await?,
    ))
}

async fn create_type(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(req): Json<CreateStorageTypeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let result = StorageConfigService::create_type(&state.pool, user.id, req).await?;
    Ok((StatusCode::CREATED, Json(result)))
}

async fn update_type(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateStorageTypeRequest>,
) -> Result<Json<StorageTypesDto>, AppError> {
    Ok(Json(
        StorageConfigService::update_type(&state.pool, user.id, id, req).await?,
    ))
}

async fn delete_type(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<StorageTypesDto>, AppError> {
    Ok(Json(
        StorageConfigService::delete_type(&state.pool, user.id, id).await?,
    ))
}

async fn list_units(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<Json<Vec<StorageUnitDto>>, AppError> {
    Ok(Json(
        StorageConfigService::list_units(&state.pool, user.id).await?,
    ))
}

async fn create_unit(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(req): Json<StorageUnitRequest>,
) -> Result<impl IntoResponse, AppError> {
    let result = StorageConfigService::create_unit(&state.pool, user.id, req).await?;
    Ok((StatusCode::CREATED, Json(result)))
}

async fn update_unit(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<StorageUnitRequest>,
) -> Result<Json<StorageUnitsDto>, AppError> {
    Ok(Json(
        StorageConfigService::update_unit(&state.pool, user.id, id, req).await?,
    ))
}

async fn delete_unit(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<Json<StorageUnitsDto>, AppError> {
    Ok(Json(
        StorageConfigService::delete_unit(&state.pool, user.id, id).await?,
    ))
}

async fn reorder_units(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(req): Json<ReorderStorageUnitsRequest>,
) -> Result<Json<StorageUnitsDto>, AppError> {
    Ok(Json(
        StorageConfigService::reorder_units(&state.pool, user.id, req).await?,
    ))
}

async fn layout(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<Json<StorageLayoutDto>, AppError> {
    Ok(Json(
        StorageService::layout_overview(&state.pool, user.id).await?,
    ))
}

#[derive(Debug, Deserialize)]
struct MediaQuery {
    media: String,
}

fn parse_media(value: &str) -> Result<StorageMedia, AppError> {
    StorageMedia::parse(value)
        .ok_or_else(|| AppError::BadRequest("media must be 'vinyl' or 'cd'".to_string()))
}

async fn preview_redistribution(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(query): Query<MediaQuery>,
) -> Result<Json<RedistributePreviewDto>, AppError> {
    let media = parse_media(&query.media)?;
    Ok(Json(
        StorageService::preview_redistribution(&state.pool, user.id, media).await?,
    ))
}

async fn redistribute(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(req): Json<RedistributeRequest>,
) -> Result<Json<StorageLayoutDto>, AppError> {
    StorageService::redistribute(&state.pool, user.id, req.media).await?;
    Ok(Json(
        StorageService::layout_overview(&state.pool, user.id).await?,
    ))
}

/// Slot and neighbors of a record; 204 when no shelf exists for its medium.
async fn placement(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(discogs_id): Path<i64>,
) -> Result<axum::response::Response, AppError> {
    let placement: Option<StoragePlacementDto> =
        StorageService::placement_for_record(&state.pool, user.id, discogs_id).await?;
    Ok(match placement {
        Some(placement) => Json(placement).into_response(),
        None => StatusCode::NO_CONTENT.into_response(),
    })
}
