use crate::{
    auth::{CurrentUser, client_ip::resolve_client_ip},
    config::Config,
    error::AppError,
    models::{
        label_photo::{OpenRouterSettingsDto, UpdateOpenRouterSettingsRequest},
        user::{
            LoginRequestDto, RegisterRequestDto, ResetPasswordRequestDto, UpdateDiscogsRequestDto,
        },
    },
    services::{openrouter_settings_service::OpenRouterSettingsService, user_service::UserService},
    state::AppState,
};
use axum::{
    Json, Router,
    extract::{ConnectInfo, Extension, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use std::net::{IpAddr, SocketAddr};

pub fn make_auth_cookie(config: &Config, token: &str) -> HeaderValue {
    let mut parts = vec![
        format!("{}={}", config.auth_cookie_name, token),
        format!("Path={}", config.auth_cookie_path),
        format!("Max-Age={}", config.auth_cookie_max_age_secs),
        "HttpOnly".to_string(),
        format!("SameSite={}", config.auth_cookie_same_site),
    ];
    if config.auth_cookie_secure {
        parts.push("Secure".to_string());
    }
    if let Some(domain) = &config.auth_cookie_domain {
        parts.push(format!("Domain={domain}"));
    }
    let cookie_str = parts.join("; ");
    HeaderValue::from_str(&cookie_str).unwrap_or_else(|_| {
        HeaderValue::from_str(&format!("{}=; Path=/; Max-Age=0", config.auth_cookie_name))
            .unwrap_or_else(|_| HeaderValue::from_static("token=; Path=/; Max-Age=0"))
    })
}

pub fn make_clearing_cookie(config: &Config) -> HeaderValue {
    let mut parts = vec![
        format!("{}=deleted", config.auth_cookie_name),
        format!("Path={}", config.auth_cookie_path),
        "Max-Age=0".to_string(),
        "HttpOnly".to_string(),
        format!("SameSite={}", config.auth_cookie_same_site),
    ];
    if config.auth_cookie_secure {
        parts.push("Secure".to_string());
    }
    if let Some(domain) = &config.auth_cookie_domain {
        parts.push(format!("Domain={domain}"));
    }
    let cookie_str = parts.join("; ");
    HeaderValue::from_str(&cookie_str).unwrap_or_else(|_| {
        HeaderValue::from_str(&format!("{}=; Path=/; Max-Age=0", config.auth_cookie_name))
            .unwrap_or_else(|_| HeaderValue::from_static("token=; Path=/; Max-Age=0"))
    })
}

/// Originating client IP, resolved by [`auth_rate_limit_middleware`] for the auth handlers' logs.
#[derive(Clone, Copy)]
pub struct ClientIp(pub IpAddr);

/// Warns about a rejected credential check (wrong credentials or unknown user); other errors log
/// themselves. The username is client-controlled and therefore logged Debug-escaped.
fn log_auth_failure(action: &str, username: &str, client_ip: IpAddr, err: &AppError) {
    if matches!(
        err,
        AppError::Unauthorized(_) | AppError::Forbidden(_) | AppError::NotFound(_)
    ) {
        tracing::warn!("Failed {action} for user {username:?} from {client_ip}");
    }
}

pub async fn auth_rate_limit_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|info| info.0.ip());
    let client_ip = resolve_client_ip(peer, request.headers(), &state.config.trusted_proxies);

    if state.auth_rate_limiter.check_key(&client_ip).is_err() {
        tracing::warn!(
            "Auth rate limit exceeded for {client_ip} on {}",
            request.uri().path()
        );
        return Err(AppError::TooManyRequests(
            "Rate limit exceeded for authentication attempts. Please try again later.".to_string(),
        ));
    }

    request.extensions_mut().insert(ClientIp(client_ip));
    Ok(next.run(request).await)
}

pub async fn register_handler(
    State(state): State<AppState>,
    Extension(ClientIp(client_ip)): Extension<ClientIp>,
    Json(payload): Json<RegisterRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let username = payload.username.trim().to_string();
    let dto = UserService::register(&state.pool, &state.config, payload).await?;
    tracing::info!("Registered user {username:?} from {client_ip}");

    let mut headers = HeaderMap::new();
    if let Some(token) = &dto.token {
        headers.insert(header::SET_COOKIE, make_auth_cookie(&state.config, token));
    }

    Ok((StatusCode::OK, headers, Json(dto)))
}

pub async fn login_handler(
    State(state): State<AppState>,
    Extension(ClientIp(client_ip)): Extension<ClientIp>,
    Json(payload): Json<LoginRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let username = payload.username.trim().to_string();
    let dto = UserService::login(&state.pool, &state.config, payload)
        .await
        .inspect_err(|e| log_auth_failure("login", &username, client_ip, e))?;
    tracing::info!("User {username:?} logged in from {client_ip}");

    let mut headers = HeaderMap::new();
    if let Some(token) = &dto.token {
        headers.insert(header::SET_COOKIE, make_auth_cookie(&state.config, token));
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

pub async fn get_openrouter_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> Result<Json<OpenRouterSettingsDto>, AppError> {
    Ok(Json(
        OpenRouterSettingsService::get(&state.pool, &state.crypto, user.id).await?,
    ))
}

pub async fn update_openrouter_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(payload): Json<UpdateOpenRouterSettingsRequest>,
) -> Result<Json<OpenRouterSettingsDto>, AppError> {
    Ok(Json(
        OpenRouterSettingsService::update(&state.pool, &state.crypto, user.id, payload).await?,
    ))
}

pub async fn reset_password_handler(
    State(state): State<AppState>,
    Extension(ClientIp(client_ip)): Extension<ClientIp>,
    Json(payload): Json<ResetPasswordRequestDto>,
) -> Result<impl IntoResponse, AppError> {
    let username = payload.username.trim().to_string();
    let dto = UserService::reset_password(&state.pool, &state.config, &state.crypto, payload)
        .await
        .inspect_err(|e| log_auth_failure("password reset", &username, client_ip, e))?;
    tracing::info!("Password of user {username:?} reset from {client_ip}");

    let mut headers = HeaderMap::new();
    if let Some(token) = &dto.token {
        headers.insert(header::SET_COOKIE, make_auth_cookie(&state.config, token));
    }

    Ok((StatusCode::OK, headers, Json(dto)))
}

pub async fn logout_handler(State(state): State<AppState>) -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(header::SET_COOKIE, make_clearing_cookie(&state.config));
    (
        StatusCode::OK,
        headers,
        Json(serde_json::json!({"status": "SUCCESS"})),
    )
}

pub fn router(state: &AppState) -> Router<AppState> {
    let rate_limited_routes = Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route("/reset-password", post(reset_password_handler))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_rate_limit_middleware,
        ));

    Router::new()
        .merge(rate_limited_routes)
        .route("/me", get(get_me_handler))
        .route("/me/discogs", put(update_discogs_handler))
        .route(
            "/me/openrouter",
            get(get_openrouter_handler).put(update_openrouter_handler),
        )
        .route("/logout", post(logout_handler))
}
