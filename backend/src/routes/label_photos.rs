use crate::{
    auth::CurrentUser,
    error::AppError,
    models::label_photo::{
        LabelPhotoDeleteDto, LabelPhotoDto, LabelPhotoStatus, LabelPhotoUploadDto, LabelPhotosDto,
        UpdateLabelPhotoRequest,
    },
    services::{
        label_identification_service::LabelIdentificationService,
        label_photo_service::LabelPhotoService,
        openrouter_settings_service::OpenRouterSettingsService,
    },
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
                .delete(delete_photos)
                .layer(DefaultBodyLimit::max(UPLOAD_BODY_LIMIT)),
        )
        .route(
            "/{id}",
            axum::routing::patch(update_photo).delete(delete_photo),
        )
        .route("/{id}/image", get(photo_image))
        .route("/{id}/identify", axum::routing::post(identify_photo))
}

#[derive(Deserialize)]
struct StatusQuery {
    status: Option<String>,
}

fn parse_status(status: Option<&str>) -> Result<Option<LabelPhotoStatus>, AppError> {
    status
        .map(|s| {
            LabelPhotoStatus::parse(s)
                .ok_or_else(|| AppError::BadRequest(format!("Unknown label photo status '{s}'")))
        })
        .transpose()
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
    let identify = has_openrouter_key(&state, user.id).await?;
    let created = LabelPhotoService::create(&state.pool, user.id, body, identify).await?;
    if identify {
        LabelIdentificationService::spawn(&state, &user, created.id);
    }
    Ok((StatusCode::CREATED, Json(created)))
}

async fn has_openrouter_key(state: &AppState, user_id: i64) -> Result<bool, AppError> {
    Ok(
        OpenRouterSettingsService::credentials(&state.pool, &state.crypto, user_id)
            .await?
            .is_some(),
    )
}

/// Queues an open photo (again) for the automatic identification.
async fn identify_photo(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<(StatusCode, Json<LabelPhotoDto>), AppError> {
    if !has_openrouter_key(&state, user.id).await? {
        return Err(AppError::BadRequest(
            "Configure an OpenRouter API key in the settings first".to_string(),
        ));
    }
    let photo = LabelPhotoService::queue_identification(&state.pool, user.id, id).await?;
    LabelIdentificationService::spawn(&state, &user, id);
    Ok((StatusCode::ACCEPTED, Json(photo)))
}

async fn list_photos(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<LabelPhotosDto>, AppError> {
    let status = parse_status(query.status.as_deref())?;
    let limit = query.limit.unwrap_or(50).clamp(1, MAX_LIST_LIMIT);
    Ok(Json(
        LabelPhotoService::list(&state.pool, user.id, status, limit).await?,
    ))
}

/// Deletes all photos of the user, or only those with `?status=`.
async fn delete_photos(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Query(query): Query<StatusQuery>,
) -> Result<Json<LabelPhotoDeleteDto>, AppError> {
    let status = parse_status(query.status.as_deref())?;
    Ok(Json(
        LabelPhotoService::delete_all(&state.pool, user.id, status).await?,
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
