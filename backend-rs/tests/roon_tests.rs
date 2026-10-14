use std::sync::atomic::{AtomicU64, Ordering};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use backend_rs::{
    config::Config,
    db::init_pool,
    routes::create_app,
    services::roon::moo::MooMessage,
    state::AppState,
};

static USER_COUNTER: AtomicU64 = AtomicU64::new(800);

async fn setup_app() -> (axum::Router, AppState) {
    dotenvy::dotenv().ok();
    let config = Config::from_env();
    let _ = backend_rs::db::migrations::run_migrations(&config.database_url).await;
    let pool = init_pool(&config)
        .await
        .expect("PostgreSQL must be accessible for integration tests");
    let state = AppState::new(pool, config);
    let app = create_app(state.clone());
    (app, state)
}

async fn create_authenticated_user(app: &axum::Router) -> (i64, String, String) {
    let cnt = USER_COUNTER.fetch_add(1, Ordering::SeqCst);
    let test_username = format!(
        "roon_user_{}_{}_{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
        cnt
    );
    let test_password = "Password123!";

    let register_payload = json!({
        "username": test_username,
        "password": test_password
    });

    let reg_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/register")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&register_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let reg_body = reg_res.into_body().collect().await.unwrap().to_bytes();
    let reg_json: Value = serde_json::from_slice(&reg_body).unwrap();
    let user_id = reg_json["id"].as_i64().expect("id must be present");

    let login_payload = json!({
        "username": test_username,
        "password": test_password
    });

    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_body = login_res.into_body().collect().await.unwrap().to_bytes();
    let login_json: Value = serde_json::from_slice(&login_body).unwrap();
    let token = login_json["token"].as_str().expect("token must be present").to_string();

    (user_id, test_username, token)
}

#[tokio::test]
async fn test_roon_endpoints_require_authentication() {
    let (app, _) = setup_app().await;

    // GET /api/roon/status
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/roon/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // GET /api/roon/zones
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/roon/zones")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // POST /api/roon/settings
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/settings")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "host": "192.168.1.10" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // POST /api/roon/play
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/play")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "artist": "Pink Floyd", "title": "The Dark Side of the Moon" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_roon_status_defaults_for_unconfigured_user() {
    let (app, _) = setup_app().await;
    let (_user_id, _username, token) = create_authenticated_user(&app).await;

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/roon/status")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
    let status_json: Value = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(status_json["connected"], false);
    assert_eq!(status_json["paired"], false);
    assert!(status_json["host"].is_null());
    assert_eq!(status_json["port"], 9100);
    assert!(status_json["zones"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn test_roon_save_settings_and_retrieve_status() {
    let (app, _) = setup_app().await;
    let (_user_id, _username, token) = create_authenticated_user(&app).await;

    let settings_payload = json!({
        "host": "192.168.1.100",
        "port": 9100,
        "zoneId": "160123456789-abcdef",
        "zoneName": "Living Room HiFi"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/settings")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&settings_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
    let saved_settings: Value = serde_json::from_slice(&body_bytes).unwrap();

    assert_eq!(saved_settings["host"], "192.168.1.100");
    assert_eq!(saved_settings["port"], 9100);
    assert_eq!(saved_settings["selectedZoneId"], "160123456789-abcdef");
    assert_eq!(saved_settings["selectedZoneName"], "Living Room HiFi");

    // Check status endpoint reflects saved configuration
    let status_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/roon/status")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(status_res.status(), StatusCode::OK);
    let status_body = status_res.into_body().collect().await.unwrap().to_bytes();
    let status_json: Value = serde_json::from_slice(&status_body).unwrap();

    assert_eq!(status_json["host"], "192.168.1.100");
    assert_eq!(status_json["port"], 9100);
    assert_eq!(status_json["selectedZoneId"], "160123456789-abcdef");
    assert_eq!(status_json["selectedZoneName"], "Living Room HiFi");
}

#[tokio::test]
async fn test_roon_clearing_host_resets_token() {
    let (app, state) = setup_app().await;
    let (user_id, _username, token) = create_authenticated_user(&app).await;

    // First configure host and seed a token in DB
    use sqlx::Row;
    sqlx::query(
        "UPDATE app_user SET roon_host = '192.168.1.100', roon_port = 9100, roon_token = 'existing-token-123' WHERE id = $1"
    )
    .bind(user_id)
    .execute(&state.pool)
    .await
    .unwrap();

    // Verify token was saved
    let row = sqlx::query("SELECT roon_token FROM app_user WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let token_val: Option<String> = row.get("roon_token");
    assert_eq!(token_val.as_deref(), Some("existing-token-123"));

    // Now send empty host to reset settings
    let clear_payload = json!({
        "host": "",
        "port": 9100,
        "zoneId": null,
        "zoneName": null
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/settings")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&clear_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);

    // Verify in DB that token has been cleared
    let row_after = sqlx::query("SELECT roon_host, roon_token FROM app_user WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let host_after: Option<String> = row_after.get("roon_host");
    let token_after: Option<String> = row_after.get("roon_token");
    assert!(host_after.is_none());
    assert!(token_after.is_none());
}

#[tokio::test]
async fn test_roon_play_validation() {
    let (app, _) = setup_app().await;
    let (_user_id, _username, token) = create_authenticated_user(&app).await;

    // Missing artist
    let empty_artist_payload = json!({
        "artist": "",
        "title": "Abbey Road"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/play")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&empty_artist_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // Missing title
    let empty_title_payload = json!({
        "artist": "The Beatles",
        "title": "   "
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/play")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&empty_title_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // Valid artist/title but Roon not configured
    let play_payload = json!({
        "artist": "The Beatles",
        "title": "Abbey Road"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/roon/play")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&play_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_moo_protocol_parsing_and_serialization() {
    let request_msg = MooMessage::new("REQUEST", "com.roonlabs.ping:1/ping")
        .with_header("Request-Id", "42");

    let serialized = request_msg.to_wire_string();
    assert!(serialized.starts_with("MOO/1 REQUEST com.roonlabs.ping:1/ping\n"));
    assert!(serialized.contains("Request-Id: 42\n"));

    let parsed = MooMessage::parse(&serialized).expect("Should parse serialized MOO message");
    assert_eq!(parsed.verb, "REQUEST");
    assert_eq!(parsed.name_or_status, "com.roonlabs.ping:1/ping");
    assert_eq!(parsed.get_header("Request-Id"), Some("42"));
    assert!(parsed.body.is_none());

    // Complete with JSON body
    let body_json = r#"{"status":"Success","zones":[]}"#;
    let complete_msg = MooMessage::new("COMPLETE", "Success")
        .with_header("Request-Id", "99")
        .with_body(body_json);

    let serialized_complete = complete_msg.to_wire_string();
    assert!(serialized_complete.contains("Content-Type: application/json\n"));
    assert!(serialized_complete.ends_with(body_json));

    let parsed_complete = MooMessage::parse(&serialized_complete).expect("Should parse complete message");
    assert_eq!(parsed_complete.verb, "COMPLETE");
    assert_eq!(parsed_complete.name_or_status, "Success");
    assert_eq!(parsed_complete.get_header("Request-Id"), Some("99"));
    assert_eq!(parsed_complete.body.as_deref(), Some(body_json));
}
