use axum::{
    Router,
    body::Body,
    extract::Path,
    http::{Method, Request, StatusCode, header},
    routing::{get, post},
};
use backend_rs::{
    clients::discogs::DiscogsClient, config::Config, db::init_pool, error::AppError,
    models::user::AppUser, routes::create_app, services::want_to_have_service::WantToHaveService,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(3100);

async fn setup_app() -> (Router, AppState) {
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

async fn json_request(
    app: &Router,
    method: Method,
    uri: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if let Some(t) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {t}"));
    }
    let req_body = match body {
        Some(b) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(serde_json::to_vec(&b).unwrap())
        }
        None => Body::empty(),
    };
    let res = app
        .clone()
        .oneshot(builder.body(req_body).unwrap())
        .await
        .unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, value)
}

async fn create_user(app: &Router) -> (i64, String) {
    let cnt = USER_COUNTER.fetch_add(1, Ordering::SeqCst);
    let username = format!(
        "wth_user_{}_{}_{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
        cnt
    );
    let creds = json!({"username": username, "password": "Password123!"});
    let (_, reg) = json_request(
        app,
        Method::POST,
        "/api/users/register",
        None,
        Some(creds.clone()),
    )
    .await;
    let id = reg["id"].as_i64().expect("id must be present");
    let (_, login) = json_request(app, Method::POST, "/api/users/login", None, Some(creds)).await;
    (id, login["token"].as_str().unwrap().to_string())
}

/// Mock Discogs: serves a release for every ID and accepts adding it to the collection.
async fn mock_discogs() -> DiscogsClient {
    let mock = Router::new()
        .route(
            "/releases/{id}",
            get(|Path(id): Path<i64>| async move {
                axum::Json(json!({
                    "id": id,
                    "title": "Kind of Blue",
                    "artists": [{"name": "Miles Davis"}],
                    "year": 1959,
                    "genres": ["Jazz"],
                    "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                    "thumb": "https://img.discogs.com/kob.jpg"
                }))
            }),
        )
        .route(
            "/users/{username}/collection/folders/0/releases/{id}",
            post(|Path((_user, id)): Path<(String, i64)>| async move {
                (
                    StatusCode::CREATED,
                    axum::Json(json!({
                        "instance_id": 7_000_000 + id,
                        "resource_url": "https://api.discogs.com/release/1"
                    })),
                )
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, mock).await.unwrap();
    });
    DiscogsClient::with_base_url(format!("http://{addr}"), "wth-test/1.0".to_string())
}

/// Loads the user with a configured (mock) Discogs token.
async fn user_with_token(state: &AppState, user_id: i64) -> AppUser {
    let enc = state.crypto.encrypt("mock_token");
    sqlx::query("UPDATE app_user SET discogs_username = $1, discogs_token = $2 WHERE id = $3")
        .bind("wth_fan")
        .bind(&enc)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .unwrap();
    sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn want_to_have_endpoints_require_authentication() {
    let (app, _) = setup_app().await;
    for (method, uri) in [
        (Method::GET, "/api/want-to-have"),
        (Method::POST, "/api/want-to-have"),
        (Method::DELETE, "/api/want-to-have/1"),
        (Method::POST, "/api/want-to-have/1/to-collection"),
    ] {
        let (status, _) = json_request(&app, method, uri, None, None).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{uri}");
    }
}

#[tokio::test]
async fn add_stores_item_and_list_returns_it_with_metadata() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    let item = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_001)
        .await
        .unwrap();
    assert_eq!(item.discogs_id, 310_001);
    assert_eq!(item.artist, "Miles Davis");
    assert_eq!(item.genres, vec!["Jazz".to_string()]);
    assert!(item.created_at.ends_with("+00:00"));

    let list = WantToHaveService::list(&state.pool, user_id).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, item.id);
}

#[tokio::test]
async fn add_twice_returns_conflict_and_keeps_one_entry() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_002)
        .await
        .unwrap();
    let err = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_002)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)));
    assert_eq!(
        WantToHaveService::list(&state.pool, user_id)
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn add_returns_conflict_when_record_is_in_collection() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    // Owned record: add it to the collection first
    backend_rs::services::collection_sync::CollectionSyncService::add_release_and_sync(
        &state.pool,
        &client,
        &state.crypto,
        &user,
        310_003,
    )
    .await
    .unwrap();

    let err = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_003)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)));
    assert!(
        WantToHaveService::list(&state.pool, user_id)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn add_requires_discogs_token_and_valid_id() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let client = mock_discogs().await;
    let no_token = sqlx::query_as::<_, AppUser>(
        "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token FROM app_user WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();

    let err = WantToHaveService::add(&state.pool, &client, &state.crypto, &no_token, 310_004)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)));

    let err = WantToHaveService::add(&state.pool, &client, &state.crypto, &no_token, -5)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)));
}

