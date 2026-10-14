use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use tower::ServiceExt;
use backend_rs::{
    config::Config,
    db::init_pool,
    models::discogs::{determine_format, DiscogsFormat, DiscogsSearchResponse},
    routes::create_app,
    services::image_proxy::ImageProxyService,
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

fn make_format(name: &str, qty: &str, descs: Vec<&str>) -> DiscogsFormat {
    DiscogsFormat {
        name: Some(name.to_string()),
        qty: Some(qty.to_string()),
        descriptions: Some(descs.into_iter().map(String::from).collect()),
        text: None,
    }
}

// ---------------------------------------------------------------------------
// 1. Format Determination Unit Tests
// ---------------------------------------------------------------------------

#[test]
fn test_determine_format_logic() {
    // None & empty formats default to "LP"
    assert_eq!(determine_format(None), "LP");
    assert_eq!(determine_format(Some(&[])), "LP");

    // Standard vinyl LP
    let vinyl = vec![make_format("Vinyl", "1", vec!["LP", "Album"])];
    assert_eq!(determine_format(Some(&vinyl)), "LP");

    // Double LP via quantity
    let double_lp_qty = vec![make_format("Vinyl", "2", vec!["LP"])];
    assert_eq!(determine_format(Some(&double_lp_qty)), "Double LP");

    // Double LP via description
    let double_lp_desc = vec![make_format("Vinyl", "1", vec!["2xLP", "Gatefold"])];
    assert_eq!(determine_format(Some(&double_lp_desc)), "Double LP");

    // Single CD
    let cd = vec![make_format("CD", "1", vec!["Album"])];
    assert_eq!(determine_format(Some(&cd)), "CD");

    // Double CD via description
    let double_cd_desc = vec![make_format("CD", "1", vec!["2xCD"])];
    assert_eq!(determine_format(Some(&double_cd_desc)), "Double CD");

    // Double CD via qty
    let double_cd_qty = vec![make_format("CD", "2", vec![])];
    assert_eq!(determine_format(Some(&double_cd_qty)), "Double CD");
}

// ---------------------------------------------------------------------------
// 2. Discogs Model Serialization Tests
// ---------------------------------------------------------------------------

#[test]
fn test_discogs_search_response_deserialization() {
    let raw_json = json!({
        "pagination": {
            "page": 1,
            "pages": 1,
            "per_page": 50,
            "items": 1
        },
        "results": [
            {
                "id": 249504,
                "title": "Pink Floyd - The Dark Side Of The Moon",
                "year": "1973",
                "format": ["Vinyl", "LP", "Album"],
                "genre": ["Rock"],
                "style": ["Prog Rock", "Psychedelic Rock"],
                "cover_image": "https://i.discogs.com/sample.jpg",
                "thumb": "https://i.discogs.com/thumb.jpg",
                "barcode": ["077774600125"],
                "catno": "SHVL 804",
                "type": "release"
            }
        ]
    });

    let search_res: DiscogsSearchResponse = serde_json::from_value(raw_json).expect("Must deserialize");
    assert_eq!(search_res.pagination.page, 1);
    assert_eq!(search_res.pagination.items, 1);
    assert_eq!(search_res.results.len(), 1);

    let item = &search_res.results[0];
    assert_eq!(item.id, 249504);
    assert_eq!(item.title, "Pink Floyd - The Dark Side Of The Moon");
    assert_eq!(item.year.as_deref(), Some("1973"));
    assert_eq!(item.catno.as_deref(), Some("SHVL 804"));
    assert_eq!(item.type_name.as_deref(), Some("release"));
}

// ---------------------------------------------------------------------------
// 3. Image Proxy SSRF Defense Tests
// ---------------------------------------------------------------------------

#[test]
fn test_image_proxy_ip_detection() {
    // Loopback
    assert!(!ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))));
    assert!(!ImageProxyService::is_public_ip(IpAddr::V6(Ipv6Addr::LOCALHOST)));

    // RFC 1918 Private IPv4
    assert!(!ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
    assert!(!ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1))));
    assert!(!ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(172, 31, 255, 255))));
    assert!(!ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 100))));

    // Link-local
    assert!(!ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(169, 254, 169, 254))));

    // Public IPs must be allowed
    assert!(ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
    assert!(ImageProxyService::is_public_ip(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))));
}

