use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{
    config::Config, db::init_pool, models::collection::CollectionResponse, routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::Row;
use tower::ServiceExt;

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

    sqlx::query(
        "INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Rock') ON CONFLICT DO NOTHING",
    )
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

    sqlx::query(
        "INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Jazz') ON CONFLICT DO NOTHING",
    )
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
    assert!(
        body.releases
            .iter()
            .all(|r| r.basic_information.format.to_lowercase().contains("vinyl"))
    );

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

#[tokio::test]
async fn test_remove_release_from_collection() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    let discogs_id = 778899i64;
    let instance_id = 998877i64;

    // 1. Delete without auth -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/collection/releases/{discogs_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    // 2. Delete when item not in collection -> 404
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/collection/releases/{discogs_id}"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 3. Seed record_cache, collection_item, and a listen_event
    let row = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
        VALUES ($1, 'Delete Me Album', 'Delete Artist', '2020', 'Vinyl')
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .bind(discogs_id)
    .fetch_one(pool)
    .await
    .unwrap();
    let rec_id: i64 = row.get("id");

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(rec_id)
    .bind(instance_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO listen_event (user_id, record_id, timestamp)
        VALUES ($1, $2, NOW())
        "#,
    )
    .bind(user_id)
    .bind(rec_id)
    .execute(pool)
    .await
    .unwrap();

    // Verify item is currently in collection
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM collection_item WHERE user_id = $1 AND instance_id = $2",
    )
    .bind(user_id)
    .bind(instance_id)
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(count, 1);

    // 4. Delete the release
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/collection/releases/{discogs_id}"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    // 5. Verify collection_item is deleted
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM collection_item WHERE user_id = $1 AND instance_id = $2",
    )
    .bind(user_id)
    .bind(instance_id)
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(count, 0);

    // 6. Verify listen_event and record_cache still exist!
    let listen_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM listen_event WHERE user_id = $1 AND record_id = $2",
    )
    .bind(user_id)
    .bind(rec_id)
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(listen_count, 1);

    let cache_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM record_cache WHERE id = $1")
        .bind(rec_id)
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(cache_count, 1);

    // 7. Deleting again returns 404
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/collection/releases/{discogs_id}"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_collection_artist_sorting_natural_order_and_collation() {
    let (app, state) = setup_app().await;
    let (user_id, _, cookie) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    let artists_and_titles = vec![
        (980001i64, "The Beatles", "Abbey Road", 1969),
        (980002i64, "Adele (3)", "21", 2011),
        (980003i64, "A.R. & Machines", "Echo", 1972),
        (980004i64, "BAP", "Zwesche Salzjebäck Un Bier", 1984),
        (
            980005i64,
            "The Alan Parsons Project",
            "Eye in the Sky",
            1982,
        ),
    ];

    for (discogs_id, artist, title, year) in &artists_and_titles {
        let row = sqlx::query(
            r#"
            INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
            VALUES ($1, $2, $3, $4, 'Vinyl, LP')
            ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title, artist = EXCLUDED.artist, release_year = EXCLUDED.release_year
            RETURNING id
            "#,
        )
        .bind(discogs_id)
        .bind(title)
        .bind(artist)
        .bind(year.to_string())
        .fetch_one(pool)
        .await
        .unwrap();

        let rec_id: i64 = row.get("id");

        sqlx::query(
            r#"
            INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, instance_id) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(rec_id)
        .bind(discogs_id + 10000)
        .execute(pool)
        .await
        .unwrap();
    }

    // 1. Sort by artist ASC:
    // Expected order:
    // 1. A.R. & Machines ('.' precedes 'd' in ASCII/"C" collation)
    // 2. Adele (3)
    // 3. The Alan Parsons Project ('The ' stripped -> 'alan parsons project')
    // 4. BAP
    // 5. The Beatles ('The ' stripped -> 'beatles')
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?sort=artist&sort_order=asc")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: CollectionResponse = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body.releases.len(), 5);

    let artist_names: Vec<String> = body
        .releases
        .iter()
        .map(|r| r.basic_information.artists[0].name.clone())
        .collect();

    assert_eq!(
        artist_names,
        vec![
            "A.R. & Machines",
            "Adele (3)",
            "The Alan Parsons Project",
            "BAP",
            "The Beatles",
        ]
    );

    // 2. Sort by artist DESC: exact reverse
    let res_desc = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?sort=artist&sort_order=desc")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res_desc.status(), StatusCode::OK);
    let bytes_desc = res_desc.into_body().collect().await.unwrap().to_bytes();
    let body_desc: CollectionResponse = serde_json::from_slice(&bytes_desc).unwrap();
    let artist_names_desc: Vec<String> = body_desc
        .releases
        .iter()
        .map(|r| r.basic_information.artists[0].name.clone())
        .collect();

    assert_eq!(
        artist_names_desc,
        vec![
            "The Beatles",
            "BAP",
            "The Alan Parsons Project",
            "Adele (3)",
            "A.R. & Machines",
        ]
    );
}

