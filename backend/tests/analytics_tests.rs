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
    let pool = init_pool(&config)
        .await
        .expect("PostgreSQL must be accessible for integration tests");
    backend_rs::db::migrations::run_migrations(&pool)
        .await
        .expect("Database migrations must succeed for integration tests");
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
        "/api/analytics/top-artists",
        "/api/analytics/collection/value",
        "/api/analytics/collection/genres",
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
}

#[tokio::test]
async fn test_analytics_full_lifecycle() {
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
    // The Discogs ID lets the dashboard open the record's details
    let top_ids: Vec<i64> = top_list
        .iter()
        .map(|r| r["discogsId"].as_i64().unwrap())
        .collect();
    assert!(top_ids.contains(&discogs_id_1) && top_ids.contains(&discogs_id_2));

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
}

/// Inserts a release and `plays` listens of the user at the given UTC timestamp.
async fn listen(
    state: &AppState,
    user_id: i64,
    artist: Option<&str>,
    title: &str,
    thumb: Option<&str>,
    plays: usize,
    at: &str,
) {
    static DISCOGS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);
    let discogs_id = 800_000_000_000
        + (chrono::Utc::now().timestamp_micros() % 1_000_000_000) * 100
        + DISCOGS.fetch_add(1, Ordering::SeqCst);
    let record_id: i64 = sqlx::query_scalar(
        "INSERT INTO record_cache (discogs_id, title, artist, thumb_url, format)
         VALUES ($1, $2, $3, $4, 'LP') RETURNING id",
    )
    .bind(discogs_id)
    .bind(title)
    .bind(artist)
    .bind(thumb)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    let timestamp = chrono::NaiveDateTime::parse_from_str(at, "%Y-%m-%d %H:%M:%S").unwrap();
    for _ in 0..plays {
        sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(record_id)
            .bind(timestamp)
            .execute(&state.pool)
            .await
            .unwrap();
    }
}

async fn top_artists(app: &axum::Router, token: &str, query: &str) -> Vec<Value> {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/api/analytics/top-artists{query}"))
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice::<Value>(&bytes)
        .unwrap()
        .as_array()
        .unwrap()
        .clone()
}

#[tokio::test]
async fn test_top_artists_sum_listens_over_releases() {
    let (app, state) = setup_app().await;
    let (user_id, _, token) = create_authenticated_user(&app).await;
    let (other_id, _, _) = create_authenticated_user(&app).await;

    let day = "2026-10-05 20:00:00";
    listen(
        &state,
        user_id,
        Some("The Beatles"),
        "Abbey Road",
        Some("https://i.discogs.com/abbey.jpg"),
        3,
        day,
    )
    .await;
    listen(
        &state,
        user_id,
        Some("The Beatles"),
        "Help!",
        Some("https://i.discogs.com/help.jpg"),
        2,
        day,
    )
    .await;
    listen(
        &state,
        user_id,
        Some("Miles Davis"),
        "Kind of Blue",
        None,
        4,
        day,
    )
    .await;
    listen(&state, user_id, Some(" "), "Unknown", None, 9, day).await;
    listen(
        &state,
        user_id,
        Some("Can"),
        "Tago Mago",
        None,
        1,
        "2026-09-01 10:00:00",
    )
    .await;
    listen(&state, other_id, Some("Abba"), "Gold", None, 20, day).await;

    let all = top_artists(&app, &token, "").await;
    let summary: Vec<(&str, i64, i64)> = all
        .iter()
        .map(|a| {
            (
                a["artist"].as_str().unwrap(),
                a["count"].as_i64().unwrap(),
                a["recordCount"].as_i64().unwrap(),
            )
        })
        .collect();
    // Listens without artist and of other users are not counted
    assert_eq!(
        summary,
        vec![("The Beatles", 5, 2), ("Miles Davis", 4, 1), ("Can", 1, 1)]
    );
    assert_eq!(
        all[0]["thumbUrls"],
        json!([
            "https://i.discogs.com/abbey.jpg",
            "https://i.discogs.com/help.jpg"
        ])
    );
    assert_eq!(all[1]["thumbUrls"], json!([]));

    // Only listens within the days of the period
    let october = top_artists(&app, &token, "?from=2026-10-01&to=2026-10-31").await;
    let names: Vec<&str> = october
        .iter()
        .map(|a| a["artist"].as_str().unwrap())
        .collect();
    assert_eq!(names, vec!["The Beatles", "Miles Davis"]);
    // An invalid period counts everything
    assert_eq!(
        top_artists(&app, &token, "?from=gestern&to=2026-10-31")
            .await
            .len(),
        3
    );
}
