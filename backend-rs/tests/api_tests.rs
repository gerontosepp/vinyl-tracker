use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt;
use backend_rs::{
    config::Config,
    db::init_pool,
    routes::create_app,
    state::AppState,
};

async fn setup_app() -> axum::Router {
    dotenvy::dotenv().ok();
    let config = Config::from_env();
    let pool = init_pool(&config)
        .await
        .expect("PostgreSQL must be accessible for integration tests");
    let state = AppState::new(pool, config);
    create_app(state)
}

#[tokio::test]
async fn test_health_endpoint_returns_up() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/actuator/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "UP");
    assert_eq!(json["database"], "UP");
}

#[tokio::test]
async fn test_info_endpoint_returns_version_info() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/actuator/info")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["app"]["name"], "vinyl-tracker");
    assert!(json["app"]["version"].is_string());
}

#[tokio::test]
async fn test_restricted_actuator_endpoints_return_forbidden() {
    let app = setup_app().await;

    for endpoint in ["/actuator/metrics", "/actuator/env", "/actuator/configprops"] {
        let app_clone = app.clone();
        let response = app_clone
            .oneshot(
                Request::builder()
                    .uri(endpoint)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::FORBIDDEN,
            "Endpoint {endpoint} must be forbidden"
        );

        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["status"], 403);
        assert_eq!(json["title"], "Forbidden");
    }
}

#[tokio::test]
async fn test_unknown_route_returns_rfc7807_problem_detail() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/this-does-not-exist")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["type"], "about:blank");
    assert_eq!(json["status"], 404);
    assert_eq!(json["title"], "Not Found");
    assert_eq!(json["instance"], "/api/this-does-not-exist");
}

#[tokio::test]
async fn test_cors_preflight_headers() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::OPTIONS)
                .uri("/api/ping")
                .header(header::ORIGIN, "http://localhost:5173")
                .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .unwrap(),
        "http://localhost:5173"
    );
    assert_eq!(
        response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_CREDENTIALS)
            .unwrap(),
        "true"
    );
}
