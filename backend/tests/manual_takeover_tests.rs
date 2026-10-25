//! Taking over manual records to Discogs (#243) against a stateful Discogs mock: releases added
//! by the takeover appear in the mocked remote collection, so a later sync sees them.

use axum::{
    Json, Router,
    body::Body,
    extract::{Path, Query, Request as AxumRequest, State},
    http::{Method, Request, StatusCode, header},
    routing::{delete, get, post},
};
use backend_rs::{
    config::Config,
    db::init_pool,
    models::{
        collection::CollectionResponse,
        record::{
            CandidateMatch, DiscogsCandidateDto, ManualRecordCreatedDto, RecordDetailDto,
            RecordSource, TakeoverMode, TakeoverResultDto,
        },
    },
    routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use image::{DynamicImage, ImageFormat, RgbImage};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicI64, AtomicU64, Ordering},
};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Release whose addition to the collection fails at Discogs.
const ADD_FAILS: i64 = 666;
/// Release that can be added, but whose details cannot be fetched afterwards.
const FETCH_FAILS: i64 = 777;

#[derive(Default)]
struct Remote {
    /// Every request as "METHOD /path?query".
    requests: Vec<String>,
    /// Remote collection per Discogs username: (release ID, instance ID).
    collections: HashMap<String, Vec<(i64, i64)>>,
}

#[derive(Clone)]
struct Mock {
    remote: Arc<Mutex<Remote>>,
    next_instance: Arc<AtomicI64>,
}

fn release_json(id: i64) -> Value {
    let title = match id {
        1001 => "Posen",
        1002 => "Posen (Reissue)",
        _ => "Posen (CD)",
    };
    json!({
        "id": id,
        "title": title,
        "year": 1996,
        "artists": [{ "name": "Die Sterne" }],
        "thumb": format!("https://i.discogs.com/{id}.jpg"),
        "genres": ["Rock", "Pop"],
        "formats": [{ "name": "Vinyl", "qty": "1", "descriptions": ["LP"] }],
        "labels": [{ "name": "L'age D'or", "catno": "LADO 17053" }],
        "country": "Germany"
    })
}

fn search_hit(id: i64) -> Value {
    let release = release_json(id);
    json!({
        "id": id,
        "title": format!("Die Sterne - {}", release["title"].as_str().unwrap()),
        "thumb": format!("https://i.discogs.com/{id}.jpg"),
        "year": "1996",
        "format": ["Vinyl", "LP"],
        "catno": "LADO 17053",
        "label": ["L'age D'or"],
        "country": "Germany",
        "type": "release"
    })
}

async fn search(Query(params): Query<HashMap<String, String>>) -> Json<Value> {
    let ids: Vec<i64> = if params.get("barcode").map(String::as_str) == Some("4006381333931") {
        vec![1001]
    } else if params.get("catno").map(String::as_str) == Some("LADO 17053") {
        vec![1002, 1001]
    } else if params.get("artist").map(String::as_str) == Some("Die Sterne") {
        vec![1003, 1001]
    } else {
        vec![]
    };
    Json(json!({
        "pagination": { "page": 1, "pages": 1, "per_page": 10, "items": ids.len() },
        "results": ids.into_iter().map(search_hit).collect::<Vec<_>>()
    }))
}

