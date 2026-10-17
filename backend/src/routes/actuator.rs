use crate::error::AppError;
use crate::state::AppState;
use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::get};
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database: Option<&'static str>,
}

#[derive(Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub description: &'static str,
    pub version: &'static str,
}

#[derive(Serialize)]
pub struct InfoResponse {
    pub app: AppInfo,
}

pub async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    // Quick DB check to confirm database is operational
    let db_ok = sqlx::query("SELECT 1").execute(&state.pool).await.is_ok();

    if db_ok {
        (
            StatusCode::OK,
            Json(HealthResponse {
                status: "UP",
                database: Some("UP"),
            }),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(HealthResponse {
                status: "DOWN",
                database: Some("DOWN"),
            }),
        )
    }
}

pub async fn info_handler() -> impl IntoResponse {
    let response = InfoResponse {
        app: AppInfo {
            name: "vinyl-tracker",
            description: "Vinyl Tracker Backend (High-Performance Rust Edition)",
            version: env!("CARGO_PKG_VERSION"),
        },
    };
    (StatusCode::OK, Json(response))
}

pub async fn restricted_handler() -> Result<(), AppError> {
    Err(AppError::Forbidden(
        "Actuator endpoint is restricted.".to_string(),
    ))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_handler))
        .route("/info", get(info_handler))
        .route("/metrics", get(restricted_handler))
        .route("/env", get(restricted_handler))
        .route("/configprops", get(restricted_handler))
}