#[tokio::test]
async fn test_collection_export_endpoints() {
    let (app, state) = setup_app().await;
    let (user_id, username, cookie) = create_authenticated_user(&app).await;

    // 1. Unauthorized export request returns 401
    let unauth_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/export?format=csv")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauth_res.status(), StatusCode::UNAUTHORIZED);

    // 2. Unsupported format returns 400 with RFC 7807 Problem Detail
    let bad_fmt_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/export?format=xml")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bad_fmt_res.status(), StatusCode::BAD_REQUEST);
    let bad_fmt_bytes = bad_fmt_res.into_body().collect().await.unwrap().to_bytes();
    let bad_fmt_json: Value = serde_json::from_slice(&bad_fmt_bytes).unwrap();
    assert!(
        bad_fmt_json["detail"]
            .as_str()
            .unwrap()
            .contains("Unsupported or missing export format")
    );

    // 3. Insert sample records into user collection
    let row1 = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price, median_price)
        VALUES (99001, 'The Dark Side of the Moon', 'Pink Floyd', '1973', 'LP', 34.50, 40.00)
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap();
    let r1: i64 = row1.get("id");

    sqlx::query(
        "INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Rock') ON CONFLICT DO NOTHING",
    )
    .bind(r1)
    .execute(&state.pool)
    .await
    .unwrap();

    let row2 = sqlx::query(
        r#"
        INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price, median_price)
        VALUES (99002, 'Kind of Blue', 'Miles Davis', '1959', 'LP', 28.00, 35.00)
        ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
        "#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap();
    let r2: i64 = row2.get("id");

    sqlx::query(
        "INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Jazz') ON CONFLICT DO NOTHING",
    )
    .bind(r2)
    .execute(&state.pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 9900101, 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(r1)
    .execute(&state.pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, sleeve_condition, added_at)
        VALUES ($1, $2, 9900201, 'Mint (M)', 'Near Mint (NM or M-)', NOW())
        ON CONFLICT (user_id, instance_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(r2)
    .execute(&state.pool)
    .await
    .unwrap();

    // 4. Test CSV Export
    let csv_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/export?format=csv")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(csv_res.status(), StatusCode::OK);
    let csv_content_type = csv_res
        .headers()
        .get(header::CONTENT_TYPE)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(csv_content_type.contains("text/csv"));
    let csv_disp = csv_res
        .headers()
        .get(header::CONTENT_DISPOSITION)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(csv_disp.contains("vinyl_collection_export.csv"));

    let csv_bytes = csv_res.into_body().collect().await.unwrap().to_bytes();
    let csv_text = String::from_utf8(csv_bytes.to_vec()).unwrap();
    assert!(csv_text.starts_with("Artist,Title,Release Year,Format"));
    assert!(csv_text.contains("Pink Floyd"));
    assert!(csv_text.contains("The Dark Side of the Moon"));
    assert!(csv_text.contains("Miles Davis"));
    assert!(csv_text.contains("Kind of Blue"));

    // 5. Test JSON Export
    let json_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/export?format=json")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(json_res.status(), StatusCode::OK);
    let json_content_type = json_res
        .headers()
        .get(header::CONTENT_TYPE)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(json_content_type.contains("application/json"));
    let json_disp = json_res
        .headers()
        .get(header::CONTENT_DISPOSITION)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(json_disp.contains("vinyl_collection_backup.json"));

    let json_bytes = json_res.into_body().collect().await.unwrap().to_bytes();
    let backup_data: Value = serde_json::from_slice(&json_bytes).unwrap();
    assert_eq!(backup_data["username"], username);
    assert_eq!(backup_data["total_records"], 2);
    assert!(backup_data["total_estimated_value"].as_f64().unwrap() > 0.0);
    assert_eq!(backup_data["releases"].as_array().unwrap().len(), 2);

    // 6. Test PDF Catalog Export
    let pdf_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/export?format=pdf")
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(pdf_res.status(), StatusCode::OK);
    let pdf_content_type = pdf_res
        .headers()
        .get(header::CONTENT_TYPE)
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(pdf_content_type, "application/pdf");
    let pdf_disp = pdf_res
        .headers()
        .get(header::CONTENT_DISPOSITION)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(pdf_disp.contains("vinyl_collection_catalog.pdf"));

    let pdf_bytes = pdf_res.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&pdf_bytes[0..4], b"%PDF");

    let mut pdf_doc = lopdf::Document::load_mem(&pdf_bytes).expect("Valid PDF");
    pdf_doc.decompress();
    let mut full_text = String::new();
    for object in pdf_doc.objects.values() {
        if let lopdf::Object::Stream(stream) = object
            && let Ok(text) = String::from_utf8(stream.content.clone())
        {
            full_text.push_str(&text);
        }
    }
    assert!(full_text.contains("Vinyl Tracker - Collection Catalog & Insurance Report"));
    assert!(full_text.contains(&username));
    assert!(full_text.contains("Pink Floyd"));
    assert!(full_text.contains("The Dark Side of the Moon"));
}

