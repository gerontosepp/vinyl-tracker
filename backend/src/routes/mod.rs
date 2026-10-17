pub mod actuator;
pub mod analytics;
pub mod collection;
pub mod discogs;
pub mod proxy;
pub mod records;
pub mod roon;
pub mod scan;
pub mod users;

use crate::{error::ProblemDetail, state::AppState};
use axum::{
    Json, Router,
    http::{
        HeaderName, HeaderValue, Method, StatusCode,
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    },
    response::IntoResponse,
    routing::get,
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
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
        // User & Auth endpoints (nested under /api/users)
        .nest("/api/users", users::router(&state))
        // Collection endpoints (nested under /api/collection)
        .nest("/api/collection", collection::router())
        // Record details and listen endpoints (nested under /api/records)
        .nest("/api/records", records::router())
        // Barcode and QR code scanning endpoints (nested under /api/scan)
        .nest("/api/scan", scan::router())
        // Discogs search endpoint (nested under /api/discogs)
        .nest("/api/discogs", discogs::router())
        // Image Proxy endpoint (nested under /api/proxy)
        .nest("/api/proxy", proxy::router())
        // Analytics & Dashboard endpoints (nested under /api/analytics)
        .nest("/api/analytics", analytics::router())
        // Roon Audio endpoints (nested under /api/roon)
        .nest("/api/roon", roon::router())
        // API root / ping
        .route("/api/ping", get(|| async { "pong" }))
        .fallback(fallback_handler)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