#[tokio::test]
async fn list_and_remove_are_scoped_to_the_user() {
    let (app, state) = setup_app().await;
    let (user_a, token_a) = create_user(&app).await;
    let (user_b, token_b) = create_user(&app).await;
    let a = user_with_token(&state, user_a).await;
    let client = mock_discogs().await;

    let item = WantToHaveService::add(&state.pool, &client, &state.crypto, &a, 310_005)
        .await
        .unwrap();

    let (status, list_b) =
        json_request(&app, Method::GET, "/api/want-to-have", Some(&token_b), None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(list_b.as_array().unwrap().is_empty());
    let _ = user_b;

    let uri = format!("/api/want-to-have/{}", item.id);
    let (status, _) = json_request(&app, Method::DELETE, &uri, Some(&token_b), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, list_a) =
        json_request(&app, Method::GET, "/api/want-to-have", Some(&token_a), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(list_a.as_array().unwrap().len(), 1);
    assert_eq!(list_a[0]["discogs_id"], 310_005);

    let (status, _) = json_request(&app, Method::DELETE, &uri, Some(&token_a), None).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_, list_a) =
        json_request(&app, Method::GET, "/api/want-to-have", Some(&token_a), None).await;
    assert!(list_a.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn status_reports_collection_and_want_to_have_ids() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_006)
        .await
        .unwrap();
    backend_rs::services::collection_sync::CollectionSyncService::add_release_and_sync(
        &state.pool,
        &client,
        &state.crypto,
        &user,
        310_007,
    )
    .await
    .unwrap();

    let status = WantToHaveService::status(&state.pool, user_id, &[310_006, 310_007, 310_008])
        .await
        .unwrap();
    assert_eq!(status.in_want_to_have, vec![310_006]);
    assert_eq!(status.in_collection, vec![310_007]);
}

#[tokio::test]
async fn list_leaves_out_records_that_are_owned_meanwhile() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_011)
        .await
        .unwrap();
    // Added to the collection by another path (scanner, label inbox, sync)
    backend_rs::services::collection_sync::CollectionSyncService::add_release_and_sync(
        &state.pool,
        &client,
        &state.crypto,
        &user,
        310_011,
    )
    .await
    .unwrap();

    assert!(
        WantToHaveService::list(&state.pool, user_id)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn to_collection_does_not_add_a_copy_of_an_owned_record() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    let item = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_012)
        .await
        .unwrap();
    backend_rs::services::collection_sync::CollectionSyncService::add_release_and_sync(
        &state.pool,
        &client,
        &state.crypto,
        &user,
        310_012,
    )
    .await
    .unwrap();

    let result =
        WantToHaveService::to_collection(&state.pool, &client, &state.crypto, &user, item.id)
            .await
            .unwrap();
    assert_eq!(result.added, 0);
    let copies: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM collection_item ci JOIN record_cache rc ON rc.id = ci.record_id
         WHERE ci.user_id = $1 AND rc.discogs_id = 310012",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    assert_eq!(copies, 1);
    let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM want_to_have_item WHERE id = $1")
        .bind(item.id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_eq!(remaining, 0);
}

#[tokio::test]
async fn to_collection_twice_adds_only_one_copy() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    let item = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_013)
        .await
        .unwrap();
    WantToHaveService::to_collection(&state.pool, &client, &state.crypto, &user, item.id)
        .await
        .unwrap();
    let again =
        WantToHaveService::to_collection(&state.pool, &client, &state.crypto, &user, item.id)
            .await
            .unwrap_err();
    assert!(matches!(again, AppError::NotFound(_)));
}

#[tokio::test]
async fn to_collection_moves_record_and_removes_entry() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    let item = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_009)
        .await
        .unwrap();
    let result =
        WantToHaveService::to_collection(&state.pool, &client, &state.crypto, &user, item.id)
            .await
            .unwrap();
    assert_eq!(result.added, 1);

    assert!(
        WantToHaveService::list(&state.pool, user_id)
            .await
            .unwrap()
            .is_empty()
    );
    let owned: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM collection_item ci JOIN record_cache rc ON rc.id = ci.record_id
         WHERE ci.user_id = $1 AND rc.discogs_id = 310009",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap();
    assert_eq!(owned, 1);
}

