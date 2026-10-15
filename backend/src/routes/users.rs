use crate::{
    auth::CurrentUser,
    error::AppError,
    models::user::{
        LoginRequestDto, RegisterRequestDto, ResetPasswordRequestDto, UpdateDiscogsRequestDto,
    },
    services::user_service::UserService,
    state::AppState,
};
use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::IntoResponse,
    routing::{get, post, put},
};

fn make_auth_cookie(token: &str) -> HeaderValue {
    HeaderValue::from_str(&format!(
        "vinyl_token={token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax"
    ))
    .unwrap_or_else(|_| HeaderValue::from_static("vinyl_token=; Path=/; Max-Age=0"))
}

fn make_clearing_cookie() -> HeaderValue {
    HeaderValue::from_static("vinyl_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let dto = UserService::register(&state.pool, &state.config, payload).await?;

    let mut headers = HeaderMap::new();
    if let Some(token) = &dto.token {
        headers.insert(header::SET_COOKIE, make_auth_cookie(token));
    }

    Ok((StatusCode::OK, headers, Json(dto)))
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let dto = UserService::login(&state.pool, &state.config, payload).await?;

    let mut headers = HeaderMap::new();
    if let Some(token) = &dto.token {
        headers.insert(header::SET_COOKIE, make_auth_cookie(token));
    }

    Ok((StatusCode::OK, headers, Json(dto)))
}

pub async fn get_me_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<impl IntoResponse, AppError> {
    let dto = UserService::get_user(&state.pool, &user.username).await?;
    Ok((StatusCode::OK, Json(dto)))
}

pub async fn update_discogs_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(payload): Json<UpdateDiscogsRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let dto =
        UserService::update_discogs(&state.pool, &state.crypto, &user.username, payload).await?;
    Ok((StatusCode::OK, Json(dto)))
}

pub async fn reset_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let dto =
        UserService::reset_password(&state.pool, &state.config, &state.crypto, payload).await?;

    let mut headers = HeaderMap::new();
    if let Some(token) = &dto.token {
        headers.insert(header::SET_COOKIE, make_auth_cookie(token));
    }

    Ok((StatusCode::OK, headers, Json(dto)))
}

pub async fn logout_handler() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, make_clearing_cookie());
    (
        StatusCode::OK,
        headers,
        Json(serde_json::json!({"status": "SUCCESS"})),
    )
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/me", get(get_me_handler))
        .route("/me/discogs", put(update_discogs_handler))
        .route("/reset-password", post(reset_password_handler))
        .route("/logout", post(logout_handler))
}
