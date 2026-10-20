use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{
    config::Config, db::init_pool, routes::create_app, services::storage::StorageService,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);
static DISCOGS_COUNTER: AtomicI64 = AtomicI64::new(0);

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
    (create_app(state.clone()), state)
}

/// Registers a fresh user and returns (user id, session cookie).
async fn create_user(app: &axum::Router) -> (i64, String) {
    let username = format!(
        "storage_user_{}_{}_{}",
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
                    json!({ "username": username, "password": "Password123!" }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let cookie = res
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    (body["id"].as_i64().unwrap(), cookie)
}

/// Globally unique Discogs ID (record_cache is shared between users and test runs).
fn next_discogs_id() -> i64 {
    let base = (chrono::Utc::now().timestamp_micros() % 1_000_000_000) * 1000;
    900_000_000_000 + base + DISCOGS_COUNTER.fetch_add(1, Ordering::SeqCst)
}

/// Adds one copy of a record and returns (discogs id, instance id).
async fn add_copy(
    state: &AppState,
    user_id: i64,
    artist: Option<&str>,
    title: &str,
    year: Option<&str>,
    format: &str,
    discs: Option<i16>,
) -> (i64, i64) {
    let discogs_id = next_discogs_id();
    let record_id: i64 = sqlx::query(
        "INSERT INTO record_cache (discogs_id, title, artist, release_year, format, disc_count)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(discogs_id)
    .bind(title)
    .bind(artist)
    .bind(year)
    .bind(format)
    .bind(discs)
    .fetch_one(&state.pool)
    .await
    .unwrap()
    .get("id");
    let instance_id = discogs_id;
    sqlx::query(
        "INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
         VALUES ($1, $2, $3, NOW())",
    )
    .bind(user_id)
    .bind(record_id)
    .bind(instance_id)
    .execute(&state.pool)
    .await
    .unwrap();
    (discogs_id, instance_id)
}

async fn add_lp(state: &AppState, user_id: i64, artist: &str, title: &str) -> (i64, i64) {
    add_copy(
        state,
        user_id,
        Some(artist),
        title,
        Some("1970"),
        "LP",
        Some(1),
    )
    .await
}

async fn call(
    app: &axum::Router,
    cookie: &str,
    method: Method,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::COOKIE, cookie);
    let body = match body {
        Some(json) => {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
            Body::from(json.to_string())
        }
        None => Body::empty(),
    };
    let res = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap()
    };
    (status, value)
}

async fn create_type(
    app: &axum::Router,
    cookie: &str,
    name: &str,
    media: &str,
    rows: i32,
    columns: i32,
    capacity: i32,
) -> i64 {
    let (status, body) = call(
        app,
        cookie,
        Method::POST,
        "/api/storage/types",
        Some(json!({ "name": name, "media": media, "rows": rows, "columns": columns, "capacity": capacity })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    body["types"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"] == name)
        .unwrap()["id"]
        .as_i64()
        .unwrap()
}

async fn create_unit(app: &axum::Router, cookie: &str, name: &str, type_id: i64) -> (i64, Value) {
    let (status, body) = call(
        app,
        cookie,
        Method::POST,
        "/api/storage/units",
        Some(json!({ "name": name, "typeId": type_id })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    let id = body["units"]
        .as_array()
        .unwrap()
        .iter()
        .find(|u| u["name"] == name)
        .unwrap()["id"]
        .as_i64()
        .unwrap();
    (id, body)
}

/// Used discs per compartment of the first medium in the overview.
async fn compartment_usage(app: &axum::Router, cookie: &str) -> Vec<i64> {
    let (status, layout) = call(app, cookie, Method::GET, "/api/storage/layout", None).await;
    assert_eq!(status, StatusCode::OK);
    layout["media"][0]["units"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|u| u["compartments"].as_array().unwrap().clone())
        .map(|c| c["used"].as_i64().unwrap())
        .collect()
}

#[tokio::test]
async fn test_storage_config_validation_and_conflicts() {
    let (app, _) = setup_app().await;
    let (_, cookie) = create_user(&app).await;

    let (status, _) = call(&app, "", Method::GET, "/api/storage/types", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    for invalid in [
        json!({ "name": " ", "media": "vinyl", "rows": 2, "columns": 2, "capacity": 70 }),
        json!({ "name": "K", "media": "vinyl", "rows": 0, "columns": 2, "capacity": 70 }),
        json!({ "name": "K", "media": "vinyl", "rows": 2, "columns": 13, "capacity": 70 }),
        json!({ "name": "K", "media": "vinyl", "rows": 2, "columns": 2, "capacity": 501 }),
    ] {
        let (status, body) = call(
            &app,
            &cookie,
            Method::POST,
            "/api/storage/types",
            Some(invalid),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    }

    let type_id = create_type(&app, &cookie, "Kallax 2×4", "vinyl", 2, 4, 70).await;
    let (status, _) = call(
        &app,
        &cookie,
        Method::POST,
        "/api/storage/types",
        Some(json!({ "name": "Kallax 2×4", "media": "vinyl", "rows": 1, "columns": 1, "capacity": 1 })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let (unit_id, body) = create_unit(&app, &cookie, "Kallax-1", type_id).await;
    assert_eq!(body["redistributed"], json!(["vinyl"]));
    assert_eq!(body["units"][0]["media"], "vinyl");

    let (status, _) = call(
        &app,
        &cookie,
        Method::POST,
        "/api/storage/units",
        Some(json!({ "name": "Kallax-1", "typeId": type_id })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "shelf names are unique");

    let (status, _) = call(
        &app,
        &cookie,
        Method::DELETE,
        &format!("/api/storage/types/{type_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "type still used by a shelf");

    let (status, _) = call(
        &app,
        &cookie,
        Method::PUT,
        "/api/storage/units/order",
        Some(json!({ "media": "vinyl", "unitIds": [unit_id, unit_id] })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Another user can neither see nor change this configuration.
    let (_, other) = create_user(&app).await;
    let (_, types) = call(&app, &other, Method::GET, "/api/storage/types", None).await;
    assert_eq!(types, json!([]));
    let (status, _) = call(
        &app,
        &other,
        Method::DELETE,
        &format!("/api/storage/units/{unit_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = call(
        &app,
        &other,
        Method::POST,
        "/api/storage/units",
        Some(json!({ "name": "Mine", "typeId": type_id })),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, body) = call(
        &app,
        &cookie,
        Method::DELETE,
        &format!("/api/storage/units/{unit_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["units"], json!([]));
    let (status, body) = call(
        &app,
        &cookie,
        Method::DELETE,
        &format!("/api/storage/types/{type_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["types"], json!([]));
}

#[tokio::test]
async fn test_first_shelf_distributes_evenly_and_collection_shows_slots() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    for i in 0..24 {
        add_lp(&state, user_id, &format!("Artist {i:02}"), "Album").await;
    }
    let (cd_id, _) = add_copy(
        &state,
        user_id,
        Some("Abba"),
        "Gold",
        Some("1992"),
        "CD",
        None,
    )
    .await;

    let small = create_type(&app, &cookie, "Kallax 2×2", "vinyl", 2, 2, 10).await;
    let large = create_type(&app, &cookie, "Kallax 1×4", "vinyl", 1, 4, 10).await;
    create_unit(&app, &cookie, "Kallax-1", small).await;
    create_unit(&app, &cookie, "Kallax-2", large).await;

    // 24 LPs over 8 compartments of 10 → 3 each, spread over both shelves.
    assert_eq!(compartment_usage(&app, &cookie).await, vec![3; 8]);

    let (_, collection) = call(
        &app,
        &cookie,
        Method::GET,
        "/api/collection?sort=artist&per_page=100",
        None,
    )
    .await;
    let releases = collection["releases"].as_array().unwrap();
    let cd = releases.iter().find(|r| r["id"] == cd_id).unwrap();
    assert!(cd.get("storage").is_none(), "no CD shelf configured");
    let last = releases.iter().rev().find(|r| r["id"] != cd_id).unwrap();
    assert_eq!(last["storage"]["unitName"], "Kallax-2");
    assert_eq!(last["storage"]["compartment"], 4);
    assert_eq!(last["storage"]["row"], 1);
    assert_eq!(last["storage"]["column"], 4);

    // Record details carry the slot and the neighbors.
    let discogs_id = releases.iter().find(|r| r["id"] != cd_id).unwrap()["id"]
        .as_i64()
        .unwrap();
    let (status, detail) = call(
        &app,
        &cookie,
        Method::GET,
        &format!("/api/records/{discogs_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(detail["storage"]["unitName"], "Kallax-1");
    assert_eq!(detail["storage"]["compartment"], 1);
    assert!(detail["storage_neighbors"]["previous"].is_null());
    assert_eq!(detail["storage_neighbors"]["next"]["artist"], "Artist 01");
}

#[tokio::test]
async fn test_layout_follows_the_collection_shelf_order() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    let artists = [
        Some("The Beatles"),
        Some("beatles"),
        Some("Ärzte"),
        Some("AC/DC"),
        Some("abba"),
        Some("Zappa"),
        None,
        Some("The The"),
        Some("Beatles"),
    ];
    for (i, artist) in artists.iter().enumerate() {
        let year = if i % 3 == 0 { None } else { Some("1980") };
        add_copy(
            &state,
            user_id,
            *artist,
            &format!("Title {i}"),
            year,
            "LP",
            Some(1),
        )
        .await;
    }
    let type_id = create_type(&app, &cookie, "Kallax 1×4", "vinyl", 1, 4, 3).await;
    create_unit(&app, &cookie, "K", type_id).await;

    let (_, collection) = call(
        &app,
        &cookie,
        Method::GET,
        "/api/collection?sort=artist&sort_order=asc&per_page=100",
        None,
    )
    .await;
    let compartments: Vec<i64> = collection["releases"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["storage"]["compartment"].as_i64().unwrap())
        .collect();
    assert_eq!(compartments.len(), artists.len());
    assert!(
        compartments.windows(2).all(|w| w[0] <= w[1]),
        "slots follow the collection's artist order: {compartments:?}"
    );
}

#[tokio::test]
async fn test_new_copy_moves_nothing_while_its_compartment_has_room() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    for artist in ["A", "C", "E", "G", "I", "K", "M", "O"] {
        add_lp(&state, user_id, artist, "LP").await;
    }
    let type_id = create_type(&app, &cookie, "Kallax 2×2", "vinyl", 2, 2, 4).await;
    create_unit(&app, &cookie, "Kallax-1", type_id).await;
    assert_eq!(compartment_usage(&app, &cookie).await, vec![2, 2, 2, 2]);

    let (discogs_id, instance_id) = add_lp(&state, user_id, "D", "New").await;
    let placement = StorageService::place_new_copy(&state.pool, user_id, discogs_id, instance_id)
        .await
        .unwrap()
        .expect("vinyl shelf exists");
    // "D" sorts after "C" and before the boundary "E" of compartment 2.
    assert_eq!(placement.slot.compartment, Some(1));
    assert_eq!(placement.slot.row, Some(1));
    assert_eq!(placement.slot.column, Some(1));
    assert!(placement.moves.is_empty(), "{:?}", placement.moves);
    assert_eq!(
        placement.neighbors.previous.unwrap().artist.as_deref(),
        Some("C")
    );
    assert_eq!(
        placement.neighbors.next.unwrap().artist.as_deref(),
        Some("E")
    );
    assert_eq!(compartment_usage(&app, &cookie).await, vec![3, 2, 2, 2]);
}

#[tokio::test]
async fn test_full_compartment_moves_one_copy_to_the_neighbor_and_persists() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    for artist in ["A", "B", "C", "D", "E", "F"] {
        add_lp(&state, user_id, artist, "LP").await;
    }
    // 6 copies on 3 compartments of 2 → [2, 2, 2]; then grow the capacity so there is room.
    let type_id = create_type(&app, &cookie, "Tiny", "vinyl", 1, 3, 2).await;
    create_unit(&app, &cookie, "Shelf", type_id).await;
    let (status, _) = call(
        &app,
        &cookie,
        Method::PUT,
        &format!("/api/storage/types/{type_id}"),
        Some(json!({ "name": "Tiny", "rows": 1, "columns": 3, "capacity": 3 })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    for artist in ["A1", "E1"] {
        let (id, instance) = add_lp(&state, user_id, artist, "LP").await;
        StorageService::place_new_copy(&state.pool, user_id, id, instance)
            .await
            .unwrap();
    }
    assert_eq!(compartment_usage(&app, &cookie).await, vec![3, 2, 3]);

    // "A2" belongs into the full compartment 1 → its last copy (B) moves to compartment 2.
    let (id, instance) = add_lp(&state, user_id, "A2", "LP").await;
    let placement = StorageService::place_new_copy(&state.pool, user_id, id, instance)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(placement.moves.len(), 1, "{:?}", placement.moves);
    let moved = &placement.moves[0];
    assert_eq!(moved.record.artist.as_deref(), Some("B"));
    assert_eq!(moved.from.compartment, Some(1));
    assert_eq!(moved.to.compartment, Some(2));
    assert_eq!(placement.slot.compartment, Some(1));
    assert_eq!(compartment_usage(&app, &cookie).await, vec![3, 3, 3]);

    // The balanced boundaries are stored: reading again moves nothing.
    let again = StorageService::placement_for_record(&state.pool, user_id, id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(again.slot, placement.slot);

    // A further copy finds no space anywhere → the last copy has no slot.
    let (id, instance) = add_lp(&state, user_id, "Z", "LP").await;
    let placement = StorageService::place_new_copy(&state.pool, user_id, id, instance)
        .await
        .unwrap()
        .unwrap();
    assert!(placement.slot.unplaced);
    let (_, layout) = call(&app, &cookie, Method::GET, "/api/storage/layout", None).await;
    assert_eq!(layout["media"][0]["unplacedCount"], 1);
}

#[tokio::test]
async fn test_double_lps_take_two_places_and_redistribution_preview() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    for artist in ["A", "B", "C", "D"] {
        add_copy(
            &state,
            user_id,
            Some(artist),
            "Double",
            Some("1970"),
            "Double LP",
            None,
        )
        .await;
    }
    let type_id = create_type(&app, &cookie, "Kallax 1×2", "vinyl", 1, 2, 10).await;
    let (unit_id, _) = create_unit(&app, &cookie, "K1", type_id).await;
    assert_eq!(
        compartment_usage(&app, &cookie).await,
        vec![4, 4],
        "format fallback counts 'Double LP' as 2 discs"
    );

    // Adding a second shelf is a structural change → automatic redistribution.
    let (_, body) = create_unit(&app, &cookie, "K2", type_id).await;
    assert_eq!(body["redistributed"], json!(["vinyl"]));
    assert_eq!(compartment_usage(&app, &cookie).await, vec![2, 2, 2, 2]);

    let (status, preview) = call(
        &app,
        &cookie,
        Method::GET,
        "/api/storage/redistribute/preview?media=vinyl",
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(preview["movedCount"], 0, "already evenly distributed");

    let (status, _) = call(
        &app,
        &cookie,
        Method::GET,
        "/api/storage/redistribute/preview?media=tape",
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (k2, _) = (unit_id, ());
    let (status, body) = call(
        &app,
        &cookie,
        Method::PUT,
        "/api/storage/units/order",
        Some(json!({ "media": "vinyl", "unitIds": [body["units"][1]["id"], k2] })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["units"][0]["name"], "K2");

    let (status, layout) = call(
        &app,
        &cookie,
        Method::POST,
        "/api/storage/redistribute",
        Some(json!({ "media": "vinyl" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(layout["media"][0]["units"][0]["name"], "K2");
    assert_eq!(
        layout["media"][0]["units"][0]["compartments"][0]["firstArtist"],
        "A"
    );
}

#[tokio::test]
async fn test_cd_shelf_and_placement_endpoint() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    let (lp_id, _) = add_lp(&state, user_id, "Miles Davis", "Kind of Blue").await;
    let (cd_id, _) = add_copy(&state, user_id, Some("Abba"), "Gold", None, "CD", Some(1)).await;

    let (status, _) = call(
        &app,
        &cookie,
        Method::GET,
        &format!("/api/storage/placement/{cd_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT, "no shelf configured yet");

    let cd_type = create_type(&app, &cookie, "IKEA CD", "cd", 12, 1, 11).await;
    create_unit(&app, &cookie, "CD-1", cd_type).await;

    let (status, placement) = call(
        &app,
        &cookie,
        Method::GET,
        &format!("/api/storage/placement/{cd_id}"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(placement["slot"]["unitName"], "CD-1");
    assert_eq!(placement["moves"], json!([]));

    let (status, _) = call(
        &app,
        &cookie,
        Method::GET,
        &format!("/api/storage/placement/{lp_id}"),
        None,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NO_CONTENT,
        "LPs are not stored in CD shelves"
    );

    let (status, _) = call(&app, &cookie, Method::GET, "/api/storage/placement/1", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (_, other) = create_user(&app).await;
    let (status, _) = call(
        &app,
        &other,
        Method::GET,
        &format!("/api/storage/placement/{cd_id}"),
        None,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "not in the other user's collection"
    );
    let (_, layout) = call(&app, &other, Method::GET, "/api/storage/layout", None).await;
    assert_eq!(layout, json!({ "media": [] }));
}