#[tokio::test]
async fn to_collection_keeps_entry_when_discogs_fails() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;

    let item = WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 310_010)
        .await
        .unwrap();
    // Unreachable Discogs: adding to the collection fails
    let dead = DiscogsClient::with_base_url("http://127.0.0.1:1".to_string(), "t/1.0".to_string());
    let err =
        WantToHaveService::to_collection(&state.pool, &dead, &state.crypto, &user, item.id).await;
    assert!(err.is_err());
    assert_eq!(
        WantToHaveService::list(&state.pool, user_id)
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn to_collection_of_unknown_entry_is_not_found() {
    let (app, state) = setup_app().await;
    let (user_id, _) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;
    let err =
        WantToHaveService::to_collection(&state.pool, &client, &state.crypto, &user, 999_999_999)
            .await
            .unwrap_err();
    assert!(matches!(err, AppError::NotFound(_)));
}

// --- JSON backup (#313) ---

async fn export_backup(app: &Router, token: &str) -> Value {
    let (status, backup) = json_request(
        app,
        Method::GET,
        "/api/collection/export?format=json",
        Some(token),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    backup
}

#[tokio::test]
async fn backup_exports_and_restores_want_to_have_list() {
    let (app, state) = setup_app().await;
    let (user_id, token) = create_user(&app).await;
    let user = user_with_token(&state, user_id).await;
    let client = mock_discogs().await;
    WantToHaveService::add(&state.pool, &client, &state.crypto, &user, 313_001)
        .await
        .unwrap();
    let original = WantToHaveService::list(&state.pool, user_id).await.unwrap();

    let backup = export_backup(&app, &token).await;
    assert_eq!(backup["format_version"], 6);
    let exported = backup["want_to_have"].as_array().unwrap();
    assert_eq!(exported.len(), 1);
    assert_eq!(exported[0]["discogs_id"], 313_001);
    assert_eq!(exported[0]["artist"], "Miles Davis");
    assert_eq!(exported[0]["created_at"], original[0].created_at);

    // Another account restores it, keeping the original timestamp
    let (other_id, other_token) = create_user(&app).await;
    let (status, result) = json_request(
        &app,
        Method::POST,
        "/api/collection/restore",
        Some(&other_token),
        Some(backup.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["want_to_have_added"], 1);
    assert_eq!(result["want_to_have_skipped"], 0);
    let restored = WantToHaveService::list(&state.pool, other_id)
        .await
        .unwrap();
    assert_eq!(restored.len(), 1);
    assert_eq!(restored[0].discogs_id, 313_001);
    assert_eq!(restored[0].title, "Kind of Blue");
    assert_eq!(restored[0].created_at, original[0].created_at);

    // A second restore creates no duplicate
    let (_, again) = json_request(
        &app,
        Method::POST,
        "/api/collection/restore",
        Some(&other_token),
        Some(backup),
    )
    .await;
    assert_eq!(again["want_to_have_added"], 0);
    assert_eq!(again["want_to_have_skipped"], 1);
    assert_eq!(
        WantToHaveService::list(&state.pool, other_id)
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn backup_without_want_to_have_section_still_restores() {
    let (app, state) = setup_app().await;
    let (user_id, token) = create_user(&app).await;
    let body = json!({ "format_version": 5, "releases": [] });
    let (status, result) = json_request(
        &app,
        Method::POST,
        "/api/collection/restore",
        Some(&token),
        Some(body),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["want_to_have_added"], 0);
    assert_eq!(result["want_to_have_skipped"], 0);
    assert!(
        WantToHaveService::list(&state.pool, user_id)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn restore_skips_want_to_have_entries_for_owned_records() {
    let (app, state) = setup_app().await;
    let (user_id, token) = create_user(&app).await;
    let body = json!({
        "format_version": 6,
        "releases": [{
            "id": 313_002,
            "instance_id": 913_002,
            "basic_information": { "title": "Kind of Blue", "artists": [{"name": "Miles Davis"}] }
        }],
        "want_to_have": [
            { "discogs_id": 313_002, "title": "Kind of Blue", "artist": "Miles Davis" },
            { "discogs_id": 313_003, "title": "Blue Train", "artist": "John Coltrane" }
        ]
    });
    let (status, result) = json_request(
        &app,
        Method::POST,
        "/api/collection/restore",
        Some(&token),
        Some(body),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["want_to_have_added"], 1);
    assert_eq!(result["want_to_have_skipped"], 1);
    let list = WantToHaveService::list(&state.pool, user_id).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].discogs_id, 313_003);
}

#[tokio::test]
async fn restore_rejects_invalid_want_to_have_entry() {
    let (app, _) = setup_app().await;
    let (_, token) = create_user(&app).await;
    for entry in [
        json!({ "discogs_id": 0, "title": "X" }),
        json!({ "discogs_id": 5, "title": "  " }),
        json!({ "discogs_id": 5, "title": "X", "created_at": "yesterday" }),
    ] {
        let body = json!({ "format_version": 6, "releases": [], "want_to_have": [entry] });
        let (status, problem) = json_request(
            &app,
            Method::POST,
            "/api/collection/restore",
            Some(&token),
            Some(body),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert!(
            problem["detail"]
                .as_str()
                .unwrap()
                .contains("Want-to-Have entry #1")
        );
    }
}