#[tokio::test]
async fn test_collection_sync_service_full_workflow() {
    use axum::{
        Router,
        extract::Path,
        routing::{delete, get, post},
    };
    use backend_rs::{
        clients::discogs::DiscogsClient, models::user::AppUser,
        services::collection_sync::CollectionSyncService,
    };

    let (app, state) = setup_app().await;
    let (user_id, _username, _cookie) = create_authenticated_user(&app).await;

    // 1. Spawning mock Discogs HTTP Server
    let mock_discogs = Router::new()
        .route(
            "/users/{username}/collection/fields",
            get(|| async {
                axum::Json(json!({
                    "fields": [
                        {"id": 1, "name": "Media Condition"},
                        {"id": 2, "name": "Sleeve Condition"}
                    ]
                }))
            }),
        )
        .route(
            "/users/{username}/collection/folders/0/releases",
            get(|| async {
                axum::Json(json!({
                    "pagination": {
                        "page": 1,
                        "pages": 1,
                        "per_page": 100,
                        "items": 1
                    },
                    "releases": [{
                        "id": 98765,
                        "instance_id": 555,
                        "date_added": "2026-02-01T12:00:00Z",
                        "basic_information": {
                            "id": 98765,
                            "title": "A Love Supreme",
                            "year": 1965,
                            "artists": [{"name": "John Coltrane"}],
                            "genres": ["Jazz"],
                            "styles": ["Hard Bop"],
                            "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                            "labels": [{"name": "Impulse!", "catno": "AS-77"}],
                            "thumb": "https://img.discogs.com/supreme.jpg"
                        },
                        "notes": [
                            {"field_id": 1, "value": "Near Mint (NM or M-)"},
                            {"field_id": 2, "value": "Very Good Plus (VG+)"}
                        ]
                    }]
                }))
            }),
        )
        .route(
            "/users/{username}/collection/folders/0/releases/{id}",
            post(|| async {
                (
                    StatusCode::CREATED,
                    axum::Json(json!({
                        "instance_id": 777,
                        "resource_url": "https://api.discogs.com/release/98765"
                    })),
                )
            }),
        )
        .route(
            "/users/{username}/collection/folders/0/releases/{id}/instances/{instance_id}",
            delete(|| async { StatusCode::NO_CONTENT }),
        )
        .route(
            "/marketplace/price_suggestions/{id}",
            get(|| async {
                axum::Json(json!({
                    "Near Mint (NM or M-)": {
                        "currency": "EUR",
                        "value": 55.00
                    },
                    "Very Good Plus (VG+)": {
                        "currency": "EUR",
                        "value": 35.00
                    }
                }))
            }),
        )
        .route(
            "/releases/{id}",
            get(|Path(id): Path<i64>| async move {
                axum::Json(json!({
                    "id": id,
                    "title": "A Love Supreme",
                    "artists": [{"name": "John Coltrane"}],
                    "year": 1965,
                    "genres": ["Jazz"],
                    "styles": ["Hard Bop"],
                    "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                    "labels": [{"name": "Impulse!", "catno": "AS-77"}],
                    "thumb": "https://img.discogs.com/supreme.jpg"
                }))
            }),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind ephemeral mock port");
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, mock_discogs).await.unwrap();
    });

    let mock_client =
        DiscogsClient::with_base_url(format!("http://{addr}"), "sync-test/1.0".to_string());

    // 2. Test user without token fails
    let user_no_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();

    let err_sync = CollectionSyncService::sync_collection(
        &state.pool,
        &mock_client,
        &state.crypto,
        &user_no_token,
    )
    .await;
    assert!(
        err_sync.is_err(),
        "Sync should fail without configured Discogs username"
    );

    // 3. Configure Discogs credentials
    let enc_token = state.crypto.encrypt("mock_token_123");
    sqlx::query("UPDATE app_user SET discogs_username = $1, discogs_token = $2 WHERE id = $3")
        .bind("coltrane_fan")
        .bind(&enc_token)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .unwrap();

    let user_with_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();

    // 4. Run sync_collection
    let sync_res = CollectionSyncService::sync_collection(
        &state.pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
    )
    .await
    .unwrap();
    assert_eq!(sync_res.status, "SUCCESS");
    assert_eq!(sync_res.added, 1);
    assert_eq!(sync_res.total, 1);

    // Verify item in DB
    let item_row = sqlx::query("SELECT id, media_condition, sleeve_condition FROM collection_item WHERE user_id = $1 AND instance_id = 555")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let media_cond: Option<String> = item_row.get("media_condition");
    assert_eq!(media_cond.as_deref(), Some("Near Mint (NM or M-)"));

    // 5. Test refresh_collection_prices
    let price_res = CollectionSyncService::refresh_collection_prices(
        &state.pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        false,
    )
    .await
    .unwrap();
    assert_eq!(price_res.updated_count, 1);

    // 6. Test add_release_and_sync
    let add_res = CollectionSyncService::add_release_and_sync(
        &state.pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        98765,
    )
    .await
    .unwrap();
    assert_eq!(add_res.added, 1);

    // 7. Test remove_release
    let rem_res = CollectionSyncService::remove_release(
        &state.pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        98765,
        Some(777),
    )
    .await;
    assert!(rem_res.is_ok(), "Removing release should succeed");

    // 8. Test remove_release for not found
    let rem_err = CollectionSyncService::remove_release(
        &state.pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        999999,
        None,
    )
    .await;
    assert!(
        rem_err.is_err(),
        "Removing non-existent record should return error"
    );
}

