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
    models::collection::CollectionResponse,
    routes::create_app,
    state::AppState,
};

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

use std::sync::atomic::{AtomicU64, Ordering};
static USER_COUNTER: AtomicU64 = AtomicU64::new(1);

async fn create_authenticated_user(app: &axum::Router) -> (i64, String, String) {
    let cnt = USER_COUNTER.fetch_add(1, Ordering::SeqCst);
    let test_username = format!(
        "coll_user_{}_{}_{}",
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
async fn test_collection_requires_auth() {
    let (app, _) = setup_app().await;

    let res = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_collection_querying_filtering_and_pagination() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;

    // Seed test releases into record_cache, record_genres and collection_item
    let pool = &state.pool;

    // 1. Record A: Beatles - Abbey Road (1969, Vinyl, Rock, 5 listens)
    let discogs_id_a = 910001i64;
    let row_a = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price, median_price)
        VALUES ($1, 'Abbey Road', 'The Beatles', '1969', 'Vinyl, LP, Album', 25.50, 30.00)
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_a)
    .fetch_one(pool)
    .await
    .unwrap();
    let rec_id_a: i64 = row_a.get("id");

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Rock') ON CONFLICT DO NOTHING")
        .bind(rec_id_a)
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 920001, 'Mint (M)', 'Near Mint (NM)', NOW() - INTERVAL '10 days')
        ON CONFLICT (user_id, instance_id) DO UPDATE SET media_condition = EXCLUDED.media_condition
        "#,
    )
    .bind(user_id)
    .bind(rec_id_a)
    .execute(pool)
    .await
    .unwrap();

    for i in 1..=5 {
        sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, NOW() - ($3 || ' hours')::INTERVAL)")
            .bind(user_id)
            .bind(rec_id_a)
            .bind(i.to_string())
            .execute(pool)
            .await
            .unwrap();
    }

    // 2. Record B: Miles Davis - Kind of Blue (1959, Vinyl, Jazz, 0 listens)
    let discogs_id_b = 910002i64;
    let row_b = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price, median_price)
        VALUES ($1, 'Kind of Blue', 'Miles Davis', '1959', 'Vinyl, LP', 35.00, 45.00)
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_b)
    .fetch_one(pool)
    .await
    .unwrap();
    let rec_id_b: i64 = row_b.get("id");

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Jazz') ON CONFLICT DO NOTHING")
        .bind(rec_id_b)
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 920002, 'Very Good (VG)', 'Good Plus (G+)', NOW() - INTERVAL '5 days')
        ON CONFLICT (user_id, instance_id) DO UPDATE SET media_condition = EXCLUDED.media_condition
        "#,
    )
    .bind(user_id)
    .bind(rec_id_b)
    .execute(pool)
    .await
    .unwrap();

    // 3. Record C: Daft Punk - Discovery (2001, CD, Electronic, 2 listens)
    let discogs_id_c = 910003i64;
    let row_c = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price, median_price)
        VALUES ($1, 'Discovery', 'Daft Punk', '2001', 'CD, Album', 10.00, 15.00)
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_c)
    .fetch_one(pool)
    .await
    .unwrap();
    let rec_id_c: i64 = row_c.get("id");

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Electronic') ON CONFLICT DO NOTHING")
        .bind(rec_id_c)
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 920003, 'Mint (M)', 'Mint (M)', NOW() - INTERVAL '1 day')
        ON CONFLICT (user_id, instance_id) DO UPDATE SET media_condition = EXCLUDED.media_condition
        "#,
    )
    .bind(user_id)
    .bind(rec_id_c)
    .execute(pool)
    .await
    .unwrap();

    for i in 1..=2 {
        sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, NOW() - ($3 || ' hours')::INTERVAL)")
            .bind(user_id)
            .bind(rec_id_c)
            .bind(i.to_string())
            .execute(pool)
            .await
            .unwrap();
    }

    // Query 1: Default listing -> returns all 3 releases
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 3);
    assert_eq!(body.pagination.items, 3);

    // Query 2: Filter by category = 'vinyl' -> 2 releases (Beatles, Miles Davis)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?category=vinyl")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 2);
    assert!(body.releases.iter().all(|r| r.basic_information.format.to_lowercase().contains("vinyl")));

    // Query 3: Filter by category = 'cd' -> 1 release (Daft Punk)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?category=cd")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.title, "Discovery");

    // Query 4: Search filter ?search=beatles -> 1 release
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?search=beatles")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.title, "Abbey Road");

    // Query 5: Genre filter ?genres=Jazz -> 1 release
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?genres=Jazz")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.title, "Kind of Blue");

    // Query 6: Decade filter ?years=1960s -> 1 release (1969 Beatles)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?years=1960s")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.year, Some(1969));

    // Query 7: Unplayed only ?unplayed_only=true -> 1 release (Miles Davis, listen_count == 0)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?unplayed_only=true")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.title, "Kind of Blue");

    // Query 8: Min plays ?min_plays=3 -> 1 release (Beatles, 5 listens)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?min_plays=3")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.title, "Abbey Road");

    // Query 9: Sorting ?sort_by=year&sort_order=desc -> Daft Punk (2001), Beatles (1969), Miles Davis (1959)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?sort_by=year&sort_order=desc")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 3);
    assert_eq!(body.releases[0].basic_information.year, Some(2001));
    assert_eq!(body.releases[1].basic_information.year, Some(1969));
    assert_eq!(body.releases[2].basic_information.year, Some(1959));

    // Query 10: Pagination ?page=1&per_page=2 -> page 1 has 2 items, total 3 items, 2 pages
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?page=1&per_page=2")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 2);
    assert_eq!(body.pagination.page, 1);
    assert_eq!(body.pagination.per_page, 2);
    assert_eq!(body.pagination.pages, 2);
    assert_eq!(body.pagination.items, 3);
}

