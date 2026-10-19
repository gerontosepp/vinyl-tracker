use axum::extract::ConnectInfo;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{
    auth::client_ip::parse_trusted_proxies, config::Config, db::init_pool, routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use std::net::SocketAddr;
use tower::ServiceExt;

async fn setup_app_with_config(config: Config) -> (axum::Router, AppState) {
    dotenvy::dotenv().ok();
    let _ = backend_rs::db::migrations::run_migrations(&config.database_url).await;
    let pool = init_pool(&config)
        .await
        .expect("PostgreSQL must be accessible for integration tests");
    let state = AppState::new(pool, config);
    let app = create_app(state.clone());
    (app, state)
}

async fn setup_app() -> (axum::Router, AppState) {
    let config = Config::from_env();
    setup_app_with_config(config).await
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
    let me_discogs_bytes = me_discogs_res
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
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
        "SELECT discogs_username, discogs_token FROM app_user WHERE username = 'opolm'",
    )
    .fetch_optional(&state.pool)
    .await
    .unwrap();

    if let Some((discogs_user, Some(enc_token))) = row {
        assert_eq!(discogs_user, "gerontosepp");
        let decrypted = state.crypto.decrypt(&enc_token);
        assert!(
            decrypted.is_some(),
            "Existing database token must decrypt cleanly"
        );
        let pat = decrypted.unwrap();
        assert!(!pat.is_empty(), "Decrypted token must not be empty");
    }
}

