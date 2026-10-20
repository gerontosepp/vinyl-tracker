use axum::{
    body::Body,
    http::{Method, Request, StatusCode, header},
};
use backend_rs::{config::Config, db::init_pool, routes::create_app, state::AppState};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::Row;
use std::sync::atomic::{AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);

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
        "print_user_{}_{}_{}",
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

/// Adds a record (shared cache) and one collection item per copy; returns the Discogs ID.
async fn add_record(
    state: &AppState,
    user_id: i64,
    discogs_id: i64,
    artist: &str,
    title: &str,
    genre: &str,
    copies: i64,
) -> i64 {
    let record_id: i64 = sqlx::query(
        "INSERT INTO record_cache (discogs_id, title, artist, release_year, format)
         VALUES ($1, $2, $3, '1977', 'LP') RETURNING id",
    )
    .bind(discogs_id)
    .bind(title)
    .bind(artist)
    .fetch_one(&state.pool)
    .await
    .unwrap()
    .get("id");
    sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, $2)")
        .bind(record_id)
        .bind(genre)
        .execute(&state.pool)
        .await
        .unwrap();
    for copy in 0..copies {
        sqlx::query(
            "INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
             VALUES ($1, $2, $3, NOW())",
        )
        .bind(user_id)
        .bind(record_id)
        .bind(discogs_id * 10 + copy)
        .execute(&state.pool)
        .await
        .unwrap();
    }
    discogs_id
}

async fn print(
    app: &axum::Router,
    cookie: Option<&str>,
    body: Value,
) -> (StatusCode, String, Vec<u8>) {
    let mut builder = Request::builder()
        .method(Method::POST)
        .uri("/api/print")
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    let res = app
        .clone()
        .oneshot(builder.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = res.status();
    let disposition = res
        .headers()
        .get(header::CONTENT_DISPOSITION)
        .map(|v| v.to_str().unwrap().to_string())
        .unwrap_or_default();
    let bytes = res.into_body().collect().await.unwrap().to_bytes().to_vec();
    (status, disposition, bytes)
}

fn problem_detail(bytes: &[u8]) -> String {
    let problem: Value = serde_json::from_slice(bytes).unwrap();
    assert_eq!(problem["status"], 400);
    problem["detail"].as_str().unwrap().to_string()
}

/// Lines of text shown in the PDF (WinAnsi decoded; tests only use ASCII).
fn pdf_lines(pdf: &[u8]) -> Vec<String> {
    let doc = lopdf::Document::load_mem(pdf).expect("valid PDF");
    let mut lines = Vec::new();
    for page_id in doc.get_pages().into_values() {
        let content = doc.get_and_decode_page_content(page_id).unwrap();
        for op in content.operations {
            if op.operator == "Tj"
                && let Some(lopdf::Object::String(bytes, _)) = op.operands.first()
            {
                lines.push(bytes.iter().map(|&b| b as char).collect());
            }
        }
    }
    lines
}

fn page_count(pdf: &[u8]) -> usize {
    lopdf::Document::load_mem(pdf).unwrap().get_pages().len()
}

#[tokio::test]
async fn test_print_requires_auth_and_valid_requests() {
    let (app, _) = setup_app().await;

    let (status, _, _) = print(&app, None, json!({ "template": "scan-list" })).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (_, cookie) = create_user(&app).await;

    let (status, _, body) = print(&app, Some(&cookie), json!({ "template": "poster" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let detail = problem_detail(&body);
    assert!(
        detail.contains("avery-3474") && detail.contains("scan-list"),
        "{detail}"
    );

    let (status, _, body) = print(
        &app,
        Some(&cookie),
        json!({ "template": "avery-3474", "options": { "start_position": 25 } }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(problem_detail(&body).contains("start_position"));

    // Empty collection -> nothing to print
    let (status, _, body) = print(&app, Some(&cookie), json!({ "template": "qr-cards" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(problem_detail(&body).contains("no records"));
}

#[tokio::test]
async fn test_print_templates_and_scopes() {
    let (app, state) = setup_app().await;
    let (user_id, cookie) = create_user(&app).await;
    let (other_id, _) = create_user(&app).await;

    // record_cache is shared between tests: use Discogs IDs unique to this run
    let base = 600_000_000 + (chrono::Utc::now().timestamp_micros() % 10_000_000) * 10;
    let zappa = add_record(
        &state,
        user_id,
        base,
        "Frank Zappa",
        "Sheik Yerbouti",
        "Rock",
        2,
    )
    .await;
    let abba = add_record(&state, user_id, base + 1, "ABBA", "Arrival", "Pop", 1).await;
    let davis = add_record(
        &state,
        user_id,
        base + 2,
        "Miles Davis",
        "Kind of Blue",
        "Jazz",
        1,
    )
    .await;
    let foreign = add_record(&state, other_id, base + 3, "Foreign", "Not Mine", "Rock", 1).await;

    // 1. Whole collection, every template: one entry per copy, sorted by artist
    for (template, pages) in [("avery-3474", 1), ("scan-list", 1), ("qr-cards", 1)] {
        let (status, disposition, pdf) =
            print(&app, Some(&cookie), json!({ "template": template })).await;
        assert_eq!(status, StatusCode::OK, "{template}");
        assert_eq!(
            disposition,
            format!("attachment; filename=\"vinyl_{template}.pdf\"")
        );
        assert_eq!(&pdf[0..4], b"%PDF");
        assert_eq!(page_count(&pdf), pages, "{template}");
    }
    let (_, _, pdf) = print(&app, Some(&cookie), json!({ "template": "scan-list" })).await;
    let artists: Vec<String> = pdf_lines(&pdf)
        .into_iter()
        .filter(|l| ["ABBA", "Miles Davis", "Frank Zappa", "Foreign"].contains(&l.as_str()))
        .collect();
    assert_eq!(
        artists,
        ["ABBA", "Frank Zappa", "Frank Zappa", "Miles Davis"]
    );

    // 2. Filter scope: genre Jazz
    let (status, _, pdf) = print(
        &app,
        Some(&cookie),
        json!({ "template": "scan-list", "scope": { "type": "filter", "filter": { "genres": "Jazz" } } }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let lines = pdf_lines(&pdf);
    assert!(lines.contains(&"Kind of Blue".to_string()));
    assert!(!lines.contains(&"Arrival".to_string()));
    assert!(lines.contains(&format!("{davis}")));

    // 3. Selected IDs: foreign records are ignored, copies are kept
    let (status, _, pdf) = print(
        &app,
        Some(&cookie),
        json!({
            "template": "scan-list",
            "scope": { "type": "ids", "discogs_ids": [zappa, foreign] },
            "options": { "language": "en" }
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let lines = pdf_lines(&pdf);
    assert_eq!(lines.iter().filter(|l| *l == "Sheik Yerbouti").count(), 2);
    assert!(!lines.contains(&"Not Mine".to_string()));
    assert!(lines.contains(&"Page 1 of 1".to_string()));

    // Only foreign IDs -> empty scope
    let (status, _, _) = print(
        &app,
        Some(&cookie),
        json!({ "template": "scan-list", "scope": { "type": "ids", "discogs_ids": [foreign] } }),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // 4. Labels from position 24: the first label fills the sheet, the rest starts a new page
    let (status, _, pdf) = print(
        &app,
        Some(&cookie),
        json!({ "template": "avery-3474", "options": { "start_position": 24 } }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(page_count(&pdf), 2);
    assert!(pdf_lines(&pdf).contains(&format!("ID: {abba}")));
}