#[tokio::test]
async fn test_collection_random_and_unplayed_endpoints() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    // Seed 1 unplayed and 1 played release
    let discogs_id_1 = 910010i64;
    let row_1 = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
        VALUES ($1, 'Random Unplayed', 'Artist One', '1985', 'Vinyl')
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_1)
    .fetch_one(pool)
    .await
    .unwrap();
    let rec_id_1: i64 = row_1.get("id");

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Synth-pop') ON CONFLICT DO NOTHING")
        .bind(rec_id_1)
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
        VALUES ($1, $2, 920010, NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(rec_id_1)
    .execute(pool)
    .await
    .unwrap();

    let discogs_id_2 = 910011i64;
    let row_2 = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
        VALUES ($1, 'Random Played', 'Artist Two', '1995', 'CD')
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id_2)
    .fetch_one(pool)
    .await
    .unwrap();
    let rec_id_2: i64 = row_2.get("id");

    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Alternative') ON CONFLICT DO NOTHING")
        .bind(rec_id_2)
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
        VALUES ($1, $2, 920011, NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(rec_id_2)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, NOW())")
        .bind(user_id)
        .bind(rec_id_2)
        .execute(pool)
        .await
        .unwrap();

    // 1. GET /api/collection/random
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/random")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 2. GET /api/collection/random?genre=Synth-pop
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/random?genre=Synth-pop")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body["basic_information"]["title"], "Random Unplayed");

    // 3. GET /api/collection/unplayed
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/unplayed")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 1);
    assert_eq!(body.releases[0].basic_information.title, "Random Unplayed");
}

#[tokio::test]
async fn test_sync_endpoints_error_handling() {
    let (app, _) = setup_app().await;

    // 1. Sync without auth -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/collection/sync")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 2. Sync with user having no Discogs token -> 400 Bad Request
    let (_, _, cookie) = create_authenticated_user(&app).await;
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/collection/sync")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // 3. Price refresh without auth -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/collection/prices/refresh")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 4. Add release without auth -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/collection/releases/12345")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}