async fn post_restore(app: &axum::Router, cookie: &str, body: Vec<u8>) -> (StatusCode, Value) {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/collection/restore")
                .header(header::COOKIE, cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap())
}

async fn fetch_collection(app: &axum::Router, cookie: &str) -> CollectionResponse {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection?per_page=100")
                .header(header::COOKIE, cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn test_collection_backup_restore_roundtrip() {
    let (app, state) = setup_app().await;
    let (source_id, _, source_cookie) = create_authenticated_user(&app).await;
    let (_, _, target_cookie) = create_authenticated_user(&app).await;

    // record_cache is shared between tests, so use Discogs IDs unique to this run
    let base_id = 800_000_000 + (chrono::Utc::now().timestamp_micros() % 100_000_000) * 2;
    let (played_id, unplayed_id) = (base_id, base_id + 1);

    // 1. Source collection: one played record (two listens) and one unplayed record
    let mut record_ids = Vec::new();
    for (discogs_id, title, genre) in [
        (played_id, "Restore Played", "Rock"),
        (unplayed_id, "Restore Unplayed", "Jazz"),
    ] {
        let record_id: i64 = sqlx::query(
            "INSERT INTO record_cache (discogs_id, title, artist, release_year, format, lowest_price)
             VALUES ($1, $2, 'Restore Artist', '1977', 'LP', 21.50) RETURNING id",
        )
        .bind(discogs_id)
        .bind(title)
        .fetch_one(&state.pool)
        .await
        .unwrap()
        .get("id");
        sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, $2)")
            .bind(record_id)
            .bind(genre)
            .execute(&state.pool)
            .await
            .unwrap();
        record_ids.push(record_id);
    }
    for (record_id, instance_id) in [(record_ids[0], base_id), (record_ids[1], base_id + 1)] {
        sqlx::query(
            "INSERT INTO collection_item (user_id, record_id, instance_id, added_at, media_condition, sleeve_condition)
             VALUES ($1, $2, $3, '2026-04-10 12:00:00', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)')",
        )
        .bind(source_id)
        .bind(record_id)
        .bind(instance_id)
        .execute(&state.pool)
        .await
        .unwrap();
    }
    for ts in ["2026-04-01 20:00:00.250000", "2026-04-12 15:30:00.123456"] {
        sqlx::query(
            "INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, $3::timestamp)",
        )
        .bind(source_id)
        .bind(record_ids[0])
        .bind(ts)
        .execute(&state.pool)
        .await
        .unwrap();
    }

    // 2. Export the source collection as JSON backup (format version 2 with listen history)
    let export_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/collection/export?format=json")
                .header(header::COOKIE, &source_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(export_res.status(), StatusCode::OK);
    let backup_bytes = export_res.into_body().collect().await.unwrap().to_bytes();
    let backup: Value = serde_json::from_slice(&backup_bytes).unwrap();
    assert_eq!(backup["format_version"], 2);
    let played = backup["releases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == played_id)
        .unwrap();
    assert_eq!(
        played["listen_history"],
        json!(["2026-04-01T20:00:00.250000Z", "2026-04-12T15:30:00.123456Z"])
    );

    // 3. Unauthenticated restore is rejected
    let unauth = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/collection/restore")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(backup_bytes.to_vec()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauth.status(), StatusCode::UNAUTHORIZED);

    // 4. Restore into the empty target collection
    let (status, result) = post_restore(&app, &target_cookie, backup_bytes.to_vec()).await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["format_version"], 2);
    assert_eq!(result["records_total"], 2);
    assert_eq!(result["records_added"], 2);
    assert_eq!(result["records_updated"], 0);
    assert_eq!(result["listens_added"], 2);
    assert_eq!(result["listens_skipped"], 0);
    assert_eq!(result["listen_history_included"], true);

    let restored = fetch_collection(&app, &target_cookie).await;
    assert_eq!(restored.releases.len(), 2);
    let played = restored
        .releases
        .iter()
        .find(|r| r.id == played_id)
        .unwrap();
    assert_eq!(played.listen_count, 2);
    assert_eq!(
        played.last_played_at.as_deref(),
        Some("2026-04-12T15:30:00Z")
    );
    assert_eq!(played.date_added, "2026-04-10T12:00:00Z");
    assert_eq!(
        played.media_condition.as_deref(),
        Some("Near Mint (NM or M-)")
    );
    assert_eq!(
        played.sleeve_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );
    assert_eq!(played.basic_information.genres, vec!["Rock"]);

    // 5. Restoring the same backup again is idempotent
    let (status, result) = post_restore(&app, &target_cookie, backup_bytes.to_vec()).await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["records_added"], 0);
    assert_eq!(result["records_updated"], 2);
    assert_eq!(result["listens_added"], 0);
    assert_eq!(result["listens_skipped"], 2);
    let again = fetch_collection(&app, &target_cookie).await;
    assert_eq!(again.releases.len(), 2);
    let played = again.releases.iter().find(|r| r.id == played_id).unwrap();
    assert_eq!(played.listen_count, 2);

    // 6. Merge rules: backup conditions win, missing ones keep the stored value
    let mut edited = backup.clone();
    for release in edited["releases"].as_array_mut().unwrap() {
        if release["id"] == played_id {
            release["media_condition"] = json!("Good (G)");
            release["sleeve_condition"] = Value::Null;
        }
    }
    let (status, _) =
        post_restore(&app, &target_cookie, serde_json::to_vec(&edited).unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    let merged = fetch_collection(&app, &target_cookie).await;
    let played = merged.releases.iter().find(|r| r.id == played_id).unwrap();
    assert_eq!(played.media_condition.as_deref(), Some("Good (G)"));
    assert_eq!(
        played.sleeve_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );

    // 7. A version 1 backup (no listen history) restores the collection but no listens
    let (_, _, legacy_cookie) = create_authenticated_user(&app).await;
    let mut legacy = backup.clone();
    legacy.as_object_mut().unwrap().remove("format_version");
    for release in legacy["releases"].as_array_mut().unwrap() {
        release.as_object_mut().unwrap().remove("listen_history");
    }
    let (status, result) =
        post_restore(&app, &legacy_cookie, serde_json::to_vec(&legacy).unwrap()).await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["format_version"], 1);
    assert_eq!(result["records_added"], 2);
    assert_eq!(result["listens_added"], 0);
    assert_eq!(result["listen_history_included"], false);
    let legacy_collection = fetch_collection(&app, &legacy_cookie).await;
    assert!(
        legacy_collection
            .releases
            .iter()
            .all(|r| r.listen_count == 0)
    );
}

#[tokio::test]
async fn test_collection_restore_rejects_invalid_backups() {
    let (app, _) = setup_app().await;
    let (_, _, cookie) = create_authenticated_user(&app).await;

    // Not JSON at all
    let (status, problem) = post_restore(&app, &cookie, b"not a backup".to_vec()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(problem["status"], 400);
    assert!(
        problem["detail"]
            .as_str()
            .unwrap()
            .starts_with("Invalid backup file")
    );

    // One invalid entry rejects the whole backup; nothing is written
    let backup = json!({
        "format_version": 2,
        "releases": [
            {
                "id": 700000001, "instance_id": 1, "date_added": "2026-04-10T12:00:00Z",
                "basic_information": { "title": "Valid", "artists": [], "genres": [] },
                "listen_history": []
            },
            {
                "id": 700000002, "instance_id": 2, "date_added": "2026-04-10T12:00:00Z",
                "basic_information": { "title": "Broken", "artists": [], "genres": [] },
                "listen_history": ["not-a-date"]
            }
        ]
    });
    let (status, problem) = post_restore(&app, &cookie, serde_json::to_vec(&backup).unwrap()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let detail = problem["detail"].as_str().unwrap();
    assert!(
        detail.contains("Invalid backup entry #2 (Discogs ID 700000002)"),
        "{detail}"
    );
    assert!(fetch_collection(&app, &cookie).await.releases.is_empty());
}
