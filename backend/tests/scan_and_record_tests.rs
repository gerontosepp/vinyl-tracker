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
    assert_eq!(
        details.media_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );

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
    assert_eq!(
        patched.sleeve_condition.as_deref(),
        Some("Near Mint (NM or M-)")
    );
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
    assert!(
        scan_res["message"]
            .as_str()
            .unwrap()
            .contains("Random Access Memories")
    );
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
                .body(Body::from(
                    serde_json::to_vec(&de_keyboard_payload).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // Verify 2 listen events exist in DB
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM listen_event WHERE user_id = $1 AND record_id = $2",
    )
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
    let count_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM listen_event WHERE user_id = $1")
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

#[tokio::test]
async fn test_scan_service_comprehensive_scenarios() {
    use axum::{
        Router,
        extract::{Path, Query},
        routing::get,
    };
    use backend_rs::{
        clients::discogs::DiscogsClient, error::AppError, models::user::AppUser,
        services::scan_service::ScanService,
    };
    use std::collections::HashMap;

    let (app, state) = setup_app().await;
    let (user_id, _, _) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    // 1. Spawning mock Discogs HTTP Server
    let mock_discogs = Router::new()
        .route(
            "/releases/{id}",
            get(|Path(id): Path<i64>| async move {
                if id == 404404 {
                    (
                        StatusCode::NOT_FOUND,
                        axum::Json(json!({"message": "Not Found"})),
                    )
                } else {
                    (
                        StatusCode::OK,
                        axum::Json(json!({
                            "id": id,
                            "title": format!("Mock Album {id}"),
                            "artists": [{"name": "Mock Artist"}],
                            "year": 2020,
                            "genres": ["Rock", "Indie"],
                            "styles": ["Alternative"],
                            "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                            "labels": [{"name": "Mock Records", "catno": "MOCK-1"}],
                            "thumb": "https://img.discogs.com/mock.jpg",
                            "lowest_price": 25.50
                        })),
                    )
                }
            }),
        )
        .route(
            "/database/search",
            get(|Query(params): Query<HashMap<String, String>>| async move {
                let barcode = params.get("barcode").cloned().unwrap_or_default();
                let q = params.get("q").cloned().unwrap_or_default();

                let results = if barcode == "012345678901" {
                    vec![json!({
                        "id": 554433,
                        "title": "Direct Match Album",
                        "year": "2021",
                        "thumb": "https://img.discogs.com/thumb.jpg",
                        "cover_image": "https://img.discogs.com/cover.jpg",
                        "format": ["Vinyl"],
                        "country": "Germany"
                    })]
                } else if barcode == "0123456789012" {
                    vec![json!({
                        "id": 554434,
                        "title": "EAN Match Album",
                        "year": "2022",
                        "thumb": "https://img.discogs.com/thumb.jpg",
                        "cover_image": "https://img.discogs.com/cover.jpg",
                        "format": ["Vinyl"],
                        "country": "US"
                    })]
                } else if barcode == "234567890123" {
                    vec![json!({
                        "id": 554435,
                        "title": "UPC Match Album",
                        "year": "2023",
                        "thumb": "https://img.discogs.com/thumb.jpg",
                        "cover_image": "https://img.discogs.com/cover.jpg",
                        "format": ["Vinyl"],
                        "country": "UK"
                    })]
                } else if q == "SOMEBARCODE" {
                    vec![json!({
                        "id": 554436,
                        "title": "Query Match Album",
                        "year": "2024",
                        "thumb": "https://img.discogs.com/thumb.jpg",
                        "cover_image": "https://img.discogs.com/cover.jpg",
                        "format": ["Vinyl"],
                        "country": "Japan"
                    })]
                } else if barcode == "999999999999" {
                    vec![json!({
                        "id": 888888,
                        "title": "Not In Collection Album",
                        "year": "2019",
                        "thumb": "https://img.discogs.com/thumb.jpg",
                        "cover_image": "https://img.discogs.com/cover.jpg",
                        "format": ["Vinyl"],
                        "country": "France"
                    })]
                } else {
                    vec![]
                };

                axum::Json(json!({
                    "pagination": {
                        "page": 1,
                        "pages": 1,
                        "per_page": 50,
                        "items": results.len()
                    },
                    "results": results
                }))
            }),
        )
        .route(
            "/users/{username}/collection/releases/{id}",
            get(|Path((_user, id)): Path<(String, i64)>| async move {
                if id == 888888 || id == 404404 {
                    (
                        StatusCode::NOT_FOUND,
                        axum::Json(json!({"message": "Not in collection"})),
                    )
                } else {
                    (
                        StatusCode::OK,
                        axum::Json(json!({
                            "pagination": {"page": 1, "pages": 1, "per_page": 50, "items": 1},
                            "releases": [{
                                "id": id,
                                "instance_id": 999,
                                "basic_information": {
                                    "id": id,
                                    "title": format!("Mock Album {id}")
                                }
                            }]
                        })),
                    )
                }
            }),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind ephemeral port");
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, mock_discogs).await.unwrap();
    });

    let mock_client =
        DiscogsClient::with_base_url(format!("http://{addr}"), "scan-test/1.0".to_string());

    let user_no_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap();

    // 2. Custom QR with non-numeric payload -> BadRequest
    let err_qr = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_no_token,
        "vt:invalid-id",
    )
    .await;
    assert!(matches!(err_qr, Err(AppError::BadRequest(_))));

    // 3. Custom QR not in DB and user has no token -> returns unsuccessful scan result
    let not_found_qr = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_no_token,
        "vt:999888",
    )
    .await
    .unwrap();
    assert!(!not_found_qr.success);
    assert!(not_found_qr.record.is_none());

    // 4. Standard barcode scan without token -> BadRequest
    let err_barcode = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_no_token,
        "012345678901",
    )
    .await;
    assert!(matches!(err_barcode, Err(AppError::BadRequest(_))));

    // Configure Discogs token
    let enc_token = state.crypto.encrypt("mock_scan_token");
    sqlx::query("UPDATE app_user SET discogs_username = $1, discogs_token = $2 WHERE id = $3")
        .bind("scanner_guy")
        .bind(&enc_token)
        .bind(user_id)
        .execute(pool)
        .await
        .unwrap();

    let user_with_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap();

    // 5. Custom QR code not in local DB -> fetched from Discogs API and persisted
    let discogs_qr = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "discogs-id:771122",
    )
    .await
    .unwrap();
    assert!(discogs_qr.success);
    assert_eq!(discogs_qr.record.unwrap().discogs_id, 771122);

    // Verify persisted in DB
    let genre_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM record_genres rg JOIN record_cache rc ON rc.id = rg.record_id WHERE rc.discogs_id = 771122")
        .fetch_one(pool)
        .await
        .unwrap();
    assert!(genre_count >= 2);

    // 6. Direct barcode match in local collection
    let seed_id = 554433i64;
    let seed_row = sqlx::query("INSERT INTO record_cache (discogs_id, title, artist, release_year, format) VALUES ($1, 'Direct Match', 'Artist', '2021', 'Vinyl') ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title RETURNING id")
        .bind(seed_id)
        .fetch_one(pool)
        .await
        .unwrap();
    let local_rec_id: i64 = seed_row.get("id");
    sqlx::query("INSERT INTO collection_item (user_id, record_id, instance_id, added_at) VALUES ($1, $2, 991122, NOW()) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .bind(local_rec_id)
        .execute(pool)
        .await
        .unwrap();

    let direct_scan = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "012345678901",
    )
    .await
    .unwrap();
    assert!(direct_scan.success);

    // 7. 12-digit barcode fallback to 13-digit EAN (0 + barcode) -> found in remote collection
    let ean_scan = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "123456789012",
    )
    .await
    .unwrap();
    assert!(ean_scan.success);

    // 8. 13-digit barcode with leading 0 fallback to 12-digit UPC -> found in remote collection
    let upc_scan = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "0234567890123",
    )
    .await
    .unwrap();
    assert!(upc_scan.success);

    // 9. Query fallback search
    let q_scan = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "SOMEBARCODE",
    )
    .await
    .unwrap();
    assert!(q_scan.success);

    // 10. Discogs matches found, but none in user's collection
    let not_in_coll = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "999999999999",
    )
    .await
    .unwrap();
    assert!(!not_in_coll.success);
    assert!(not_in_coll.discogs_matches.is_some());
    assert_eq!(not_in_coll.discogs_matches.unwrap().len(), 1);

    // 11. No results found on Discogs
    let no_match = ScanService::process_scan(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        "000000000000",
    )
    .await
    .unwrap();
    assert!(!no_match.success);
    assert!(no_match.discogs_matches.is_none());

    // 12. delete_scan not found error
    let del_err = ScanService::delete_scan(pool, user_id, 99999999).await;
    assert!(matches!(del_err, Err(AppError::NotFound(_))));
}

