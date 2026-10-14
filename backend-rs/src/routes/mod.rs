pub mod actuator;

use axum::{
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
        HeaderName, HeaderValue, Method, StatusCode,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use crate::{
    error::ProblemDetail,
    state::AppState,
};

async fn fallback_handler(uri: axum::http::Uri) -> impl IntoResponse {
    let problem = ProblemDetail::new(
        StatusCode::NOT_FOUND,
        "Not Found",
        format!("The requested endpoint '{}' was not found.", uri.path()),
    )
    .with_instance(uri.path());

    (StatusCode::NOT_FOUND, Json(problem))
}

pub fn create_app(state: AppState) -> Router {
    // 1. CORS Configuration
    let mut cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers([
            AUTHORIZATION,
            CONTENT_TYPE,
            ACCEPT,
            HeaderName::from_static("x-requested-with"),
        ]);

    if state.config.cors_allow_credentials {
        cors = cors.allow_credentials(true);
    }

    if state.config.cors_allowed_origins.iter().any(|o| o == "*") {
        cors = cors.allow_origin(tower_http::cors::Any);
    } else {
        let origins: Vec<HeaderValue> = state
            .config
            .cors_allowed_origins
            .iter()
            .filter_map(|o| o.parse::<HeaderValue>().ok())
            .collect();
        cors = cors.allow_origin(AllowOrigin::list(origins));
    }

    // 2. Build Router
    Router::new()
        // Actuator endpoints (nested under /actuator)
        .nest("/actuator", actuator::router())
        // API root / ping
        .route("/api/ping", get(|| async { "pong" }))
        .fallback(fallback_handler)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
