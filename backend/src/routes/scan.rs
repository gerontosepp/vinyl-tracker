use crate::{
    auth::CurrentUser,
    error::AppError,
    models::scan::{ResetResultDto, ScanRequest},
    services::scan_service::ScanService,
    state::AppState,
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, post},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(scan_barcode))
        .route("/{id}", delete(delete_scan))
        .route("/all", delete(reset_all_listens))
}

async fn scan_barcode(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(req): Json<ScanRequest>,
) -> Result<impl IntoResponse, AppError> {
    let result = ScanService::process_scan(
        &state.pool,
        &state.discogs_client,
        &state.crypto,
        &user,
        &req.barcode,
    )
    .await?;

    let status = if result.success
        || result
            .discogs_matches
            .as_ref()
            .map(|m| !m.is_empty())
            .unwrap_or(false)
    {
        StatusCode::OK
    } else {
        StatusCode::BAD_REQUEST
    };

    Ok((status, Json(result)))
}

async fn delete_scan(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    ScanService::delete_scan(&state.pool, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn reset_all_listens(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<Json<ResetResultDto>, AppError> {
    let result = ScanService::reset_all_listens(&state.pool, user.id).await?;
    Ok(Json(result))
}
