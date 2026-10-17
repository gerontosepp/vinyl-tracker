use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{
    config::Config, db::init_pool, models::record::RecordDetailDto, routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::atomic::{AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(500);

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
        "detail_user_{}_{}_{}",
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

    let reg_status = reg_res.status();
    let set_cookie = reg_res
        .headers()
        .get(header::SET_COOKIE)
        .map(|v| v.to_str().unwrap().to_string())
        .unwrap_or_default();

    let reg_bytes = reg_res.into_body().collect().await.unwrap().to_bytes();
    if reg_status != StatusCode::OK {
        panic!(
            "Register failed with status {}: {}",
            reg_status,
            String::from_utf8_lossy(&reg_bytes)
        );
    }

    let reg_json: Value = serde_json::from_slice(&reg_bytes).unwrap();
    let user_id = reg_json["id"].as_i64().unwrap();

    (user_id, test_username, set_cookie)
}

#[tokio::test]
async fn test_goldmine_condition_validation_and_normalization() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    // Seed record
    let discogs_id = 770001i64;
    let row = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
        VALUES ($1, 'OK Computer', 'Radiohead', '1997', 'Vinyl, 2xLP, Album')
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id)
    .fetch_one(pool)
    .await
    .unwrap();
    let record_id: i64 = row.get("id");

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 772001, 'Good (G)', 'Good (G)', NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(record_id)
    .execute(pool)
    .await
    .unwrap();

    // 1. Invalid condition should be rejected with 400 Bad Request
    let invalid_payload = json!({
        "media_condition": "NonExistentGradingScale"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/records/{record_id}/condition"))
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&invalid_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // 2. Shorthand "VG+" should be normalized to canonical "Very Good Plus (VG+)"
    let shorthand_payload = json!({
        "media_condition": "VG+",
        "sleeve_condition": "NM"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/records/{record_id}/condition"))
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&shorthand_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let updated: RecordDetailDto = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        updated.media_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );
    assert_eq!(
        updated.sleeve_condition.as_deref(),
        Some("Near Mint (NM or M-)")
    );
}

#[tokio::test]
async fn test_record_not_found_returns_rfc7807() {
    let (app, _) = setup_app().await;
    let (_, _, cookie) = create_authenticated_user(&app).await;

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/records/99999999")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let problem: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(problem["status"], 404);
    assert_eq!(problem["title"], "Not Found");
}
