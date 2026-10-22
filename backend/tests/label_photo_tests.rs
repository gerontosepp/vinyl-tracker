use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{
    config::Config,
    db::init_pool,
    models::label_photo::{LabelPhotoDto, LabelPhotoStatus, LabelPhotoUploadDto, LabelPhotosDto},
    routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use image::{DynamicImage, ImageFormat, RgbImage};
use serde_json::{Value, json};
use std::io::Cursor;
use std::sync::atomic::{AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);

async fn setup_app() -> axum::Router {
    dotenvy::dotenv().ok();
    let config = Config::from_env();
    let pool = init_pool(&config)
        .await
        .expect("PostgreSQL must be accessible for integration tests");
    backend_rs::db::migrations::run_migrations(&pool)
        .await
        .expect("Database migrations must succeed for integration tests");
    create_app(AppState::new(pool, config))
}

async fn register(app: &axum::Router) -> String {
    let username = format!(
        "label_photo_{}_{}_{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
        USER_COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/users/register")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    serde_json::to_vec(&json!({"username": username, "password": "Password123!"}))
                        .unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body: Value =
        serde_json::from_slice(&res.into_body().collect().await.unwrap().to_bytes()).unwrap();
    body["token"].as_str().unwrap().to_string()
}

async fn call(
    app: &axum::Router,
    method: Method,
    uri: &str,
    token: &str,
    content_type: &str,
    body: Vec<u8>,
) -> (StatusCode, Vec<u8>) {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, content_type)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = res.status();
    (
        status,
        res.into_body().collect().await.unwrap().to_bytes().to_vec(),
    )
}

fn jpeg(width: u32, height: u32) -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(RgbImage::new(width, height))
        .write_to(&mut buf, ImageFormat::Jpeg)
        .unwrap();
    buf.into_inner()
}

#[tokio::test]
async fn test_label_photo_inbox_lifecycle() {
    let app = setup_app().await;
    let token = register(&app).await;

    // Upload two photos; the large one is downscaled
    let (status, body) = call(
        &app,
        Method::POST,
        "/api/label-photos",
        &token,
        "image/jpeg",
        jpeg(2000, 1000),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let first: LabelPhotoUploadDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(first.pending_count, 1);

    let (_, body) = call(
        &app,
        Method::POST,
        "/api/label-photos",
        &token,
        "image/jpeg",
        jpeg(100, 100),
    )
    .await;
    let second: LabelPhotoUploadDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(second.pending_count, 2);

    // Pending list in upload order
    let (status, body) = call(
        &app,
        Method::GET,
        "/api/label-photos?status=pending",
        &token,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let list: LabelPhotosDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(list.pending_count, 2);
    assert_eq!(
        list.photos.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![first.id, second.id]
    );
    assert!(list.photos[0].created_at.ends_with('Z'));

    // Image bytes are a downscaled JPEG
    let (status, body) = call(
        &app,
        Method::GET,
        &format!("/api/label-photos/{}/image", first.id),
        &token,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let img = image::load_from_memory_with_format(&body, ImageFormat::Jpeg).unwrap();
    assert_eq!((img.width(), img.height()), (1568, 784));

    // Resolve the first photo
    let (status, body) = call(
        &app,
        Method::PATCH,
        &format!("/api/label-photos/{}", first.id),
        &token,
        "application/json",
        serde_json::to_vec(&json!({"status": "identified", "discogsId": 12345})).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let updated: LabelPhotoDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(updated.status, LabelPhotoStatus::Identified);
    assert_eq!(updated.discogs_id, Some(12345));
    assert!(updated.processed_at.is_some());

    let (_, body) = call(
        &app,
        Method::GET,
        "/api/label-photos?status=pending",
        &token,
        "application/json",
        vec![],
    )
    .await;
    let list: LabelPhotosDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(list.pending_count, 1);
    assert_eq!(list.photos[0].id, second.id);

    // Delete the second photo
    let (status, _) = call(
        &app,
        Method::DELETE,
        &format!("/api/label-photos/{}", second.id),
        &token,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _) = call(
        &app,
        Method::DELETE,
        &format!("/api/label-photos/{}", second.id),
        &token,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_label_photos_are_private_per_user() {
    let app = setup_app().await;
    let owner = register(&app).await;
    let other = register(&app).await;

    let (_, body) = call(
        &app,
        Method::POST,
        "/api/label-photos",
        &owner,
        "image/jpeg",
        jpeg(50, 50),
    )
    .await;
    let photo: LabelPhotoUploadDto = serde_json::from_slice(&body).unwrap();

    let image_uri = format!("/api/label-photos/{}/image", photo.id);
    let photo_uri = format!("/api/label-photos/{}", photo.id);
    let (status, _) = call(
        &app,
        Method::GET,
        &image_uri,
        &other,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = call(
        &app,
        Method::PATCH,
        &photo_uri,
        &other,
        "application/json",
        serde_json::to_vec(&json!({"status": "failed"})).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = call(
        &app,
        Method::DELETE,
        &photo_uri,
        &other,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (_, body) = call(
        &app,
        Method::GET,
        "/api/label-photos",
        &other,
        "application/json",
        vec![],
    )
    .await;
    let list: LabelPhotosDto = serde_json::from_slice(&body).unwrap();
    assert!(list.photos.is_empty());
    assert_eq!(list.pending_count, 0);
}

#[tokio::test]
async fn test_label_photo_upload_validation() {
    let app = setup_app().await;
    let token = register(&app).await;

    // Empty and non-image bodies -> 400
    let (status, _) = call(
        &app,
        Method::POST,
        "/api/label-photos",
        &token,
        "image/jpeg",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, body) = call(
        &app,
        Method::POST,
        "/api/label-photos",
        &token,
        "image/jpeg",
        b"no image".to_vec(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let problem: Value = serde_json::from_slice(&body).unwrap();
    assert!(
        problem["detail"]
            .as_str()
            .unwrap()
            .contains("Invalid image")
    );

    // Larger than 15 MB -> 413
    let (status, _) = call(
        &app,
        Method::POST,
        "/api/label-photos",
        &token,
        "image/jpeg",
        vec![0u8; 16 * 1024 * 1024],
    )
    .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);

    // Unknown status filter -> 400
    let (status, _) = call(
        &app,
        Method::GET,
        "/api/label-photos?status=done",
        &token,
        "application/json",
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Without authentication -> 401
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/label-photos")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}
