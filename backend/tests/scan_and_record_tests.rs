use std::sync::atomic::{AtomicU64, Ordering};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::Row;
use tower::ServiceExt;
use backend_rs::{
    config::Config,
    db::init_pool,
    models::record::RecordDetailDto,
    routes::create_app,
    state::AppState,
};

static USER_COUNTER: AtomicU64 = AtomicU64::new(100);

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
        "scan_user_{}_{}_{}",
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
        panic!("Register failed with status {}: {}", reg_status, String::from_utf8_lossy(&reg_bytes));
    }

    let reg_json: Value = serde_json::from_slice(&reg_bytes).unwrap();
    let user_id = reg_json["id"].as_i64().unwrap();

    (user_id, test_username, set_cookie)
}

#[tokio::test]
async fn test_record_details_listen_and_condition_lifecycle() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    // 1. Seed a test record in record_cache and collection_item
    let discogs_id = 880001i64;
    let row = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price, median_price)
        VALUES ($1, 'The Dark Side of the Moon', 'Pink Floyd', '1973', 'Vinyl, LP, Album', 40.00, 50.00)
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id)
    .fetch_one(pool)
    .await
    .unwrap();
    let record_id: i64 = row.get("id");

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Prog Rock') ON CONFLICT DO NOTHING")
        .bind(record_id)
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 882001, 'Very Good Plus (VG+)', 'Very Good (VG)', NOW())
        ON CONFLICT (user_id, instance_id) DO UPDATE SET media_condition = EXCLUDED.media_condition
        "#,
    )
    .bind(user_id)
    .bind(record_id)
    .execute(pool)
    .await
    .unwrap();

    // 2. GET /api/records/{id} -> RecordDetailDto
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/records/{record_id}"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let details: RecordDetailDto = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(details.discogs_id, discogs_id);
    assert_eq!(details.title.as_deref(), Some("The Dark Side of the Moon"));
    assert_eq!(details.artist.as_deref(), Some("Pink Floyd"));
    assert_eq!(details.year.as_deref(), Some("1973"));
    assert!(details.in_collection);
    assert_eq!(details.listen_count, 0);
    assert_eq!(details.media_condition.as_deref(), Some("Very Good Plus (VG+)"));

    // 3. POST /api/records/{id}/listen -> log listen event
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/records/{record_id}/listen"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let updated: RecordDetailDto = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(updated.listen_count, 1);
    assert!(updated.last_listened_at.is_some());
    assert_eq!(updated.listen_history.len(), 1);

    // 4. PATCH /api/records/{id}/condition -> update conditions
    let patch_payload = json!({
        "media_condition": "Mint (M)",
        "sleeve_condition": "Near Mint (NM)"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/records/{record_id}/condition"))
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&patch_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let patched: RecordDetailDto = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(patched.media_condition.as_deref(), Some("Mint (M)"));
    assert_eq!(patched.sleeve_condition.as_deref(), Some("Near Mint (NM or M-)"));
}

#[tokio::test]
async fn test_scan_qr_code_and_listen_history_reset() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    // Seed record
    let discogs_id = 880002i64;
    let row = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
        VALUES ($1, 'Random Access Memories', 'Daft Punk', '2013', 'Vinyl, 2xLP')
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
        INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
        VALUES ($1, $2, 882002, NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(record_id)
    .execute(pool)
    .await
    .unwrap();

    // 1. POST /api/scan with custom QR prefix VT:<discogs_id>
    let scan_payload = json!({
        "barcode": format!("VT:{discogs_id}")
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/scan")
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&scan_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let scan_res: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(scan_res["success"], true);
    assert!(scan_res["message"].as_str().unwrap().contains("Random Access Memories"));
    assert_eq!(scan_res["record"]["discogsId"], discogs_id);

    // Also test German keyboard layout error format: discogsßidö<discogs_id>
    let de_keyboard_payload = json!({
        "barcode": format!("discogsßidö{discogs_id}")
    });
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/scan")
                .header(header::COOKIE, &cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&de_keyboard_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // Verify 2 listen events exist in DB
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM listen_event WHERE user_id = $1 AND record_id = $2")
        .bind(user_id)
        .bind(record_id)
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(count, 2);

    // 2. Fetch listen_event id to test DELETE /api/scan/{id}
    let event_id: i64 = sqlx::query_scalar(
        "SELECT id FROM listen_event WHERE user_id = $1 AND record_id = $2 ORDER BY id DESC LIMIT 1"
    )
    .bind(user_id)
    .bind(record_id)
    .fetch_one(pool)
    .await
    .unwrap();

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/scan/{event_id}"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 3. DELETE /api/scan/all -> resets all remaining listens
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri("/api/scan/all")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let reset_res: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(reset_res["success"], true);
    assert_eq!(reset_res["deletedCount"], 1);

    // Count should now be 0
    let count_after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM listen_event WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(count_after, 0);
}

#[tokio::test]
async fn test_scan_and_record_unauthorized() {
    let (app, _) = setup_app().await;

    // 1. GET /api/records/1 without auth -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/records/1")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 2. POST /api/scan without auth -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/scan")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"barcode":"123456"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}