#[tokio::test]
async fn test_record_service_comprehensive_scenarios() {
    use axum::{
        Router,
        extract::Path,
        routing::{get, post},
    };
    use backend_rs::{
        clients::discogs::DiscogsClient,
        error::AppError,
        models::{record::UpdateConditionRequestDto, user::AppUser},
        services::record_service::RecordService,
    };

    let (app, state) = setup_app().await;
    let (user_id, _, _) = create_authenticated_user(&app).await;
    let pool = &state.pool;

    let mock_discogs = Router::new()
        .route(
            "/releases/{id}",
            get(|Path(id): Path<i64>| async move {
                if id == 404404 {
                    (StatusCode::NOT_FOUND, axum::Json(json!({"message": "Not Found"})))
                } else {
                    (
                        StatusCode::OK,
                        axum::Json(json!({
                            "id": id,
                            "title": format!("Discogs Record {id}"),
                            "artists": [{"name": "Miles Davis"}],
                            "year": 1959,
                            "genres": ["Jazz"],
                            "styles": ["Modal"],
                            "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                            "labels": [{"name": "Columbia", "catno": "CL 1355"}],
                            "thumb": "https://img.discogs.com/miles.jpg",
                            "lowest_price": 50.0
                        })),
                    )
                }
            }),
        )
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
            "/users/{username}/collection/folders/0/releases/{id}/instances/{instance_id}/fields/{field_id}",
            post(|| async { StatusCode::NO_CONTENT }),
        )
        .route(
            "/marketplace/price_suggestions/{id}",
            get(|| async {
                axum::Json(json!({
                    "Near Mint (NM or M-)": {
                        "currency": "EUR",
                        "value": 120.0
                    },
                    "Very Good Plus (VG+)": {
                        "currency": "EUR",
                        "value": 85.0
                    }
                }))
            }),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind ephemeral port");
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, mock_discogs).await.unwrap();
    });

    let mock_client =
        DiscogsClient::with_base_url(format!("http://{addr}"), "record-test/1.0".to_string());

    // User without credentials
    let user_no_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap();

    // 1. Record not found locally and no token -> NotFound
    let not_found_err = RecordService::get_record_details(
        pool,
        &mock_client,
        &state.crypto,
        &user_no_token,
        999999,
    )
    .await;
    assert!(matches!(not_found_err, Err(AppError::NotFound(_))));

    // Configure Discogs token & username
    let enc_token = state.crypto.encrypt("mock_record_token");
    sqlx::query("UPDATE app_user SET discogs_username = $1, discogs_token = $2 WHERE id = $3")
        .bind("record_fan")
        .bind(&enc_token)
        .bind(user_id)
        .execute(pool)
        .await
        .unwrap();

    let user_with_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap();

    // 2. Record not found in local DB, but fetched from Discogs
    let discogs_details = RecordService::get_record_details(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        665544,
    )
    .await
    .unwrap();
    assert_eq!(discogs_details.discogs_id, 665544);
    assert_eq!(
        discogs_details.title.as_deref(),
        Some("Discogs Record 665544")
    );
    assert!(!discogs_details.in_collection);

    // 3. Record in collection without median price -> fetches price suggestions
    let row = sqlx::query("INSERT INTO record_cache (discogs_id, title, artist, release_year, format) VALUES (665545, 'Blue Train', 'John Coltrane', '1957', 'Vinyl') ON CONFLICT (discogs_id) DO UPDATE SET title = EXCLUDED.title, median_price = NULL RETURNING id")
        .fetch_one(pool)
        .await
        .unwrap();
    let coltrane_rec_id: i64 = row.get("id");
    sqlx::query("INSERT INTO collection_item (user_id, record_id, instance_id, media_condition, added_at) VALUES ($1, $2, 334455, 'Very Good Plus (VG+)', NOW()) ON CONFLICT (user_id, instance_id) DO UPDATE SET media_condition = EXCLUDED.media_condition")
        .bind(user_id)
        .bind(coltrane_rec_id)
        .execute(pool)
        .await
        .unwrap();

    let details_with_suggested_price = RecordService::get_record_details(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        665545,
    )
    .await
    .unwrap();
    assert_eq!(details_with_suggested_price.median_price, Some(85.0));

    // 4. Update condition validation errors
    let err_not_found = RecordService::update_condition(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        9999999,
        UpdateConditionRequestDto {
            media_condition: Some("Mint (M)".to_string()),
            sleeve_condition: None,
        },
    )
    .await;
    assert!(matches!(err_not_found, Err(AppError::NotFound(_))));

    let err_invalid_grade = RecordService::update_condition(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        665545,
        UpdateConditionRequestDto {
            media_condition: Some("Ultra Shiny".to_string()),
            sleeve_condition: None,
        },
    )
    .await;
    assert!(matches!(err_invalid_grade, Err(AppError::BadRequest(_))));

    // 5. Update condition success with Discogs sync
    let updated = RecordService::update_condition(
        pool,
        &mock_client,
        &state.crypto,
        &user_with_token,
        665545,
        UpdateConditionRequestDto {
            media_condition: Some("Near Mint (NM or M-)".to_string()),
            sleeve_condition: Some("Very Good Plus (VG+)".to_string()),
        },
    )
    .await
    .unwrap();
    assert_eq!(
        updated.media_condition.as_deref(),
        Some("Near Mint (NM or M-)")
    );
    assert_eq!(
        updated.sleeve_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );
    assert_eq!(updated.median_price, Some(120.0));

    // 6. log_listen for record not yet in local DB
    let listened =
        RecordService::log_listen(pool, &mock_client, &state.crypto, &user_with_token, 665546)
            .await
            .unwrap();
    assert_eq!(listened.discogs_id, 665546);
    assert_eq!(listened.listen_count, 1);
}