#[tokio::test]
async fn test_legacy_user_login() {
    let (app, state) = setup_app().await;

    // Ensure max_mustermann exists in database
    let user_exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM app_user WHERE username = 'max_mustermann'")
            .fetch_optional(&state.pool)
            .await
            .unwrap();

    let hashed = bcrypt::hash("secret", 10).expect("Must hash password");
    if user_exists.is_none() {
        sqlx::query("INSERT INTO app_user (username, password) VALUES ($1, $2)")
            .bind("max_mustermann")
            .bind(&hashed)
            .execute(&state.pool)
            .await
            .expect("Must insert legacy test user");
    } else {
        sqlx::query("UPDATE app_user SET password = $1 WHERE username = 'max_mustermann'")
            .bind(&hashed)
            .execute(&state.pool)
            .await
            .expect("Must ensure legacy test user has bcrypt password");
    }

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
    let reg_res = app
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
    assert_eq!(reg_res.status(), StatusCode::OK);
    let reg_bytes = reg_res.into_body().collect().await.unwrap().to_bytes();
    let reg_json: Value = serde_json::from_slice(&reg_bytes).unwrap();
    let reg_token = reg_json["token"].as_str().unwrap();

    // 2. Unverified reset attempt (no credentials / token) MUST be rejected with 401 Unauthorized
    let unverified_payload = json!({
        "username": test_user,
        "newPassword": new_pw
    });
    let unverified_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/reset-password")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&unverified_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unverified_res.status(), StatusCode::UNAUTHORIZED);

    // 3. Link Discogs credentials
    let discogs_token = "valid_discogs_pat_token_12345";
    let discogs_payload = json!({
        "discogsUsername": "d_user",
        "token": discogs_token
    });
    let discogs_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/api/users/me/discogs")
                .header(header::AUTHORIZATION, format!("Bearer {reg_token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&discogs_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(discogs_res.status(), StatusCode::OK);

    // 4. Reset attempt with WRONG Discogs token MUST be rejected with 401 Unauthorized
    let wrong_token_payload = json!({
        "username": test_user,
        "newPassword": new_pw,
        "discogsToken": "invalid_wrong_pat_token"
    });
    let wrong_token_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/reset-password")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    serde_json::to_vec(&wrong_token_payload).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(wrong_token_res.status(), StatusCode::UNAUTHORIZED);

    // 5. Reset attempt with CORRECT Discogs token succeeds
    let correct_payload = json!({
        "username": test_user,
        "newPassword": new_pw,
        "discogsToken": discogs_token
    });
    let reset_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/reset-password")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&correct_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reset_res.status(), StatusCode::OK);
    // Ensure no automatic session/auth cookie is returned
    assert!(reset_res.headers().get(header::SET_COOKIE).is_none());
    let reset_bytes = reset_res.into_body().collect().await.unwrap().to_bytes();
    let reset_json: Value = serde_json::from_slice(&reset_bytes).unwrap();
    assert!(reset_json["token"].is_null());

    // 6. Old password must now fail
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

    // 7. New password must succeed
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

    // 8. Password change using currentPassword also succeeds
    let newer_pw = "NewerPassword7890!";
    let change_payload = json!({
        "username": test_user,
        "newPassword": newer_pw,
        "currentPassword": new_pw
    });
    let change_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/reset-password")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&change_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(change_res.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_plaintext_password_is_rejected() {
    let (app, state) = setup_app().await;

    let test_user = format!("plain_user_{}", chrono::Utc::now().timestamp_millis());
    let plaintext_pw = "PlaintextPassword123!";

    // Insert user with unhashed plaintext password
    sqlx::query("INSERT INTO app_user (username, password) VALUES ($1, $2)")
        .bind(&test_user)
        .bind(plaintext_pw)
        .execute(&state.pool)
        .await
        .expect("Must insert user with plaintext password");

    let login_payload = json!({
        "username": test_user,
        "password": plaintext_pw
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

    assert_eq!(
        res.status(),
        StatusCode::UNAUTHORIZED,
        "Plaintext passwords must never be accepted for login"
    );
}

#[tokio::test]
async fn test_update_discogs_stores_modern_aead_format() {
    let (app, state) = setup_app().await;

    let test_user = format!(
        "discogs_aead_user_{}",
        chrono::Utc::now().timestamp_millis()
    );
    let password = "ValidPassword123!";
    let secret_token = "discogs_pat_super_secret_456789";

    // 1. Register user
    let reg_payload = json!({
        "username": test_user,
        "password": password
    });
    let reg_res = app
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
    assert_eq!(reg_res.status(), StatusCode::OK);

    let reg_bytes = reg_res.into_body().collect().await.unwrap().to_bytes();
    let reg_json: Value = serde_json::from_slice(&reg_bytes).unwrap();
    let token = reg_json["token"].as_str().unwrap();

    // 2. Update Discogs settings
    let update_payload = json!({
        "discogsUsername": "modern_discogs_user",
        "token": secret_token
    });
    let update_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri("/api/users/me/discogs")
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::from(serde_json::to_vec(&update_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_res.status(), StatusCode::OK);

    // 3. Inspect encrypted value in database: must start with modern v2: prefix
    let db_token: Option<String> =
        sqlx::query_scalar("SELECT discogs_token FROM app_user WHERE username = $1")
            .bind(&test_user)
            .fetch_one(&state.pool)
            .await
            .unwrap();

    let enc_token = db_token.expect("discogs_token must be persisted in database");
    assert!(
        enc_token.starts_with("v2:"),
        "Newly persisted Discogs token must use modern AES-256-GCM format starting with 'v2:', got: {enc_token}"
    );

    // 4. Decrypt via CryptoService: must match original plaintext
    let decrypted = state.crypto.decrypt(&enc_token);
    assert_eq!(
        decrypted.as_deref(),
        Some(secret_token),
        "CryptoService must decrypt modern AEAD token correctly"
    );
}

#[tokio::test]
async fn test_configurable_cookie_attributes() {
    let mut config = Config::from_env();
    config.auth_cookie_name = "custom_auth_cookie".to_string();
    config.auth_cookie_secure = true;
    config.auth_cookie_same_site = "Strict".to_string();
    config.auth_cookie_max_age_secs = 3600;
    config.auth_cookie_domain = Some("example.com".to_string());

    let (app, _) = setup_app_with_config(config).await;

    let test_user = format!("cookie_user_{}", chrono::Utc::now().timestamp_millis());
    let password = "ValidPassword123!";

    // 1. Register
    let reg_payload = json!({
        "username": test_user,
        "password": password
    });
    let reg_res = app
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
    assert_eq!(reg_res.status(), StatusCode::OK);

    let set_cookie = reg_res
        .headers()
        .get(header::SET_COOKIE)
        .expect("Must have Set-Cookie header")
        .to_str()
        .unwrap();

    assert!(set_cookie.starts_with("custom_auth_cookie="));
    assert!(set_cookie.contains("Secure"));
    assert!(set_cookie.contains("SameSite=Strict"));
    assert!(set_cookie.contains("Max-Age=3600"));
    assert!(set_cookie.contains("Domain=example.com"));
    assert!(set_cookie.contains("HttpOnly"));

    let cookie_val = set_cookie.split(';').next().unwrap();
    let token = cookie_val.strip_prefix("custom_auth_cookie=").unwrap();

    // 2. Access /me using the custom cookie name
    let me_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/users/me")
                .header(header::COOKIE, format!("custom_auth_cookie={token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me_res.status(), StatusCode::OK);

    // 3. Logout clears custom cookie with matching attributes
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
        .expect("Must have Set-Cookie header on logout")
        .to_str()
        .unwrap();

    assert!(clear_cookie.starts_with("custom_auth_cookie="));
    assert!(clear_cookie.contains("Max-Age=0"));
    assert!(clear_cookie.contains("Secure"));
    assert!(clear_cookie.contains("Domain=example.com"));
}

fn login_request_from(peer: &str, forwarded_for: Option<&str>, payload: &Value) -> Request<Body> {
    let mut builder = Request::builder()
        .method(Method::POST)
        .uri("/api/users/login")
        .header(header::CONTENT_TYPE, "application/json")
        .extension(ConnectInfo(SocketAddr::new(peer.parse().unwrap(), 40000)));
    if let Some(forwarded_for) = forwarded_for {
        builder = builder.header("x-forwarded-for", forwarded_for);
    }
    builder
        .body(Body::from(serde_json::to_vec(payload).unwrap()))
        .unwrap()
}

#[tokio::test]
async fn test_auth_rate_limiting_returns_429() {
    let mut config = Config::from_env();
    config.auth_rate_limit_for_period = 3;
    config.trusted_proxies = parse_trusted_proxies("172.16.0.0/12");
    let (app, _) = setup_app_with_config(config).await;

    let proxy_ip = "172.18.0.3";
    let test_ip = "198.51.100.42";
    let login_payload = json!({
        "username": "non_existent_rate_limit_user",
        "password": "wrong_password_123"
    });

    // Send 3 requests (within quota) through the trusted proxy -> returns 401 Unauthorized
    for i in 1..=3 {
        let req = login_request_from(proxy_ip, Some(test_ip), &login_payload);
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(
            res.status(),
            StatusCode::UNAUTHORIZED,
            "Request {i} must be within rate limit"
        );
    }

    // 4th request from same client IP -> exceeds limit -> returns 429 Too Many Requests,
    // even if the client prepends a forged address to X-Forwarded-For
    let forged_chain = format!("203.0.113.1, {test_ip}");
    let blocked_req = login_request_from(proxy_ip, Some(&forged_chain), &login_payload);
    let blocked_res = app.clone().oneshot(blocked_req).await.unwrap();
    assert_eq!(blocked_res.status(), StatusCode::TOO_MANY_REQUESTS);

    let bytes = blocked_res.into_body().collect().await.unwrap().to_bytes();
    let problem: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(problem["status"], 429);
    assert_eq!(problem["title"], "Too Many Requests");
    assert!(
        problem["detail"]
            .as_str()
            .unwrap()
            .contains("Rate limit exceeded")
    );

    // Request from another client IP behind the same proxy should NOT be blocked
    let other_ip_req = login_request_from(proxy_ip, Some("198.51.100.99"), &login_payload);
    let other_ip_res = app.clone().oneshot(other_ip_req).await.unwrap();
    assert_eq!(
        other_ip_res.status(),
        StatusCode::UNAUTHORIZED,
        "Different IP must not be rate limited"
    );
}

#[tokio::test]
async fn test_auth_rate_limiting_ignores_spoofed_forwarded_for_from_untrusted_peer() {
    let mut config = Config::from_env();
    config.auth_rate_limit_for_period = 2;
    config.trusted_proxies = parse_trusted_proxies("172.16.0.0/12");
    let (app, _) = setup_app_with_config(config).await;

    let attacker_ip = "203.0.113.66";
    let login_payload = json!({
        "username": "non_existent_spoofing_user",
        "password": "wrong_password_123"
    });

    // Rotating X-Forwarded-For values must not reset the quota of a directly connected client
    for i in 1..=3 {
        let spoofed = format!("198.51.100.{i}");
        let req = login_request_from(attacker_ip, Some(&spoofed), &login_payload);
        let res = app.clone().oneshot(req).await.unwrap();
        let expected = if i <= 2 {
            StatusCode::UNAUTHORIZED
        } else {
            StatusCode::TOO_MANY_REQUESTS
        };
        assert_eq!(res.status(), expected, "Request {i} with spoofed header");
    }
}
