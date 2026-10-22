use crate::{
    auth::CurrentUser,
    error::AppError,
    models::label_photo::{
        LabelPhotoDto, LabelPhotoStatus, LabelPhotoUploadDto, LabelPhotosDto,
        UpdateLabelPhotoRequest,
    },
    services::label_photo_service::LabelPhotoService,
    state::AppState,
};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{StatusCode, header},
    response::IntoResponse,
    routing::get,
};
use serde::Deserialize;

/// Upload limit for a raw label photo (the frontend sends an already downscaled JPEG).
const UPLOAD_BODY_LIMIT: usize = 15 * 1024 * 1024;
const MAX_LIST_LIMIT: i64 = 100;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_photos)
                .post(upload_photo)
                .layer(DefaultBodyLimit::max(UPLOAD_BODY_LIMIT)),
        )
        .route(
            "/{id}",
            axum::routing::patch(update_photo).delete(delete_photo),
        )
        .route("/{id}/image", get(photo_image))
}

#[derive(Deserialize)]
struct ListQuery {
    status: Option<String>,
    limit: Option<i64>,
}

async fn upload_photo(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    body: Bytes,
) -> Result<(StatusCode, Json<LabelPhotoUploadDto>), AppError> {
    if body.is_empty() {
        return Err(AppError::BadRequest("Image body is required".to_string()));
    }
    let created = LabelPhotoService::create(&state.pool, user.id, &body).await?;
    Ok((StatusCode::CREATED, Json(created)))
}

async fn list_photos(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<LabelPhotosDto>, AppError> {
    let status = query
        .status
        .as_deref()
        .map(|s| {
            LabelPhotoStatus::parse(s)
                .ok_or_else(|| AppError::BadRequest(format!("Unknown label photo status '{s}'")))
        })
        .transpose()?;
    let limit = query.limit.unwrap_or(50).clamp(1, MAX_LIST_LIMIT);
    Ok(Json(
        LabelPhotoService::list(&state.pool, user.id, status, limit).await?,
    ))
}

async fn photo_image(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    let (bytes, mime_type) = LabelPhotoService::image(&state.pool, user.id, id).await?;
    Ok((
        [
            (header::CONTENT_TYPE, mime_type),
            (header::CACHE_CONTROL, "private, max-age=86400".to_string()),
        ],
        bytes,
    ))
}

async fn update_photo(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<UpdateLabelPhotoRequest>,
) -> Result<Json<LabelPhotoDto>, AppError> {
    Ok(Json(
        LabelPhotoService::update(&state.pool, user.id, id, req.status, req.discogs_id).await?,
    ))
}

async fn delete_photo(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    LabelPhotoService::delete(&state.pool, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
