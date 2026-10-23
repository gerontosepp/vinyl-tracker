//! Automatic label photo identification (#235) against mocked OpenRouter and Discogs APIs.

use axum::{
    Json, Router,
    body::Body,
    http::{HeaderMap, Method, Request, StatusCode, header},
    routing::{get, post},
};
use backend_rs::{
    config::Config,
    db::init_pool,
    models::label_photo::{
        LabelIdentifyState, LabelMatchConfidence, LabelPhotoDto, LabelPhotoUploadDto,
        LabelPhotosDto, OpenRouterSettingsDto,
    },
    routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use image::{DynamicImage, ImageFormat, RgbImage};
use serde_json::{Value, json};
use std::io::Cursor;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);
const RELEASE_ID: i64 = 1622788;
const API_KEY: &str = "sk-or-test-key";

/// Mock of OpenRouter and Discogs. The model searches by catalog number first and then
/// submits `submitted_id` (an invented ID simulates a hallucination).
async fn mock_apis(submitted_id: i64) -> String {
    let chat = move |headers: HeaderMap, Json(body): Json<Value>| async move {
        assert_eq!(
            headers[header::AUTHORIZATION].to_str().unwrap(),
            format!("Bearer {API_KEY}")
        );
        assert_eq!(body["model"], "test/vision-model");
        let image_url = body["messages"][1]["content"][1]["image_url"]["url"]
            .as_str()
            .unwrap();
        assert!(image_url.starts_with("data:image/jpeg;base64,"));

        let tool_results = body["messages"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|m| m["role"] == "tool")
            .count();
        let (name, arguments) = if tool_results == 0 {
            (
                "search_discogs",
                json!({ "catno": "30561", "label": "Schneeball" }),
            )
        } else {
            (
                "submit_identification",
                json!({
                    "best": { "discogs_id": submitted_id, "confidence": "high", "reason": "Katalognummer und Label passen" },
                    "hint": "Matrix in der Auslaufrille prüfen"
                }),
            )
        };
        Json(json!({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": null,
                    "tool_calls": [{
                        "id": format!("call_{tool_results}"),
                        "type": "function",
                        "function": { "name": name, "arguments": arguments.to_string() }
                    }]
                }
            }]
        }))
    };
    let app = Router::new()
        .route("/chat/completions", post(chat))
        .route(
            "/database/search",
            get(|| async {
                Json(json!({
                    "pagination": { "page": 1, "pages": 1, "per_page": 10, "items": 1 },
                    "results": [{ "id": RELEASE_ID, "title": "Embryo (3) - Embryo's Rache", "catno": "30561", "label": ["Schneeball"] }]
                }))
            }),
        )
        .route(
            "/releases/{id}",
            get(|| async {
                Json(json!({
                    "id": RELEASE_ID,
                    "title": "Embryo's Rache",
                    "artists": [{ "id": 1, "name": "Embryo (3)" }],
                    "year": 1996,
                    "country": "Germany",
                    "labels": [{ "id": 79234, "name": "Schneeball", "catno": "30561" }],
                    "thumb": "https://i.discogs.com/thumb.jpg"
                }))
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

async fn setup(submitted_id: i64) -> (Router, AppState) {
    let mock = mock_apis(submitted_id).await;
    dotenvy::dotenv().ok();
    let mut config = Config::from_env();
    config.discogs_api_base_url = mock.clone();
    config.openrouter_api_base_url = mock;
    let pool = init_pool(&config).await.unwrap();
    backend_rs::db::migrations::run_migrations(&pool)
        .await
        .unwrap();
    let state = AppState::new(pool, config);
    (create_app(state.clone()), state)
}

/// Registers a user with a Discogs token and returns (user id, bearer token).
async fn register(app: &Router, state: &AppState) -> (i64, String) {
    let username = format!(
        "label_identify_{}_{}_{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
        USER_COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let (status, body) = call(
        app,
        Method::POST,
        "/api/users/register",
        None,
        "application/json",
        serde_json::to_vec(&json!({ "username": username, "password": "Password123!" })).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let body: Value = serde_json::from_slice(&body).unwrap();
    let user_id = body["id"].as_i64().unwrap();
    sqlx::query("UPDATE app_user SET discogs_token = $1 WHERE id = $2")
        .bind(state.crypto.encrypt("discogs-token"))
        .bind(user_id)
        .execute(&state.pool)
        .await
        .unwrap();
    (user_id, body["token"].as_str().unwrap().to_string())
}

async fn call(
    app: &Router,
    method: Method,
    uri: &str,
    token: Option<&str>,
    content_type: &str,
    body: Vec<u8>,
) -> (StatusCode, Vec<u8>) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, content_type);
    if let Some(token) = token {
        builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }
    let res = app
        .clone()
        .oneshot(builder.body(Body::from(body)).unwrap())
        .await
        .unwrap();
    let status = res.status();
    (
        status,
        res.into_body().collect().await.unwrap().to_bytes().to_vec(),
    )
}

async fn configure_openrouter(app: &Router, token: &str) -> OpenRouterSettingsDto {
    let (status, body) = call(
        app,
        Method::PUT,
        "/api/users/me/openrouter",
        Some(token),
        "application/json",
        serde_json::to_vec(&json!({ "apiKey": API_KEY, "model": "test/vision-model" })).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    serde_json::from_slice(&body).unwrap()
}

fn jpeg() -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(RgbImage::new(32, 32))
        .write_to(&mut buf, ImageFormat::Jpeg)
        .unwrap();
    buf.into_inner()
}

async fn upload(app: &Router, token: &str) -> LabelPhotoUploadDto {
    let (status, body) = call(
        app,
        Method::POST,
        "/api/label-photos",
        Some(token),
        "image/jpeg",
        jpeg(),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    serde_json::from_slice(&body).unwrap()
}

/// Polls the inbox until the photo's identification has finished.
async fn finished_photo(app: &Router, token: &str, id: i64) -> LabelPhotoDto {
    for _ in 0..100 {
        let (_, body) = call(
            app,
            Method::GET,
            "/api/label-photos",
            Some(token),
            "application/json",
            vec![],
        )
        .await;
        let inbox: LabelPhotosDto = serde_json::from_slice(&body).unwrap();
        let photo = inbox.photos.into_iter().find(|p| p.id == id).unwrap();
        if matches!(
            photo.identify_state,
            Some(LabelIdentifyState::Done | LabelIdentifyState::Error)
        ) {
            return photo;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    panic!("identification of photo {id} did not finish");
}

#[tokio::test]
async fn test_upload_identifies_the_photo_in_the_background() {
    let (app, state) = setup(RELEASE_ID).await;
    let (_, token) = register(&app, &state).await;
    let settings = configure_openrouter(&app, &token).await;
    assert!(settings.has_api_key);
    assert_eq!(settings.model, "test/vision-model");

    let uploaded = upload(&app, &token).await;
    assert!(uploaded.identifying);

    let photo = finished_photo(&app, &token, uploaded.id).await;
    assert_eq!(
        photo.identify_state,
        Some(LabelIdentifyState::Done),
        "{:?}",
        photo.identify_error
    );
    assert_eq!(photo.identify_model.as_deref(), Some("test/vision-model"));
    let suggestion = photo.suggestion.unwrap();
    assert_eq!(suggestion.best.discogs_id, RELEASE_ID);
    assert_eq!(suggestion.best.confidence, LabelMatchConfidence::High);
    assert_eq!(suggestion.best.artist.as_deref(), Some("Embryo (3)"));
    assert_eq!(suggestion.best.catno.as_deref(), Some("30561"));
    assert!(!suggestion.best.in_collection);
    assert_eq!(
        suggestion.hint.as_deref(),
        Some("Matrix in der Auslaufrille prüfen")
    );
}

#[tokio::test]
async fn test_invented_release_ids_are_rejected_and_can_be_retried() {
    let (app, state) = setup(999_999).await;
    let (_, token) = register(&app, &state).await;
    configure_openrouter(&app, &token).await;

    let uploaded = upload(&app, &token).await;
    let photo = finished_photo(&app, &token, uploaded.id).await;
    assert_eq!(photo.identify_state, Some(LabelIdentifyState::Error));
    assert!(photo.suggestion.is_none());
    assert!(
        photo
            .identify_error
            .as_deref()
            .unwrap()
            .contains("not returned by a Discogs lookup")
    );

    // A photo that is still running is not identified twice
    sqlx::query("UPDATE label_photo SET identify_state = 'running' WHERE id = $1")
        .bind(uploaded.id)
        .execute(&state.pool)
        .await
        .unwrap();
    let (status, _) = call(
        &app,
        Method::POST,
        &format!("/api/label-photos/{}/identify", uploaded.id),
        Some(&token),
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    sqlx::query("UPDATE label_photo SET identify_state = 'error' WHERE id = $1")
        .bind(uploaded.id)
        .execute(&state.pool)
        .await
        .unwrap();

    let (status, body) = call(
        &app,
        Method::POST,
        &format!("/api/label-photos/{}/identify", uploaded.id),
        Some(&token),
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let queued: LabelPhotoDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(queued.identify_state, Some(LabelIdentifyState::Queued));
    assert!(queued.identify_error.is_none());

    finished_photo(&app, &token, uploaded.id).await;
}

#[tokio::test]
async fn test_without_api_key_photos_are_not_identified() {
    let (app, state) = setup(RELEASE_ID).await;
    let (_, token) = register(&app, &state).await;

    let uploaded = upload(&app, &token).await;
    assert!(!uploaded.identifying);

    let (status, _) = call(
        &app,
        Method::POST,
        &format!("/api/label-photos/{}/identify", uploaded.id),
        Some(&token),
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_api_key_is_stored_encrypted_and_never_returned() {
    let (app, state) = setup(RELEASE_ID).await;
    let (user_id, token) = register(&app, &state).await;
    configure_openrouter(&app, &token).await;

    let stored: String =
        sqlx::query_scalar("SELECT openrouter_api_key FROM app_user WHERE id = $1")
            .bind(user_id)
            .fetch_one(&state.pool)
            .await
            .unwrap();
    assert_ne!(stored, API_KEY);
    assert_eq!(state.crypto.decrypt(&stored).as_deref(), Some(API_KEY));

    let (_, body) = call(
        &app,
        Method::GET,
        "/api/users/me/openrouter",
        Some(&token),
        "application/json",
        vec![],
    )
    .await;
    assert!(!String::from_utf8(body).unwrap().contains(API_KEY));

    // An empty key removes it, an empty model resets to the default
    let (_, body) = call(
        &app,
        Method::PUT,
        "/api/users/me/openrouter",
        Some(&token),
        "application/json",
        serde_json::to_vec(&json!({ "apiKey": "", "model": "" })).unwrap(),
    )
    .await;
    let settings: OpenRouterSettingsDto = serde_json::from_slice(&body).unwrap();
    assert!(!settings.has_api_key);
    assert_eq!(settings.model, settings.default_model);
}
