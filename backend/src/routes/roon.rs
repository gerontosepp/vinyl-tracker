use crate::{
    auth::CurrentUser,
    error::AppError,
    models::roon::{RoonPlayRequestDto, RoonPlayResponseDto, RoonSettingsDto},
    state::AppState,
};
use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};

pub async fn get_status_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let status = state.roon.get_status(&state.pool, &user).await;
    Ok((StatusCode::OK, Json(status)))
}

pub async fn get_zones_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let zones = state.roon.get_zones(&state.pool, &user).await;
    Ok((StatusCode::OK, Json(zones)))
}

pub async fn update_settings_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(settings): Json<RoonSettingsDto>,
) -> Result<impl IntoResponse, AppError> {
    let status = state
        .roon
        .update_settings(&state.pool, &user, settings)
        .await?;
    Ok((StatusCode::OK, Json(status)))
}

pub async fn play_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(request): Json<RoonPlayRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    if request.artist.trim().is_empty() {
        return Err(AppError::BadRequest("Artist must not be blank".to_string()));
    }
    if request.title.trim().is_empty() {
        return Err(AppError::BadRequest("Title must not be blank".to_string()));
    }

    let success = state.roon.play_album(&state.pool, &user, request).await?;
    Ok((
        StatusCode::OK,
        Json(RoonPlayResponseDto {
            success,
            message: "Playback command sent to Roon Core".to_string(),
        }),
    ))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/status", get(get_status_handler))
        .route("/zones", get(get_zones_handler))
        .route("/settings", post(update_settings_handler))
        .route("/play", post(play_handler))
}