#[tokio::test]
async fn test_image_proxy_service_rejects_ssrf_and_disallowed_hosts() {
    let proxy = ImageProxyService::new(
        "i.discogs.com,s.discogs.com,img.discogs.com",
        "VinylTracker/1.0".into(),
    );

    // Missing / invalid scheme
    assert!(proxy.validate_url("ftp://i.discogs.com/img.jpg").await.is_err());
    assert!(proxy.validate_url("http://i.discogs.com/img.jpg").await.is_err()); // HTTP disallowed

    // Disallowed domain
    assert!(proxy.validate_url("https://malicious.example.com/evil.png").await.is_err());
    assert!(proxy.validate_url("https://evil-i.discogs.com.attacker.com/fake.png").await.is_err());

    // Loopback & Private
    assert!(proxy.validate_url("https://localhost/test.jpg").await.is_err());
    assert!(proxy.validate_url("https://127.0.0.1/test.jpg").await.is_err());
    assert!(proxy.validate_url("https://192.168.1.1/test.jpg").await.is_err());
}

#[tokio::test]
async fn test_proxy_endpoint_rejections() {
    let (app, _) = setup_app().await;

    // 1. Missing URL parameter
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/proxy/image")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // 2. Disallowed HTTP scheme
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/proxy/image?url=http://i.discogs.com/img.jpg")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // 3. Disallowed external domain (SSRF attempt)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/proxy/image?url=https://attacker.com/secret")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    // 4. Localhost access attempt (SSRF)
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/proxy/image?url=https://127.0.0.1:8080/admin")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

// ---------------------------------------------------------------------------
// 4. Discogs Search Endpoint Security & Validation Tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_discogs_search_requires_authentication() {
    let (app, _) = setup_app().await;

    // Anonymous request must be rejected with 401 Unauthorized
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/discogs/search?q=Dark+Side")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_discogs_search_requires_user_with_token_configured() {
    let (app, _) = setup_app().await;

    // Register a brand new user with no Discogs token
    let test_username = format!("discogs_test_{}", chrono::Utc::now().timestamp_millis());
    let reg_payload = json!({
        "username": test_username,
        "password": "Password123!"
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

    // Perform Discogs search with valid JWT but unconfigured Discogs token
    let search_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/discogs/search?q=Abbey+Road")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Must return 400 Bad Request with ProblemDetail stating Discogs token is not configured
    assert_eq!(search_res.status(), StatusCode::BAD_REQUEST);
    let body = search_res.into_body().collect().await.unwrap().to_bytes();
    let err_json: Value = serde_json::from_slice(&body).unwrap();
    assert!(err_json["detail"]
        .as_str()
        .unwrap()
        .contains("User does not have a configured Discogs token"));
}

#[tokio::test]
async fn test_live_discogs_search_if_token_available() {
    let (app, state) = setup_app().await;

    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT username, discogs_token FROM app_user WHERE username = 'opolm'"
    )
    .fetch_optional(&state.pool)
    .await
    .unwrap();

    if let Some((username, Some(enc_token))) = row {
        if state.crypto.decrypt(&enc_token).is_some() {
            let jwt = backend_rs::auth::jwt::generate_token(&username, &state.config.jwt_secret, 3600).unwrap();

            let res = app
                .oneshot(
                    Request::builder()
                        .uri("/api/discogs/search?q=Dark+Side+Of+The+Moon&per_page=5")
                        .header(header::AUTHORIZATION, format!("Bearer {jwt}"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(res.status(), StatusCode::OK);
            let bytes = res.into_body().collect().await.unwrap().to_bytes();
            let json: Value = serde_json::from_slice(&bytes).unwrap();
            let results = json["results"].as_array().expect("results must be an array");
            println!("\n=== LIVE DISCOGS API RESPONSE ===");
            println!("Found {} results for query 'Dark Side Of The Moon':", results.len());
            for (idx, r) in results.iter().take(3).enumerate() {
                println!("  {}. ID: {} | Title: {} | Year: {}", idx + 1, r["id"], r["title"], r["year"]);
            }
            println!("=================================\n");
            assert!(!results.is_empty(), "Live search should return results from Discogs API");
        }
    }
}