async fn add_release(
    State(mock): State<Mock>,
    Path((user, release_id)): Path<(String, i64)>,
) -> Result<(StatusCode, Json<Value>), StatusCode> {
    if release_id == ADD_FAILS {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let instance_id = mock.next_instance.fetch_add(1, Ordering::SeqCst);
    mock.remote
        .lock()
        .unwrap()
        .collections
        .entry(user)
        .or_default()
        .push((release_id, instance_id));
    Ok((
        StatusCode::CREATED,
        Json(json!({ "instance_id": instance_id, "resource_url": null })),
    ))
}

async fn delete_instance(
    State(mock): State<Mock>,
    Path((user, _release_id, instance_id)): Path<(String, i64, i64)>,
) -> StatusCode {
    if let Some(copies) = mock.remote.lock().unwrap().collections.get_mut(&user) {
        copies.retain(|(_, instance)| *instance != instance_id);
    }
    StatusCode::NO_CONTENT
}

async fn collection(State(mock): State<Mock>, Path(user): Path<String>) -> Json<Value> {
    let copies = mock
        .remote
        .lock()
        .unwrap()
        .collections
        .get(&user)
        .cloned()
        .unwrap_or_default();
    let releases: Vec<Value> = copies
        .iter()
        .map(|(release_id, instance_id)| {
            let release = release_json(*release_id);
            json!({
                "id": release_id,
                "instance_id": instance_id,
                "date_added": "2026-10-25T12:00:00Z",
                "basic_information": {
                    "id": release_id,
                    "title": release["title"],
                    "year": 1996,
                    "artists": release["artists"],
                    "genres": release["genres"],
                    "formats": release["formats"]
                }
            })
        })
        .collect();
    Json(json!({
        "pagination": { "page": 1, "pages": 1, "per_page": 100, "items": releases.len() },
        "releases": releases
    }))
}

async fn get_release(Path(id): Path<i64>) -> Result<Json<Value>, StatusCode> {
    if id == FETCH_FAILS {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    Ok(Json(release_json(id)))
}

async fn mock_discogs(mock: Mock) -> String {
    let log = mock.remote.clone();
    let app = Router::new()
        .route("/database/search", get(search))
        .route("/releases/{id}", get(get_release))
        .route(
            "/marketplace/price_suggestions/{id}",
            get(|| async {
                Json(json!({ "Very Good Plus (VG+)": { "value": 42.0, "currency": "EUR" } }))
            }),
        )
        .route(
            "/users/{user}/collection/fields",
            get(|| async {
                Json(json!({ "fields": [
                    { "id": 1, "name": "Media Condition" },
                    { "id": 2, "name": "Sleeve Condition" }
                ] }))
            }),
        )
        .route("/users/{user}/collection/folders/0/releases", get(collection))
        .route(
            "/users/{user}/collection/folders/0/releases/{release_id}",
            post(add_release),
        )
        .route(
            "/users/{user}/collection/folders/0/releases/{release_id}/instances/{instance_id}",
            delete(delete_instance),
        )
        .route(
            "/users/{user}/collection/folders/0/releases/{release_id}/instances/{instance_id}/fields/{field_id}",
            post(|| async { StatusCode::NO_CONTENT }),
        )
        .fallback(|| async { StatusCode::INTERNAL_SERVER_ERROR })
        .with_state(mock)
        .layer(axum::middleware::from_fn(
            move |req: AxumRequest, next: axum::middleware::Next| {
                let log = log.clone();
                async move {
                    log.lock()
                        .unwrap()
                        .requests
                        .push(format!("{} {}", req.method(), req.uri()));
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
    mock: Mock,
}

struct User {
    token: String,
    id: i64,
    discogs_username: String,
}

impl TestApp {
    async fn new() -> Self {
        let mock = Mock {
            remote: Arc::default(),
            // Instance IDs are unique per user only, but stay apart from the other test files
            next_instance: Arc::new(AtomicI64::new(
                7_000_000_000 + i64::from(std::process::id()) * 1000,
            )),
        };
        let base_url = mock_discogs(mock.clone()).await;
        dotenvy::dotenv().ok();
        let mut config = Config::from_env();
        config.discogs_api_base_url = base_url;
        let pool = init_pool(&config).await.unwrap();
        backend_rs::db::migrations::run_migrations(&pool)
            .await
            .unwrap();
        let state = AppState::new(pool, config);
        Self {
            app: create_app(state.clone()),
            state,
            mock,
        }
    }

    /// Registers a user with Discogs username and token.
    async fn register(&self) -> User {
        let username = format!(
            "takeover_{}_{}_{}",
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
        let id = body["id"].as_i64().unwrap();
        sqlx::query("UPDATE app_user SET discogs_username = $1, discogs_token = $2 WHERE id = $3")
            .bind(&username)
            .bind(self.state.crypto.encrypt("discogs-token"))
            .bind(id)
            .execute(&self.state.pool)
            .await
            .unwrap();
        User {
            token: body["token"].as_str().unwrap().to_string(),
            id,
            discogs_username: username,
        }
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
        user: &User,
        body: Value,
    ) -> (StatusCode, Value) {
        let (status, bytes) = self
            .call(
                method,
                uri,
                Some(&user.token),
                "application/json",
                body.to_string(),
            )
            .await;
        (
            status,
            serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        )
    }

    async fn create(&self, user: &User, body: Value) -> i64 {
        let (status, created) = self
            .json(Method::POST, "/api/records/manual", user, body)
            .await;
        assert_eq!(status, StatusCode::CREATED, "{created}");
        serde_json::from_value::<ManualRecordCreatedDto>(created)
            .unwrap()
            .record
            .discogs_id
    }

    async fn candidates(&self, user: &User, id: i64) -> (StatusCode, Value) {
        self.json(
            Method::GET,
            &format!("/api/records/{id}/discogs-candidates"),
            user,
            Value::Null,
        )
        .await
    }

    async fn take_over(&self, user: &User, id: i64, body: Value) -> (StatusCode, Value) {
        self.json(
            Method::POST,
            &format!("/api/records/{id}/takeover"),
            user,
            body,
        )
        .await
    }

    async fn take_over_ok(&self, user: &User, id: i64, body: Value) -> TakeoverResultDto {
        let (status, result) = self.take_over(user, id, body).await;
        assert_eq!(status, StatusCode::OK, "{result}");
        serde_json::from_value(result).unwrap()
    }

    async fn detail_query(&self, user: &User, path: &str) -> (StatusCode, Value) {
        self.json(
            Method::GET,
            &format!("/api/records/{path}"),
            user,
            Value::Null,
        )
        .await
    }

    async fn detail(&self, user: &User, id: i64) -> (StatusCode, Value) {
        self.json(
            Method::GET,
            &format!("/api/records/{id}"),
            user,
            Value::Null,
        )
        .await
    }

    async fn scan(&self, user: &User, code: &str) -> Value {
        let (status, scan) = self
            .json(Method::POST, "/api/scan", user, json!({ "barcode": code }))
            .await;
        assert!(status.is_success() || status.is_client_error(), "{scan}");
        scan
    }

    async fn listen(&self, user: &User, id: i64) {
        let (status, body) = self
            .json(
                Method::POST,
                &format!("/api/records/{id}/listen"),
                user,
                Value::Null,
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }

    async fn collection(&self, user: &User) -> CollectionResponse {
        let (status, body) = self
            .json(
                Method::GET,
                "/api/collection?per_page=100",
                user,
                Value::Null,
            )
            .await;
        assert_eq!(status, StatusCode::OK);
        serde_json::from_value(body).unwrap()
    }

    fn requests(&self, needle: &str) -> Vec<String> {
        self.mock
            .remote
            .lock()
            .unwrap()
            .requests
            .iter()
            .filter(|r| r.contains(needle))
            .cloned()
            .collect()
    }

    fn remote_collection(&self, user: &User) -> Vec<(i64, i64)> {
        self.mock
            .remote
            .lock()
            .unwrap()
            .collections
            .get(&user.discogs_username)
            .cloned()
            .unwrap_or_default()
    }

    async fn alias(&self, user: &User, old_id: i64) -> Option<i64> {
        sqlx::query_scalar(
            "SELECT instance_id FROM manual_record_alias WHERE user_id = $1 AND old_id = $2",
        )
        .bind(user.id)
        .bind(old_id)
        .fetch_optional(&self.state.pool)
        .await
        .unwrap()
    }
}

fn record_body() -> Value {
    json!({
        "artist": "Die Sterne",
        "title": "Posen",
        "format": "LP",
        "year": "1996",
        "label": "L'age D'or",
        "catno": "LADO 17053",
        "barcode": "4006381333931",
        "genres": ["Indie"],
        "mediaCondition": "Very Good Plus (VG+)",
        "sleeveCondition": "Near Mint (NM or M-)",
        "notes": "Signiert",
        "value": 25.5
    })
}

fn jpeg() -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(RgbImage::new(64, 64))
        .write_to(&mut buf, ImageFormat::Jpeg)
        .unwrap();
    buf.into_inner()
}

#[tokio::test]
async fn test_candidates_merge_all_searches_and_mark_owned_copies() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;

    let (status, body) = t.candidates(&user, id).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let candidates: Vec<DiscogsCandidateDto> = serde_json::from_value(body).unwrap();
    let found: Vec<(i64, CandidateMatch)> = candidates
        .iter()
        .map(|c| (c.discogs_id, c.matched_by))
        .collect();
    assert_eq!(
        found,
        [
            (1001, CandidateMatch::Barcode),
            (1002, CandidateMatch::Catno),
            (1003, CandidateMatch::ArtistTitle)
        ]
    );
    let first = &candidates[0];
    assert_eq!(first.artist.as_deref(), Some("Die Sterne"));
    assert_eq!(first.title, "Posen");
    assert_eq!(first.label.as_deref(), Some("L'age D'or"));
    assert!(first.in_collection.is_empty());
    assert_eq!(t.requests("/database/search").len(), 3);

    // Checking changes nothing
    let (_, detail) = t.detail(&user, id).await;
    assert_eq!(detail["source"], "manual");

    // A Discogs copy of a candidate is marked
    let taken = t
        .take_over_ok(&user, id, json!({ "releaseId": 1001 }))
        .await;
    let second = t.create(&user, record_body()).await;
    let (_, body) = t.candidates(&user, second).await;
    let candidates: Vec<DiscogsCandidateDto> = serde_json::from_value(body).unwrap();
    assert_eq!(candidates[0].in_collection, [taken.instance_id]);
    assert!(candidates[1].in_collection.is_empty());
}

#[tokio::test]
async fn test_candidates_skip_searches_without_fields_and_report_no_hit() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t
        .create(
            &user,
            json!({ "artist": "Unbekannt", "title": "Demo", "format": "CD" }),
        )
        .await;

    let (status, body) = t.candidates(&user, id).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body, json!([]));
    let searches = t.requests("/database/search");
    assert_eq!(searches.len(), 1, "{searches:?}");
    assert!(searches[0].contains("artist=Unbekannt"), "{searches:?}");
}

#[tokio::test]
async fn test_check_and_takeover_reject_other_records() {
    let t = TestApp::new().await;
    let owner = t.register().await;
    let other = t.register().await;
    let id = t.create(&owner, record_body()).await;

    // Another user's manual record and Discogs records are not found
    let (status, _) = t.candidates(&other, id).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = t.take_over(&other, id, json!({ "releaseId": 1001 })).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = t.candidates(&owner, 1001).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Invalid release ID
    let (status, _) = t.take_over(&owner, id, json!({ "releaseId": 0 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Without a Discogs token
    sqlx::query("UPDATE app_user SET discogs_token = NULL WHERE id = $1")
        .bind(owner.id)
        .execute(&t.state.pool)
        .await
        .unwrap();
    let (status, body) = t.candidates(&owner, id).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let (status, _) = t.take_over(&owner, id, json!({ "releaseId": 1001 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(t.requests("/database/search").is_empty());
}

#[tokio::test]
async fn test_takeover_as_new_copy_keeps_listens_conditions_and_sort_key() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;
    let (status, body) = t
        .call(
            Method::PUT,
            &format!("/api/records/{id}/cover"),
            Some(&user.token),
            "image/jpeg",
            jpeg(),
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let cover_url = serde_json::from_slice::<RecordDetailDto>(&body)
        .unwrap()
        .thumb_url
        .unwrap();
    t.listen(&user, id).await;
    t.listen(&user, id).await;
    let (status, _) = t
        .json(
            Method::PATCH,
            &format!("/api/records/{id}/sort-key"),
            &user,
            json!({ "sortKey": "Sterne, Die" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let result = t
        .take_over_ok(&user, id, json!({ "releaseId": 1001 }))
        .await;

    assert_eq!(result.mode, TakeoverMode::NewCopy);
    assert!(result.instance_id > 0);
    assert_eq!(t.remote_collection(&user), [(1001, result.instance_id)]);
    let record = &result.record;
    assert_eq!(record.source, RecordSource::Discogs);
    assert_eq!(record.discogs_id, 1001);
    assert_eq!(record.instance_id, Some(result.instance_id));
    assert_eq!(record.listen_count, 2);
    assert_eq!(
        record.media_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );
    assert_eq!(
        record.sleeve_condition.as_deref(),
        Some("Near Mint (NM or M-)")
    );
    assert_eq!(record.sort_key.as_deref(), Some("Sterne, Die"));
    assert_eq!(record.genres, ["Rock", "Pop"]);
    // Discogs replaces cover and own value
    assert_eq!(
        record.thumb_url.as_deref(),
        Some("https://i.discogs.com/1001.jpg")
    );
    assert_eq!(record.median_price, Some(42.0));
    let (status, _) = t
        .call(Method::GET, &cover_url, None, "image/jpeg", Body::empty())
        .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // Conditions were written to the new Discogs copy
    assert_eq!(
        t.requests(&format!("/instances/{}/fields/", result.instance_id))
            .len(),
        2
    );

    // The manual record is gone, its old ID is an alias of the new copy
    let manual_rows: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM record_cache WHERE discogs_id = $1")
            .bind(id)
            .fetch_one(&t.state.pool)
            .await
            .unwrap();
    assert_eq!(manual_rows, 0);
    assert_eq!(t.alias(&user, id).await, Some(result.instance_id));
    let collection = t.collection(&user).await;
    assert_eq!(collection.releases.len(), 1);
    assert_eq!(collection.releases[0].id, 1001);
    assert_eq!(collection.releases[0].listen_count, 2);

    // The printed QR label of the manual record still logs a listen
    let scan = t.scan(&user, &format!("discogs-id:{id}")).await;
    assert_eq!(scan["success"], true, "{scan}");
    assert_eq!(scan["record"]["discogsId"], 1001);
    let (_, detail) = t.detail(&user, 1001).await;
    assert_eq!(detail["listen_count"], 3);

    // Taking over twice is not possible and says so
    let (status, body) = t.take_over(&user, id, json!({ "releaseId": 1001 })).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body["detail"]
            .as_str()
            .unwrap()
            .contains("already taken over"),
        "{body}"
    );
}

#[tokio::test]
async fn test_alias_resolves_only_for_its_user() {
    let t = TestApp::new().await;
    let owner = t.register().await;
    let other = t.register().await;
    let id = t.create(&owner, record_body()).await;
    t.take_over_ok(&owner, id, json!({ "releaseId": 1001 }))
        .await;

    let scan = t.scan(&other, &format!("discogs-id:{id}")).await;
    assert_eq!(scan["success"], false, "{scan}");
}

#[tokio::test]
async fn test_alias_of_a_removed_copy_resolves_to_nothing() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;
    let result = t
        .take_over_ok(&user, id, json!({ "releaseId": 1001 }))
        .await;
    sqlx::query("DELETE FROM collection_item WHERE user_id = $1 AND instance_id = $2")
        .bind(user.id)
        .bind(result.instance_id)
        .execute(&t.state.pool)
        .await
        .unwrap();

    let scan = t.scan(&user, &format!("discogs-id:{id}")).await;
    assert_eq!(scan["success"], false, "{scan}");
}

#[tokio::test]
async fn test_takeover_keeps_the_shelf_boundary() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let (status, types) = t
        .json(
            Method::POST,
            "/api/storage/types",
            &user,
            json!({ "name": "Regal", "media": "vinyl", "rows": 1, "columns": 2, "capacity": 1 }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{types}");
    let type_id = types["types"][0]["id"].as_i64().unwrap();
    let (status, units) = t
        .json(
            Method::POST,
            "/api/storage/units",
            &user,
            json!({ "name": "Wohnzimmer", "typeId": type_id }),
        )
        .await;
    assert_eq!(status, StatusCode::CREATED, "{units}");
    let unit_id = units["units"][0]["id"].as_i64().unwrap();

    t.create(
        &user,
        json!({ "artist": "ABBA", "title": "Arrival", "format": "LP" }),
    )
    .await;
    let id = t.create(&user, record_body()).await;
    let boundary = || async {
        sqlx::query_scalar::<_, i64>(
            "SELECT instance_id FROM storage_boundary WHERE unit_id = $1 AND compartment = 2",
        )
        .bind(unit_id)
        .fetch_optional(&t.state.pool)
        .await
        .unwrap()
    };
    assert_eq!(boundary().await, Some(id), "the record opens compartment 2");

    let result = t
        .take_over_ok(&user, id, json!({ "releaseId": 1001 }))
        .await;

    assert_eq!(boundary().await, Some(result.instance_id));
    let placement = result.placement.expect("shelves exist");
    assert_eq!(placement.slot.compartment, Some(2));
    assert_eq!(result.record.storage.and_then(|s| s.compartment), Some(2));
}

#[tokio::test]
async fn test_merge_moves_listens_into_the_existing_copy() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let first = t.create(&user, record_body()).await;
    t.listen(&user, first).await;
    let existing = t
        .take_over_ok(&user, first, json!({ "releaseId": 1001 }))
        .await;

    let second = t.create(&user, record_body()).await;
    t.listen(&user, second).await;
    t.listen(&user, second).await;
    let adds_before = t.requests("POST /users/").len();

    let merged = t
        .take_over_ok(&user, second, json!({ "releaseId": 1001, "mode": "merge" }))
        .await;

    assert_eq!(merged.mode, TakeoverMode::Merge);
    assert_eq!(merged.instance_id, existing.instance_id);
    assert_eq!(merged.record.listen_count, 3);
    assert!(merged.placement.is_none());
    // Nothing was added at Discogs
    assert_eq!(t.requests("POST /users/").len(), adds_before);
    assert_eq!(t.remote_collection(&user).len(), 1);
    let collection = t.collection(&user).await;
    assert_eq!(collection.releases.len(), 1);
    assert_eq!(collection.releases[0].instance_id, existing.instance_id);
    assert_eq!(t.alias(&user, second).await, Some(existing.instance_id));
    let scan = t.scan(&user, &format!("discogs-id:{second}")).await;
    assert_eq!(scan["record"]["discogsId"], 1001, "{scan}");
}

#[tokio::test]
async fn test_merge_needs_an_unambiguous_existing_copy() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;

    // Release not in the collection
    let (status, body) = t
        .take_over(&user, id, json!({ "releaseId": 1001, "mode": "merge" }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");

    // Two copies: the target must be named
    let a = t
        .take_over_ok(
            &user,
            t.create(&user, record_body()).await,
            json!({ "releaseId": 1001 }),
        )
        .await;
    let b = t
        .take_over_ok(
            &user,
            t.create(&user, record_body()).await,
            json!({ "releaseId": 1001 }),
        )
        .await;
    let (status, body) = t
        .take_over(&user, id, json!({ "releaseId": 1001, "mode": "merge" }))
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let message = body.to_string();
    assert!(
        message.contains(&a.instance_id.to_string())
            && message.contains(&b.instance_id.to_string()),
        "{message}"
    );
    let (status, _) = t
        .take_over(
            &user,
            id,
            json!({ "releaseId": 1001, "mode": "merge", "targetInstanceId": 12345 }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (_, detail) = t.detail(&user, id).await;
    assert_eq!(detail["source"], "manual", "nothing changed");

    let merged = t
        .take_over_ok(
            &user,
            id,
            json!({ "releaseId": 1001, "mode": "merge", "targetInstanceId": b.instance_id }),
        )
        .await;
    assert_eq!(merged.instance_id, b.instance_id);
    assert_eq!(t.collection(&user).await.releases.len(), 2);
}

#[tokio::test]
async fn test_failed_add_leaves_the_record_manual() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;

    let (status, _) = t
        .take_over(&user, id, json!({ "releaseId": ADD_FAILS }))
        .await;
    assert!(status.is_server_error(), "{status}");

    let (_, detail) = t.detail(&user, id).await;
    assert_eq!(detail["source"], "manual");
    assert_eq!(detail["notes"], "Signiert");
    assert_eq!(t.alias(&user, id).await, None);
}

#[tokio::test]
async fn test_failure_after_adding_removes_the_discogs_copy_again() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;
    t.listen(&user, id).await;

    let (status, _) = t
        .take_over(&user, id, json!({ "releaseId": FETCH_FAILS }))
        .await;
    assert!(status.is_server_error(), "{status}");

    // The compensation removed the new copy, so the next sync adds nothing
    assert_eq!(t.requests("DELETE /users/").len(), 1);
    assert!(t.remote_collection(&user).is_empty());
    let (_, detail) = t.detail(&user, id).await;
    assert_eq!(detail["source"], "manual");
    assert_eq!(detail["listen_count"], 1);
}

#[tokio::test]
async fn test_sync_after_takeover_keeps_exactly_one_copy() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;
    t.listen(&user, id).await;
    let result = t
        .take_over_ok(&user, id, json!({ "releaseId": 1001 }))
        .await;

    let (status, body) = t
        .json(Method::POST, "/api/collection/sync", &user, Value::Null)
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let collection = t.collection(&user).await;
    assert_eq!(collection.releases.len(), 1);
    assert_eq!(collection.releases[0].instance_id, result.instance_id);
    assert_eq!(collection.releases[0].listen_count, 1);
}

#[tokio::test]
async fn test_two_users_take_over_to_the_same_cached_release() {
    let t = TestApp::new().await;
    let alice = t.register().await;
    let bob = t.register().await;
    let a = t.create(&alice, record_body()).await;
    let b = t.create(&bob, record_body()).await;

    let first = t
        .take_over_ok(&alice, a, json!({ "releaseId": 1002 }))
        .await;
    let second = t.take_over_ok(&bob, b, json!({ "releaseId": 1002 })).await;

    assert_eq!(first.record.discogs_id, 1002);
    assert_eq!(second.record.discogs_id, 1002);
    assert_eq!(first.record.id, second.record.id, "one shared cache row");
}

async fn export(t: &TestApp, user: &User) -> Value {
    let (status, backup) = t
        .json(
            Method::GET,
            "/api/collection/export?format=json",
            user,
            Value::Null,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    backup
}

#[tokio::test]
async fn test_backup_carries_aliases_and_old_backups_do_not_duplicate() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let id = t.create(&user, record_body()).await;
    t.listen(&user, id).await;
    let before = export(&t, &user).await;
    let result = t
        .take_over_ok(&user, id, json!({ "releaseId": 1001 }))
        .await;

    let after = export(&t, &user).await;
    assert_eq!(after["format_version"], 5);
    assert_eq!(
        after["manual_aliases"],
        json!([{ "old_id": id, "instance_id": result.instance_id }])
    );

    // A backup from before the takeover adds its listens to the taken-over copy
    let mut older = before.clone();
    older["format_version"] = json!(4);
    older["releases"][0]["listen_history"] = json!(["2026-01-02T10:00:00Z"]);
    let (status, restored) = t
        .json(Method::POST, "/api/collection/restore", &user, older)
        .await;
    assert_eq!(status, StatusCode::OK, "{restored}");
    assert_eq!(restored["records_added"], 0);
    assert_eq!(restored["records_updated"], 1);
    assert_eq!(restored["listens_added"], 1);
    let collection = t.collection(&user).await;
    assert_eq!(collection.releases.len(), 1, "no manual duplicate");
    assert_eq!(collection.releases[0].id, 1001);
    assert_eq!(collection.releases[0].listen_count, 2);

    // Restoring into another account brings the alias along
    let other = t.register().await;
    let (status, restored) = t
        .json(Method::POST, "/api/collection/restore", &other, after)
        .await;
    assert_eq!(status, StatusCode::OK, "{restored}");
    assert_eq!(t.alias(&other, id).await, Some(result.instance_id));
    let scan = t.scan(&other, &format!("discogs-id:{id}")).await;
    assert_eq!(scan["record"]["discogsId"], 1001, "{scan}");
}

#[tokio::test]
async fn test_backup_with_invalid_alias_is_rejected() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let (status, body) = t
        .json(
            Method::POST,
            "/api/collection/restore",
            &user,
            json!({
                "format_version": 5,
                "releases": [],
                "manual_aliases": [{ "old_id": 5, "instance_id": 1 }]
            }),
        )
        .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
}

#[tokio::test]
async fn test_result_shows_the_taken_over_copy_when_the_release_is_owned_twice() {
    let t = TestApp::new().await;
    let user = t.register().await;
    let first = t
        .take_over_ok(
            &user,
            t.create(&user, record_body()).await,
            json!({ "releaseId": 1001 }),
        )
        .await;

    let mut body = record_body();
    body["mediaCondition"] = json!("Good (G)");
    let second = t.create(&user, body).await;
    let (status, _) = t
        .json(
            Method::PATCH,
            &format!("/api/records/{second}/sort-key"),
            &user,
            json!({ "sortKey": "Zweites Exemplar" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let result = t
        .take_over_ok(&user, second, json!({ "releaseId": 1001 }))
        .await;

    assert_ne!(result.instance_id, first.instance_id);
    assert_eq!(result.record.instance_id, Some(result.instance_id));
    assert_eq!(result.record.media_condition.as_deref(), Some("Good (G)"));
    assert_eq!(result.record.sort_key.as_deref(), Some("Zweites Exemplar"));

    // The detail view selects the copy; without one it shows the first copy
    let (status, copy) = t
        .detail_query(&user, &format!("1001?instance_id={}", result.instance_id))
        .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(copy["media_condition"], "Good (G)");
    assert_eq!(copy["instance_id"], result.instance_id);
    let (_, first_copy) = t.detail(&user, 1001).await;
    assert_eq!(
        first_copy["instance_id"],
        first.instance_id.min(result.instance_id)
    );

    // Merging into the first copy shows that copy, not the second one
    let third = t.create(&user, record_body()).await;
    let merged = t
        .take_over_ok(
            &user,
            third,
            json!({ "releaseId": 1001, "mode": "merge", "targetInstanceId": first.instance_id }),
        )
        .await;
    assert_eq!(merged.record.instance_id, Some(first.instance_id));
    assert_eq!(
        merged.record.media_condition.as_deref(),
        Some("Very Good Plus (VG+)")
    );
    assert_eq!(merged.record.sort_key, None);
}

#[tokio::test]
async fn test_restore_never_reuses_an_old_id_of_the_backup() {
    let t = TestApp::new().await;
    let owner = t.register().await;
    let taken = t
        .take_over_ok(
            &owner,
            t.create(&owner, record_body()).await,
            json!({ "releaseId": 1001 }),
        )
        .await;
    t.create(&owner, record_body()).await;
    let mut backup = export(&t, &owner).await;

    // An alias whose old ID the sequence has not reached yet, as after a restore into a new
    // instance: the restored manual record must not get it
    let next: i64 = sqlx::query_scalar("SELECT last_value FROM manual_record_seq")
        .fetch_one(&t.state.pool)
        .await
        .unwrap();
    let future_id = next - 50;
    backup["manual_aliases"] = json!([{ "old_id": future_id, "instance_id": taken.instance_id }]);

    let other = t.register().await;
    let (status, restored) = t
        .json(Method::POST, "/api/collection/restore", &other, backup)
        .await;
    assert_eq!(status, StatusCode::OK, "{restored}");

    let manual: Vec<i64> = sqlx::query_scalar(
        "SELECT rc.discogs_id FROM collection_item ci JOIN record_cache rc ON rc.id = ci.record_id
         WHERE ci.user_id = $1 AND rc.source = 'manual'",
    )
    .bind(other.id)
    .fetch_all(&t.state.pool)
    .await
    .unwrap();
    assert_eq!(manual.len(), 1);
    assert!(
        manual[0] < future_id,
        "{} must be below {future_id}",
        manual[0]
    );
    let scan = t.scan(&other, &format!("discogs-id:{future_id}")).await;
    assert_eq!(scan["record"]["discogsId"], 1001, "{scan}");
}
