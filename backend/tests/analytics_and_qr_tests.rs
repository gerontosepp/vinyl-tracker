use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{config::Config, db::init_pool, routes::create_app, state::AppState};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(700);

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
        "analytics_user_{}_{}_{}",
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
    let reg_body = reg_res.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(
        reg_status,
        StatusCode::OK,
        "Failed to register test user: {}",
        String::from_utf8_lossy(&reg_body)
    );

    let reg_json: Value = serde_json::from_slice(&reg_body).unwrap();
    let user_id = reg_json["id"].as_i64().expect("Expected id in user JSON");

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

    let login_status = login_res.status();
    let login_body = login_res.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(login_status, StatusCode::OK);
    let login_json: Value = serde_json::from_slice(&login_body).unwrap();
    let token = login_json["token"]
        .as_str()
        .expect("token present")
        .to_string();

    (user_id, test_username, token)
}

#[tokio::test]
async fn test_analytics_endpoints_require_auth() {
    let (app, _) = setup_app().await;

    let endpoints = [
        "/api/analytics/recent",
        "/api/analytics/top",
        "/api/analytics/collection/value",
        "/api/analytics/collection/genres",
        "/api/collection/qr-codes/all",
    ];

    for endpoint in endpoints {
        let req = Request::builder()
            .method(Method::GET)
            .uri(endpoint)
            .body(Body::empty())
            .unwrap();

        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(
            res.status(),
            StatusCode::UNAUTHORIZED,
            "Expected 401 for unauthorized {endpoint}"
        );
    }

    let req_qr = Request::builder()
        .method(Method::POST)
        .uri("/api/collection/qr-codes/selected")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"items":[]}"#))
        .unwrap();

    let res_qr = app.oneshot(req_qr).await.unwrap();
    assert_eq!(res_qr.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_analytics_and_qr_full_lifecycle() {
    let (app, state) = setup_app().await;
    let pool = state.pool;

    // 1. Create a test user
    let (user_id, _, auth_token) = create_authenticated_user(&app).await;
    let auth_header = format!("Bearer {auth_token}");

    // 2. Insert records into record_cache and collection_item
    let cnt = USER_COUNTER.fetch_add(1, Ordering::SeqCst);
    let discogs_id_1 = 9870000 + cnt as i64 * 2;
    let discogs_id_2 = 9870001 + cnt as i64 * 2;

    let rec1_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format)
        VALUES ($1, 'Kind of Blue', 'Miles Davis', '1959', 'https://example.com/thumb1.jpg', 'LP')
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_1)
    .fetch_one(&pool)
    .await
    .unwrap();

    let rec2_id: i64 = sqlx::query_scalar(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format)
        VALUES ($1, 'A Love Supreme', 'John Coltrane', '1965', 'https://example.com/thumb2.jpg', 'LP')
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_2)
    .fetch_one(&pool)
    .await
    .unwrap();

    // Link genres
    sqlx::query("DELETE FROM record_genres WHERE record_id = $1")
        .bind(rec1_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM record_genres WHERE record_id = $1")
        .bind(rec2_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Jazz')")
        .bind(rec1_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Modal')")
        .bind(rec1_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Jazz')")
        .bind(rec2_id)
        .execute(&pool)
        .await
        .unwrap();

    // Insert into collection_item for user
    sqlx::query(
        "INSERT INTO collection_item (user_id, record_id, instance_id, added_at) VALUES ($1, $2, 101, NOW())"
    )
    .bind(user_id)
    .bind(rec1_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO collection_item (user_id, record_id, instance_id, added_at) VALUES ($1, $2, 102, NOW())"
    )
    .bind(user_id)
    .bind(rec2_id)
    .execute(&pool)
    .await
    .unwrap();

    // 3. Insert listen events: rec1 listened 3 times, rec2 listened 1 time
    for _ in 0..3 {
        sqlx::query(
            "INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, NOW())",
        )
        .bind(user_id)
        .bind(rec1_id)
        .execute(&pool)
        .await
        .unwrap();
    }
    sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, NOW())")
        .bind(user_id)
        .bind(rec2_id)
        .execute(&pool)
        .await
        .unwrap();

    // 4. Test GET /api/analytics/recent
    let req_recent = Request::builder()
        .method(Method::GET)
        .uri("/api/analytics/recent")
        .header(header::AUTHORIZATION, &auth_header)
        .body(Body::empty())
        .unwrap();

    let res_recent = app.clone().oneshot(req_recent).await.unwrap();
    assert_eq!(res_recent.status(), StatusCode::OK);
    let bytes = res_recent.into_body().collect().await.unwrap().to_bytes();
    let recent_json: Value = serde_json::from_slice(&bytes).unwrap();
    let events = recent_json.as_array().expect("Expected JSON array");
    assert_eq!(events.len(), 4, "Should have 4 listen events");
    assert!(events[0].get("record").is_some());
    assert!(events[0]["record"]["discogsId"].is_number());
    assert!(events[0].get("timestamp").is_some());

    // 5. Test GET /api/analytics/top
    let req_top = Request::builder()
        .method(Method::GET)
        .uri("/api/analytics/top")
        .header(header::AUTHORIZATION, &auth_header)
        .body(Body::empty())
        .unwrap();

    let res_top = app.clone().oneshot(req_top).await.unwrap();
    assert_eq!(res_top.status(), StatusCode::OK);
    let bytes_top = res_top.into_body().collect().await.unwrap().to_bytes();
    let top_json: Value = serde_json::from_slice(&bytes_top).unwrap();
    let top_list = top_json.as_array().expect("Expected JSON array");
    assert_eq!(top_list.len(), 2);
    // Highest count first
    assert_eq!(top_list[0]["title"], "Kind of Blue");
    assert_eq!(top_list[0]["recordTitle"], "Kind of Blue");
    assert_eq!(top_list[0]["count"], 3);
    assert_eq!(top_list[1]["title"], "A Love Supreme");
    assert_eq!(top_list[1]["count"], 1);

    // 6. Test GET /api/analytics/collection/genres
    let req_genres = Request::builder()
        .method(Method::GET)
        .uri("/api/analytics/collection/genres")
        .header(header::AUTHORIZATION, &auth_header)
        .body(Body::empty())
        .unwrap();

    let res_genres = app.clone().oneshot(req_genres).await.unwrap();
    assert_eq!(res_genres.status(), StatusCode::OK);
    let bytes_genres = res_genres.into_body().collect().await.unwrap().to_bytes();
    let genres_json: Value = serde_json::from_slice(&bytes_genres).unwrap();
    let genre_list = genres_json.as_array().expect("Expected JSON array");
    // Jazz (2), Modal (1)
    assert_eq!(genre_list[0]["name"], "Jazz");
    assert_eq!(genre_list[0]["value"], 2);
    assert_eq!(genre_list[1]["name"], "Modal");
    assert_eq!(genre_list[1]["value"], 1);

    // 7. Test GET /api/analytics/collection/value without Discogs token -> 400 Bad Request
    let req_val = Request::builder()
        .method(Method::GET)
        .uri("/api/analytics/collection/value")
        .header(header::AUTHORIZATION, &auth_header)
        .body(Body::empty())
        .unwrap();

    let res_val = app.clone().oneshot(req_val).await.unwrap();
    assert_eq!(res_val.status(), StatusCode::BAD_REQUEST);
    let bytes_val = res_val.into_body().collect().await.unwrap().to_bytes();
    let val_json: Value = serde_json::from_slice(&bytes_val).unwrap();
    assert_eq!(val_json["status"], 400);
    assert!(
        val_json["detail"]
            .as_str()
            .unwrap()
            .contains("Connect your Discogs account in settings")
    );

    // 8. Test POST /api/collection/qr-codes/selected with empty items -> 400 Bad Request
    let req_qr_empty = Request::builder()
        .method(Method::POST)
        .uri("/api/collection/qr-codes/selected")
        .header(header::AUTHORIZATION, &auth_header)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(r#"{"items":[]}"#))
        .unwrap();

    let res_qr_empty = app.clone().oneshot(req_qr_empty).await.unwrap();
    assert_eq!(res_qr_empty.status(), StatusCode::BAD_REQUEST);

    // 9. Test POST /api/collection/qr-codes/selected with items -> 200 PDF
    let payload = json!({
        "items": [
            {
                "id": discogs_id_1,
                "title": "Kind of Blue",
                "artist": "Miles Davis"
            },
            {
                "id": discogs_id_2,
                "title": "A Love Supreme",
                "artist": "John Coltrane"
            }
        ]
    });

    let req_qr_valid = Request::builder()
        .method(Method::POST)
        .uri("/api/collection/qr-codes/selected")
        .header(header::AUTHORIZATION, &auth_header)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let res_qr_valid = app.clone().oneshot(req_qr_valid).await.unwrap();
    assert_eq!(res_qr_valid.status(), StatusCode::OK);
    assert_eq!(
        res_qr_valid.headers().get(header::CONTENT_TYPE).unwrap(),
        "application/pdf"
    );
    assert!(
        res_qr_valid
            .headers()
            .get(header::CONTENT_DISPOSITION)
            .unwrap()
            .to_str()
            .unwrap()
            .contains("collection_qr_codes.pdf")
    );

    let pdf_bytes = res_qr_valid.into_body().collect().await.unwrap().to_bytes();
    assert!(!pdf_bytes.is_empty());
    assert_eq!(&pdf_bytes[0..4], b"%PDF");

    // 10. Test GET /api/collection/qr-codes/all -> 200 PDF
    let req_qr_all = Request::builder()
        .method(Method::GET)
        .uri("/api/collection/qr-codes/all")
        .header(header::AUTHORIZATION, &auth_header)
        .body(Body::empty())
        .unwrap();

    let res_qr_all = app.oneshot(req_qr_all).await.unwrap();
    assert_eq!(res_qr_all.status(), StatusCode::OK);
    assert_eq!(
        res_qr_all.headers().get(header::CONTENT_TYPE).unwrap(),
        "application/pdf"
    );
    let all_pdf_bytes = res_qr_all.into_body().collect().await.unwrap().to_bytes();
    assert!(!all_pdf_bytes.is_empty());
    assert_eq!(&all_pdf_bytes[0..4], b"%PDF");
}
