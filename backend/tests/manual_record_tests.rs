//! Manual records without a Discogs entry (#242) against a mocked Discogs API. The mock records
//! every request, so the tests can assert that manual records never reach Discogs.

use axum::{
    Json, Router,
    body::Body,
    extract::Request as AxumRequest,
    http::{Method, Request, StatusCode, header},
    routing::get,
};
use backend_rs::{
    config::Config,
    db::init_pool,
    models::{
        collection::CollectionResponse,
        label_photo::LabelPhotoDto,
        record::{ManualRecordCreatedDto, RecordDetailDto, RecordSource},
        scan::ScanResultDto,
    },
    routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use image::{DynamicImage, ImageFormat, RgbImage};
use serde_json::{Value, json};
use std::io::Cursor;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);

type Requests = Arc<Mutex<Vec<String>>>;

/// Discogs mock with one release in the remote collection; everything else is logged and fails.
async fn mock_discogs(requests: Requests) -> String {
    let app = Router::new()
        .route(
            "/users/{username}/collection/fields",
            get(|| async { Json(json!({ "fields": [] })) }),
        )
        .route(
            "/users/{username}/collection/folders/0/releases",
            get(|| async {
                Json(json!({
                    "pagination": { "page": 1, "pages": 1, "per_page": 100, "items": 1 },
                    "releases": [{
                        "id": 98765,
                        "instance_id": 555,
                        "date_added": "2026-02-01T12:00:00Z",
                        "basic_information": {
                            "id": 98765,
                            "title": "A Love Supreme",
                            "year": 1965,
                            "artists": [{ "name": "John Coltrane" }],
                            "genres": ["Jazz"],
                            "formats": [{ "name": "Vinyl", "descriptions": ["LP"] }]
                        }
                    }]
                }))
            }),
        )
        .fallback(|| async { StatusCode::INTERNAL_SERVER_ERROR })
        .layer(axum::middleware::from_fn(
            move |req: AxumRequest, next: axum::middleware::Next| {
                let requests = requests.clone();
                async move {
                    requests.lock().unwrap().push(req.uri().to_string());
                    next.run(req).await
                }
            },
        ));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

struct TestApp {
    app: Router,
    state: AppState,
    requests: Requests,
}

impl TestApp {
    async fn new() -> Self {
        let requests: Requests = Arc::default();
        let mock = mock_discogs(requests.clone()).await;
        dotenvy::dotenv().ok();
        let mut config = Config::from_env();
        config.discogs_api_base_url = mock;
        let pool = init_pool(&config).await.unwrap();
        backend_rs::db::migrations::run_migrations(&pool)
            .await
            .unwrap();
        let state = AppState::new(pool, config);
        Self {
            app: create_app(state.clone()),
            state,
            requests,
        }
    }

    /// Registers a user with Discogs username and token and returns the bearer token.
    async fn register(&self) -> String {
        let username = format!(
            "manual_{}_{}_{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
            USER_COUNTER.fetch_add(1, Ordering::SeqCst)
        );
        let (status, body) = self
            .call(
                Method::POST,
                "/api/users/register",
                None,
                "application/json",
                json!({ "username": username, "password": "Password123!" }).to_string(),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        let body: Value = serde_json::from_slice(&body).unwrap();
        sqlx::query("UPDATE app_user SET discogs_username = $1, discogs_token = $2 WHERE id = $3")
            .bind(&username)
            .bind(self.state.crypto.encrypt("discogs-token"))
            .bind(body["id"].as_i64().unwrap())
            .execute(&self.state.pool)
            .await
            .unwrap();
        body["token"].as_str().unwrap().to_string()
    }

    async fn call(
        &self,
        method: Method,
        uri: &str,
        token: Option<&str>,
        content_type: &str,
        body: impl Into<Body>,
    ) -> (StatusCode, Vec<u8>) {
        let mut builder = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, content_type);
        if let Some(token) = token {
            builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        let res = self
            .app
            .clone()
            .oneshot(builder.body(body.into()).unwrap())
            .await
            .unwrap();
        let status = res.status();
        (
            status,
            res.into_body().collect().await.unwrap().to_bytes().to_vec(),
        )
    }

    async fn json(
        &self,
        method: Method,
        uri: &str,
        token: &str,
        body: Value,
    ) -> (StatusCode, Value) {
        let (status, bytes) = self
            .call(
                method,
                uri,
                Some(token),
                "application/json",
                body.to_string(),
            )
            .await;
        (
            status,
            serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        )
    }

    async fn create(&self, token: &str, body: Value) -> ManualRecordCreatedDto {
        let (status, created) = self
            .json(Method::POST, "/api/records/manual", token, body)
            .await;
        assert_eq!(status, StatusCode::CREATED, "{created}");
        serde_json::from_value(created).unwrap()
    }

    async fn collection(&self, token: &str, query: &str) -> CollectionResponse {
        let (status, body) = self
            .json(
                Method::GET,
                &format!("/api/collection?{query}"),
                token,
                Value::Null,
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        serde_json::from_value(body).unwrap()
    }

    /// Discogs requests that mention a negative (manual) ID.
    fn manual_ids_sent_to_discogs(&self) -> Vec<String> {
        self.requests
            .lock()
            .unwrap()
            .iter()
            .filter(|uri| uri.contains("/-") || uri.contains("=-"))
            .cloned()
            .collect()
    }
}

fn jpeg(width: u32, height: u32) -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(RgbImage::new(width, height))
        .write_to(&mut buf, ImageFormat::Jpeg)
        .unwrap();
    buf.into_inner()
}

fn record_body() -> Value {
    json!({
        "artist": "Die Sterne",
        "title": "Posen",
        "format": "LP",
        "year": "1996",
        "label": "L'age D'or",
        "catno": "LADO 17053",
        "country": "Germany",
        "barcode": "4 006381 333931",
        "genres": ["Rock"],
        "mediaCondition": "VG+",
        "notes": "Signiert",
        "value": 25.5
    })
}

#[tokio::test]
async fn test_create_manual_record_with_cover() {
    let t = TestApp::new().await;
    let token = t.register().await;

    let created = t.create(&token, record_body()).await;
    let record = created.record;
    let id = record.discogs_id;
    assert!(id < 0, "manual records get negative IDs");
    assert_eq!(record.source, RecordSource::Manual);
    assert_eq!(record.instance_id, Some(id));
    assert_eq!(record.labels[0].name, "L'age D'or");
    assert_eq!(record.labels[0].catno.as_deref(), Some("LADO 17053"));
    assert_eq!(record.barcode.as_deref(), Some("4006381333931"));
    assert_eq!(record.country.as_deref(), Some("Germany"));
    assert_eq!(record.notes.as_deref(), Some("Signiert"));
    assert_eq!(record.median_price, Some(25.5));
    assert_eq!(
        record.media_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );
    assert_eq!(record.thumb_url, None, "no cover yet");

    // Cover upload: downscaled and served without login
    let (status, body) = t
        .call(
            Method::PUT,
            &format!("/api/records/{id}/cover"),
            Some(&token),
            "image/jpeg",
            jpeg(1600, 1200),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let with_cover: RecordDetailDto = serde_json::from_slice(&body).unwrap();
    let cover_url = with_cover.thumb_url.unwrap();
    assert!(cover_url.starts_with("/api/covers/"), "{cover_url}");

    let (status, image) = t
        .call(Method::GET, &cover_url, None, "image/jpeg", Body::empty())
        .await;
    assert_eq!(status, StatusCode::OK);
    let cover = image::load_from_memory(&image).unwrap();
    assert_eq!((cover.width(), cover.height()), (800, 600));

    for unknown in [
        "/api/covers/00000000-0000-0000-0000-000000000000",
        "/api/covers/not-a-uuid",
    ] {
        let (status, _) = t
            .call(Method::GET, unknown, None, "image/jpeg", Body::empty())
            .await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{unknown}");
    }

    // Listed and filterable as manual record, with value and cover
    let manual = t.collection(&token, "source=manual").await;
    assert_eq!(manual.releases.len(), 1);
    let listed = &manual.releases[0];
    assert_eq!(listed.id, id);
    assert_eq!(listed.source, RecordSource::Manual);
    assert_eq!(listed.basic_information.median_price, Some(25.5));
    assert_eq!(
        listed.basic_information.thumb_url.as_deref(),
        Some(cover_url.as_str())
    );
    assert!(
        t.collection(&token, "source=discogs")
            .await
            .releases
            .is_empty()
    );

    assert!(t.manual_ids_sent_to_discogs().is_empty());
}

#[tokio::test]
async fn test_manual_record_validation_and_ownership() {
    let t = TestApp::new().await;
    let token = t.register().await;

    let mut invalid = record_body();
    invalid["format"] = json!("Cassette");
    let (status, problem) = t
        .json(Method::POST, "/api/records/manual", &token, invalid)
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        problem["detail"]
            .as_str()
            .unwrap()
            .contains("Invalid format")
    );

    let id = t.create(&token, record_body()).await.record.discogs_id;

    // Updating changes the record; other users cannot see or edit it
    let mut changed = record_body();
    changed["title"] = json!("Posen (Remaster)");
    changed["value"] = Value::Null;
    let (status, updated) = t
        .json(
            Method::PUT,
            &format!("/api/records/{id}/manual"),
            &token,
            changed.clone(),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(
        updated["discogs_id"], id,
        "the manual record, not a release with its row ID"
    );
    assert_eq!(updated["title"], "Posen (Remaster)");
    assert_eq!(updated["median_price"], Value::Null);

    let other = t.register().await;
    let (status, _) = t
        .json(
            Method::PUT,
            &format!("/api/records/{id}/manual"),
            &other,
            changed,
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = t
        .call(
            Method::PUT,
            &format!("/api/records/{id}/cover"),
            Some(&other),
            "image/jpeg",
            jpeg(10, 10),
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_discogs_sync_and_actions_leave_manual_records_alone() {
    let t = TestApp::new().await;
    let token = t.register().await;
    let id = t.create(&token, record_body()).await.record.discogs_id;

    let (status, sync) = t
        .json(Method::POST, "/api/collection/sync", &token, Value::Null)
        .await;
    assert_eq!(status, StatusCode::OK, "{sync}");
    assert_eq!(sync["added"], 1);
    assert_eq!(sync["removed"], 0, "the manual record is not on Discogs");

    let all = t.collection(&token, "").await;
    let ids: Vec<i64> = all.releases.iter().map(|r| r.id).collect();
    assert!(ids.contains(&id) && ids.contains(&98765), "{ids:?}");

    // Details, condition, listen and price refresh work without Discogs
    let (status, details) = t
        .json(
            Method::GET,
            &format!("/api/records/{id}"),
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(details["source"], "manual");
    let (status, _) = t
        .json(
            Method::PATCH,
            &format!("/api/records/{id}/condition"),
            &token,
            json!({ "media_condition": "NM" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let (status, listened) = t
        .json(
            Method::POST,
            &format!("/api/records/{id}/listen"),
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listened["listen_count"], 1);
    let (status, _) = t
        .json(
            Method::POST,
            "/api/collection/prices/refresh",
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        listened["median_price"], 25.5,
        "the own value is not replaced by a price suggestion"
    );

    // An unknown negative ID is not looked up on Discogs either
    let (status, _) = t
        .json(
            Method::POST,
            "/api/records/-999999999/listen",
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Removing deletes only locally
    let (status, _) = t
        .json(
            Method::DELETE,
            &format!("/api/collection/releases/{id}"),
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(
        t.collection(&token, "source=manual")
            .await
            .releases
            .is_empty()
    );

    assert_eq!(t.manual_ids_sent_to_discogs(), Vec::<String>::new());
}

#[tokio::test]
async fn test_scanning_barcode_and_qr_code_of_a_manual_record() {
    let t = TestApp::new().await;
    let token = t.register().await;
    let id = t.create(&token, record_body()).await.record.discogs_id;

    // EAN-13 as stored, then its QR code from the print module
    for code in ["4006381333931".to_string(), format!("discogs-id:{id}")] {
        let (status, body) = t
            .json(
                Method::POST,
                "/api/scan",
                &token,
                json!({ "barcode": code }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        let result: ScanResultDto = serde_json::from_value(body).unwrap();
        assert!(result.success, "{code}: {}", result.message);
        assert_eq!(result.record.unwrap().discogs_id, id);
    }

    let (_, details) = t
        .json(
            Method::GET,
            &format!("/api/records/{id}"),
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(details["listen_count"], 2);
    assert!(t.manual_ids_sent_to_discogs().is_empty());
    assert!(
        !t.requests
            .lock()
            .unwrap()
            .iter()
            .any(|uri| uri.contains("4006381333931")),
        "the barcode of a manual record is resolved locally"
    );
}

#[tokio::test]
async fn test_label_photo_becomes_the_cover_of_a_manual_record() {
    let t = TestApp::new().await;
    let token = t.register().await;
    let (status, body) = t
        .call(
            Method::POST,
            "/api/label-photos",
            Some(&token),
            "image/jpeg",
            jpeg(1200, 1200),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED);
    let photo_id = serde_json::from_slice::<Value>(&body).unwrap()["id"]
        .as_i64()
        .unwrap();

    let mut body = record_body();
    body["labelPhotoId"] = json!(photo_id);
    let record = t.create(&token, body).await.record;
    let cover_url = record.thumb_url.expect("label photo as cover");
    let (status, image) = t
        .call(Method::GET, &cover_url, None, "image/jpeg", Body::empty())
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(image::load_from_memory(&image).unwrap().width(), 800);

    let (_, inbox) = t
        .json(
            Method::GET,
            "/api/label-photos?status=identified",
            &token,
            Value::Null,
        )
        .await;
    let photos: Vec<LabelPhotoDto> = serde_json::from_value(inbox["photos"].clone()).unwrap();
    assert_eq!(photos.len(), 1);
    assert_eq!(photos[0].discogs_id, Some(record.discogs_id));

    // Photos of other users cannot be used
    let other = t.register().await;
    let mut body = record_body();
    body["labelPhotoId"] = json!(photo_id);
    let (status, _) = t
        .json(Method::POST, "/api/records/manual", &other, body)
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_backup_restores_manual_records_without_duplicates() {
    let t = TestApp::new().await;
    let token = t.register().await;
    let id = t.create(&token, record_body()).await.record.discogs_id;
    let (status, _) = t
        .call(
            Method::PUT,
            &format!("/api/records/{id}/cover"),
            Some(&token),
            "image/jpeg",
            jpeg(100, 100),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    t.json(
        Method::POST,
        &format!("/api/records/{id}/listen"),
        &token,
        Value::Null,
    )
    .await;

    let (status, backup) = t
        .json(
            Method::GET,
            "/api/collection/export?format=json",
            &token,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(backup["format_version"], 5);
    let release = &backup["releases"][0];
    assert_eq!(release["id"], id);
    assert_eq!(release["source"], "manual");
    assert_eq!(release["manual"]["catno"], "LADO 17053");
    assert!(release["manual"]["cover"].is_string());
    let uid = release["manual"]["manualUid"].as_str().unwrap().to_string();

    // Restoring into the same collection updates the record instead of duplicating it
    let (status, result) = t
        .json(
            Method::POST,
            "/api/collection/restore",
            &token,
            backup.clone(),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["records_added"], 0);
    assert_eq!(result["records_updated"], 1);
    assert_eq!(result["listens_skipped"], 1);
    assert_eq!(
        t.collection(&token, "source=manual").await.releases.len(),
        1
    );

    // A fresh instance has no such record: it is created with a new local ID and its cover
    let pool = &t.state.pool;
    for sql in [
        "DELETE FROM listen_event WHERE record_id IN (SELECT id FROM record_cache WHERE manual_uid = $1::uuid)",
        "DELETE FROM collection_item WHERE record_id IN (SELECT id FROM record_cache WHERE manual_uid = $1::uuid)",
        "DELETE FROM record_genres WHERE record_id IN (SELECT id FROM record_cache WHERE manual_uid = $1::uuid)",
        "DELETE FROM record_cache WHERE manual_uid = $1::uuid",
    ] {
        sqlx::query(sql).bind(&uid).execute(pool).await.unwrap();
    }
    let (status, result) = t
        .json(Method::POST, "/api/collection/restore", &token, backup)
        .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["records_added"], 1);
    assert_eq!(result["listens_added"], 1);

    let restored = t.collection(&token, "source=manual").await.releases;
    assert_eq!(restored.len(), 1);
    let new_id = restored[0].id;
    assert!(new_id < 0 && new_id != id, "new local ID {new_id}");
    assert_eq!(restored[0].instance_id, new_id);
    assert_eq!(restored[0].listen_count, 1);
    let cover_url = restored[0].basic_information.thumb_url.clone().unwrap();
    let (status, _) = t
        .call(Method::GET, &cover_url, None, "image/jpeg", Body::empty())
        .await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn test_manual_records_are_private_to_their_owner() {
    let t = TestApp::new().await;
    let owner = t.register().await;
    let other = t.register().await;
    let mut body = record_body();
    body["label"] = Value::Null;
    let id = t.create(&owner, body).await.record.discogs_id;

    // The catalog number is kept without a label
    let (_, details) = t
        .json(
            Method::GET,
            &format!("/api/records/{id}"),
            &owner,
            Value::Null,
        )
        .await;
    assert_eq!(details["labels"][0]["name"], "");
    assert_eq!(details["labels"][0]["catno"], "LADO 17053");

    // Other users can neither read it nor log listens for it
    for (method, uri) in [
        (Method::GET, format!("/api/records/{id}")),
        (Method::POST, format!("/api/records/{id}/listen")),
    ] {
        let (status, _) = t.json(method, &uri, &other, Value::Null).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}");
    }
    let (_, scan) = t
        .json(
            Method::POST,
            "/api/scan",
            &other,
            json!({ "barcode": format!("discogs-id:{id}") }),
        )
        .await;
    assert_eq!(scan["success"], false);
}

#[tokio::test]
async fn test_restoring_another_users_backup_copies_the_manual_record() {
    let t = TestApp::new().await;
    let owner = t.register().await;
    let id = t.create(&owner, record_body()).await.record.discogs_id;
    let (_, mut backup) = t
        .json(
            Method::GET,
            "/api/collection/export?format=json",
            &owner,
            Value::Null,
        )
        .await;

    backup["releases"][0]["basic_information"]["title"] = json!("Fremd");
    let other = t.register().await;
    let (status, result) = t
        .json(Method::POST, "/api/collection/restore", &other, backup)
        .await;
    assert_eq!(status, StatusCode::OK, "{result}");
    assert_eq!(result["records_added"], 1);

    // The owner's record is untouched; the other user got an own copy with a new ID
    let (_, original) = t
        .json(
            Method::GET,
            &format!("/api/records/{id}"),
            &owner,
            Value::Null,
        )
        .await;
    assert_eq!(original["title"], "Posen");
    let copy = &t.collection(&other, "source=manual").await.releases[0];
    assert_ne!(copy.id, id);
    assert_eq!(copy.basic_information.title, "Fremd");
}

#[tokio::test]
async fn test_scanner_reads_manual_qr_codes_typed_on_a_german_layout() {
    let t = TestApp::new().await;
    let token = t.register().await;
    let id = t.create(&token, record_body()).await.record.discogs_id;

    // A HID scanner on a German layout types '-' as 'ß'
    let code = format!("discogs-id:ß{}", -id);
    let (status, body) = t
        .json(
            Method::POST,
            "/api/scan",
            &token,
            json!({ "barcode": code }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["record"]["discogsId"], id, "{body}");
}

#[tokio::test]
async fn test_a_completed_label_photo_cannot_become_a_second_cover() {
    let t = TestApp::new().await;
    let token = t.register().await;
    let (_, body) = t
        .call(
            Method::POST,
            "/api/label-photos",
            Some(&token),
            "image/jpeg",
            jpeg(64, 64),
        )
        .await;
    let photo_id = serde_json::from_slice::<Value>(&body).unwrap()["id"].clone();
    let mut request = record_body();
    request["labelPhotoId"] = photo_id;
    t.create(&token, request.clone()).await;

    let (status, _) = t
        .json(Method::POST, "/api/records/manual", &token, request)
        .await;
    assert_eq!(status, StatusCode::CONFLICT);
}
