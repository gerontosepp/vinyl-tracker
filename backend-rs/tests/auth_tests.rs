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

#[tokio::test]
async fn test_register_login_and_me_lifecycle() {
    let (app, _) = setup_app().await;

    let test_username = format!("testuser_{}", chrono::Utc::now().timestamp_millis());
    let test_password = "SecurePassword123!";

    // 1. Register new user
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

    assert_eq!(reg_res.status(), StatusCode::OK);
    let set_cookie_hdr = reg_res
        .headers()
        .get(header::SET_COOKIE)
        .expect("Must set auth cookie on register");
    assert!(set_cookie_hdr.to_str().unwrap().contains("vinyl_token="));

    let reg_bytes = reg_res.into_body().collect().await.unwrap().to_bytes();
    let reg_json: Value = serde_json::from_slice(&reg_bytes).unwrap();
    assert_eq!(reg_json["username"], test_username);
    let token = reg_json["token"]
        .as_str()
        .expect("Registration must return JWT token")
        .to_string();

    // 2. Duplicate registration must fail with 409 Conflict
    let dup_res = app
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
    assert_eq!(dup_res.status(), StatusCode::CONFLICT);

    // 3. Login with wrong password must fail with 401 Unauthorized
    let bad_login_payload = json!({
        "username": test_username,
        "password": "WrongPassword!"
    });
    let bad_login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&bad_login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bad_login_res.status(), StatusCode::UNAUTHORIZED);

    // 4. Login with correct password
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
    assert_eq!(login_res.status(), StatusCode::OK);

    // 5. Query /api/users/me with Bearer token
    let me_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/users/me")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me_res.status(), StatusCode::OK);
    let me_bytes = me_res.into_body().collect().await.unwrap().to_bytes();
    let me_json: Value = serde_json::from_slice(&me_bytes).unwrap();
    assert_eq!(me_json["username"], test_username);

    // 6. Query /api/users/me without token -> 401 Unauthorized
    let unauth_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/users/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauth_res.status(), StatusCode::UNAUTHORIZED);

    // 7. Update Discogs credentials via /api/users/me/discogs
    let discogs_payload = json!({
        "discogsUsername": "discogs_tester",
        "token": "discogs_secret_pat_987654321"
    });
    let discogs_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/api/users/me/discogs")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&discogs_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(discogs_res.status(), StatusCode::OK);

    // Verify /api/users/me now reflects hasDiscogsToken = true
    let me_discogs_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/users/me")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let me_discogs_bytes = me_discogs_res.into_body().collect().await.unwrap().to_bytes();
    let me_discogs_json: Value = serde_json::from_slice(&me_discogs_bytes).unwrap();
    assert_eq!(me_discogs_json["discogsUsername"], "discogs_tester");
    assert_eq!(me_discogs_json["hasDiscogsToken"], true);

    // 8. Logout clears cookie
    let logout_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/logout")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(logout_res.status(), StatusCode::OK);
    let clear_cookie = logout_res
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(clear_cookie.contains("Max-Age=0"));
}

#[tokio::test]
async fn test_existing_database_discogs_token_decryption() {
    let (_, state) = setup_app().await;

    // Check if opolm user exists in DB and verify their encrypted Discogs token can be decrypted
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT discogs_username, discogs_token FROM app_user WHERE username = 'opolm'"
    )
    .fetch_optional(&state.pool)
    .await
    .unwrap();

    if let Some((discogs_user, Some(enc_token))) = row {
        assert_eq!(discogs_user, "gerontosepp");
        let decrypted = state.crypto.decrypt(&enc_token);
        assert!(decrypted.is_some(), "Existing database token must decrypt cleanly");
        let pat = decrypted.unwrap();
        assert!(!pat.is_empty(), "Decrypted token must not be empty");
    }
}

#[tokio::test]
async fn test_legacy_user_login() {
    let (app, _) = setup_app().await;

    let login_payload = json!({
        "username": "max_mustermann",
        "password": "secret"
    });

    let res = app
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

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["username"], "max_mustermann");
    assert!(json["token"].is_string());
}

#[tokio::test]
async fn test_reset_password_flow() {
    let (app, _) = setup_app().await;

    let test_user = format!("pw_reset_user_{}", chrono::Utc::now().timestamp_millis());
    let initial_pw = "InitialPassword123!";
    let new_pw = "NewPassword1234567!";

    // 1. Register
    let reg_payload = json!({
        "username": test_user,
        "password": initial_pw
    });
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/register")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&reg_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    // 2. Reset password
    let reset_payload = json!({
        "username": test_user,
        "newPassword": new_pw
    });
    let reset_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/reset-password")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&reset_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reset_res.status(), StatusCode::OK);

    // 3. Old password must now fail
    let old_login_payload = json!({
        "username": test_user,
        "password": initial_pw
    });
    let old_login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&old_login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(old_login_res.status(), StatusCode::UNAUTHORIZED);

    // 4. New password must succeed
    let new_login_payload = json!({
        "username": test_user,
        "password": new_pw
    });
    let new_login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&new_login_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(new_login_res.status(), StatusCode::OK);
}
