use crate::{
    auth::CurrentUser, error::AppError, models::want_to_have::AddWantToHaveRequestDto,
    services::want_to_have_service::WantToHaveService, state::AppState,
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
};

pub async fn list_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let items = WantToHaveService::list(&state.pool, user.id).await?;
    Ok((StatusCode::OK, Json(items)))
}

pub async fn add_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(request): Json<AddWantToHaveRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let item = WantToHaveService::add(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        request.discogs_id,
    )
    .await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn remove_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    WantToHaveService::remove(&state.pool, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn to_collection_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    let result = WantToHaveService::to_collection(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        id,
    )
    .await?;
    Ok((StatusCode::OK, Json(result)))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_handler).post(add_handler))
        .route("/{id}", delete(remove_handler))
        .route("/{id}/to-collection", post(to_collection_handler))
}
