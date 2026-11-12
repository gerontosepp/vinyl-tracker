//! Integration tests for the provider-independent AI connections (#393).

use axum::{
    Json, Router,
    body::Body,
    http::{HeaderMap, Method, Request, StatusCode, header},
    routing::{get, post},
};
use backend_rs::{
    config::Config,
    db::init_pool,
    models::ai_connection::{AiConnectionDto, AiConnectionTestDto, AiModelsDto, AiPresetDto},
    routes::create_app,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use std::sync::atomic::{AtomicU64, Ordering};
use tower::ServiceExt;

static USER_COUNTER: AtomicU64 = AtomicU64::new(1);
const API_KEY: &str = "sk-test-key";
const MODEL: &str = "test/vision-model";

async fn setup() -> (Router, AppState) {
    dotenvy::dotenv().ok();
    let config = Config::from_env();
    let pool = init_pool(&config).await.unwrap();
    backend_rs::db::migrations::run_migrations(&pool)
        .await
        .unwrap();
    let state = AppState::new(pool, config);
    (create_app(state.clone()), state)
}

async fn register(app: &Router) -> (i64, String) {
    let username = format!(
        "ai_connection_{}_{}_{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
        USER_COUNTER.fetch_add(1, Ordering::SeqCst)
    );
    let (status, body) = call(
        app,
        Method::POST,
        "/api/users/register",
        None,
        serde_json::to_vec(&json!({ "username": username, "password": "Password123!" })).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let body: Value = serde_json::from_slice(&body).unwrap();
    (
        body["id"].as_i64().unwrap(),
        body["token"].as_str().unwrap().to_string(),
    )
}

async fn call(
    app: &Router,
    method: Method,
    uri: &str,
    token: Option<&str>,
    body: Vec<u8>,
) -> (StatusCode, Vec<u8>) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json");
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

fn create_body(name: &str, kind: &str, base_url: &str, api_key: Option<&str>) -> Vec<u8> {
    let mut body = json!({
        "name": name,
        "kind": kind,
        "baseUrl": base_url,
        "model": MODEL,
    });
    if let Some(api_key) = api_key {
        body["apiKey"] = json!(api_key);
    }
    serde_json::to_vec(&body).unwrap()
}

async fn create_connection(
    app: &Router,
    token: &str,
    name: &str,
    kind: &str,
    base_url: &str,
    api_key: Option<&str>,
) -> AiConnectionDto {
    let (status, body) = call(
        app,
        Method::POST,
        "/api/users/me/ai/connections",
        Some(token),
        create_body(name, kind, base_url, api_key),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CREATED,
        "{}",
        String::from_utf8_lossy(&body)
    );
    serde_json::from_slice(&body).unwrap()
}

async fn list_connections(app: &Router, token: &str) -> Vec<AiConnectionDto> {
    let (status, body) = call(
        app,
        Method::GET,
        "/api/users/me/ai/connections",
        Some(token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    serde_json::from_slice(&body).unwrap()
}

#[tokio::test]
async fn test_crud_default_and_key_redaction() {
    let (app, _state) = setup().await;
    let (user_id, token) = register(&app).await;

    let first = create_connection(
        &app,
        &token,
        "OpenRouter",
        "openrouter",
        "https://openrouter.ai/api/v1",
        Some(API_KEY),
    )
    .await;
    assert!(first.is_default, "the first connection becomes default");
    assert!(first.has_api_key);
    assert!(!serde_json::to_string(&first).unwrap().contains(API_KEY));

    let second = create_connection(
        &app,
        &token,
        "Ollama",
        "ollama",
        "http://localhost:11434/v1",
        None,
    )
    .await;
    assert!(!second.is_default);

    let (status, _) = call(
        &app,
        Method::PUT,
        &format!("/api/users/me/ai/connections/{}/default", second.id),
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let list = list_connections(&app, &token).await;
    assert_eq!(list.iter().filter(|c| c.is_default).count(), 1);
    assert_eq!(list.iter().find(|c| c.is_default).unwrap().id, second.id);

    let (status, _) = call(
        &app,
        Method::DELETE,
        &format!("/api/users/me/ai/connections/{}", second.id),
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let list = list_connections(&app, &token).await;
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, first.id);
    assert!(
        list[0].is_default,
        "deleting the default promotes the remaining one"
    );

    let (status, _) = call(
        &app,
        Method::DELETE,
        &format!("/api/users/me/ai/connections/{}", first.id),
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(list_connections(&app, &token).await.is_empty());
    let _ = user_id;
}

#[tokio::test]
async fn test_foreign_connections_are_invisible() {
    let (app, _state) = setup().await;
    let (_, token_a) = register(&app).await;
    let (_, token_b) = register(&app).await;
    let connection = create_connection(
        &app,
        &token_a,
        "OpenRouter",
        "openrouter",
        "https://openrouter.ai/api/v1",
        Some(API_KEY),
    )
    .await;

    for method in [Method::GET, Method::PUT, Method::DELETE] {
        let body = if method == Method::PUT {
            create_body(
                "Hijack",
                "openrouter",
                "https://openrouter.ai/api/v1",
                Some("x"),
            )
        } else {
            vec![]
        };
        let (status, _) = call(
            &app,
            method,
            &format!("/api/users/me/ai/connections/{}", connection.id),
            Some(&token_b),
            body,
        )
        .await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }
}

#[tokio::test]
async fn test_base_url_validation() {
    let (app, _state) = setup().await;
    let (_, token) = register(&app).await;

    for url in [
        "http://169.254.169.254/latest",
        "http://metadata.google.internal/v1",
        "http://example.com/v1",
        "ftp://example.com/v1",
        "https://user:pass@example.com/v1",
    ] {
        let (status, body) = call(
            &app,
            Method::POST,
            "/api/users/me/ai/connections",
            Some(&token),
            create_body("Bad", "custom", url, Some(API_KEY)),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "{url} must be rejected: {}",
            String::from_utf8_lossy(&body)
        );
    }

    let local = create_connection(
        &app,
        &token,
        "Ollama",
        "ollama",
        "http://localhost:11434/v1",
        None,
    )
    .await;
    assert_eq!(local.kind, "ollama");
}

#[tokio::test]
async fn test_allowlist_restricts_base_urls() {
    let (app, state) = setup().await;
    let (_, token) = register(&app).await;
    // The AppState config is shared; validate through a direct service call so the allowlist
    // cannot affect other tests running in parallel.
    let allowed = backend_rs::services::ai_connection_service::validate_base_url(
        "https://api.example.com/v1",
        &Config {
            ai_base_url_allowed_hosts: vec!["example.com".to_string()],
            ..state.config.as_ref().clone()
        },
    );
    assert!(allowed.is_ok());
    let blocked = backend_rs::services::ai_connection_service::validate_base_url(
        "https://api.other.com/v1",
        &Config {
            ai_base_url_allowed_hosts: vec!["example.com".to_string()],
            ..state.config.as_ref().clone()
        },
    );
    assert!(blocked.is_err());
    let _ = token;
}

#[tokio::test]
async fn test_key_is_encrypted_and_can_be_removed() {
    let (app, state) = setup().await;
    let (user_id, token) = register(&app).await;
    let connection = create_connection(
        &app,
        &token,
        "OpenRouter",
        "openrouter",
        "https://openrouter.ai/api/v1",
        Some(API_KEY),
    )
    .await;

    let stored: String = sqlx::query_scalar("SELECT api_key FROM ai_connection WHERE id = $1")
        .bind(connection.id)
        .fetch_one(&state.pool)
        .await
        .unwrap();
    assert_ne!(stored, API_KEY);
    assert_eq!(state.crypto.decrypt(&stored).as_deref(), Some(API_KEY));

    let body = json!({
        "name": "OpenRouter",
        "kind": "openrouter",
        "baseUrl": "https://openrouter.ai/api/v1",
        "model": MODEL,
        "apiKey": ""
    });
    let (status, body) = call(
        &app,
        Method::PUT,
        &format!("/api/users/me/ai/connections/{}", connection.id),
        Some(&token),
        serde_json::to_vec(&body).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let updated: AiConnectionDto = serde_json::from_slice(&body).unwrap();
    assert!(!updated.has_api_key);
    let _ = user_id;
}

async fn mock_provider() -> String {
    let chat = |Json(body): Json<Value>| async move {
        assert_eq!(body["model"], MODEL);
        Json(json!({
            "choices": [{ "message": { "role": "assistant", "content": "OK" } }]
        }))
    };
    let models = || async {
        Json(json!({
            "data": [{ "id": "z/model" }, { "id": "a/model" }]
        }))
    };
    let app = Router::new()
        .route("/v1/chat/completions", post(chat))
        .route("/v1/models", get(models));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}/v1")
}

#[tokio::test]
async fn test_connection_test_and_models() {
    let (app, _state) = setup().await;
    let (_, token) = register(&app).await;
    let base_url = mock_provider().await;
    let connection =
        create_connection(&app, &token, "Local", "custom", &base_url, Some(API_KEY)).await;

    let (status, body) = call(
        &app,
        Method::POST,
        &format!("/api/users/me/ai/connections/{}/test", connection.id),
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    let result: AiConnectionTestDto = serde_json::from_slice(&body).unwrap();
    assert!(result.ok);
    assert_eq!(result.model, MODEL);

    let (status, body) = call(
        &app,
        Method::GET,
        &format!("/api/users/me/ai/connections/{}/models", connection.id),
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let models: AiModelsDto = serde_json::from_slice(&body).unwrap();
    assert!(models.supported);
    assert_eq!(models.models, ["a/model", "z/model"]);
}

#[tokio::test]
async fn test_presets_and_alias() {
    let (app, _state) = setup().await;
    let (_, token) = register(&app).await;

    let (status, body) = call(
        &app,
        Method::GET,
        "/api/users/me/ai/presets",
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let presets: Vec<AiPresetDto> = serde_json::from_slice(&body).unwrap();
    assert!(presets.iter().any(|preset| preset.kind == "openrouter"));
    assert!(presets.iter().any(|preset| preset.kind == "ollama"));

    let (status, body) = call(
        &app,
        Method::PUT,
        "/api/users/me/openrouter",
        Some(&token),
        serde_json::to_vec(&json!({ "apiKey": API_KEY, "model": MODEL })).unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    let settings: backend_rs::models::label_photo::OpenRouterSettingsDto =
        serde_json::from_slice(&body).unwrap();
    assert!(settings.has_api_key);
    assert_eq!(settings.model, MODEL);

    let list = list_connections(&app, &token).await;
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].kind, "openrouter");
    assert!(list[0].is_default);
}

async fn mock_auth_provider(expect: &'static str) -> String {
    let chat = move |headers: HeaderMap, Json(body): Json<Value>| async move {
        match expect {
            "bearer" => assert_eq!(
                headers[header::AUTHORIZATION].to_str().unwrap(),
                format!("Bearer {API_KEY}")
            ),
            "api-key-header" => assert_eq!(headers["api-key"].to_str().unwrap(), API_KEY),
            "none" => {
                assert!(headers.get(header::AUTHORIZATION).is_none());
                assert!(headers.get("api-key").is_none());
            }
            _ => unreachable!(),
        }
        assert_eq!(headers["x-custom"].to_str().unwrap(), "value");
        assert!(body["max_tokens"].is_number(), "max_tokens is sent");
        Json(json!({
            "choices": [{ "message": { "role": "assistant", "content": "OK" } }]
        }))
    };
    let app = Router::new().route("/v1/chat/completions", post(chat));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}/v1")
}

#[tokio::test]
async fn test_all_auth_styles_and_extra_headers() {
    for style in ["bearer", "api-key-header", "none"] {
        let (app, _state) = setup().await;
        let (_, token) = register(&app).await;
        let base_url = mock_auth_provider(style).await;
        let (status, body) = call(
            &app,
            Method::POST,
            "/api/users/me/ai/connections",
            Some(&token),
            serde_json::to_vec(&json!({
                "name": format!("Auth {style}"),
                "kind": "custom",
                "baseUrl": base_url,
                "model": MODEL,
                "authStyle": style,
                "apiKey": if style == "none" { Value::Null } else { json!(API_KEY) },
                "extraHeaders": { "x-custom": "value" }
            }))
            .unwrap(),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::CREATED,
            "{}",
            String::from_utf8_lossy(&body)
        );
        let connection: AiConnectionDto = serde_json::from_slice(&body).unwrap();
        let (status, body) = call(
            &app,
            Method::POST,
            &format!("/api/users/me/ai/connections/{}/test", connection.id),
            Some(&token),
            vec![],
        )
        .await;
        assert_eq!(
            status,
            StatusCode::OK,
            "{style}: {}",
            String::from_utf8_lossy(&body)
        );
    }
}

async fn mock_status_provider(status: StatusCode) -> String {
    let chat = move || async move {
        (
            status,
            Json(json!({ "error": "provider rejected the request" })),
        )
    };
    let app = Router::new().route("/v1/chat/completions", post(chat));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}/v1")
}

#[tokio::test]
async fn test_provider_errors_are_mapped_to_problem_details() {
    for (provider_status, expected) in [
        (StatusCode::UNAUTHORIZED, StatusCode::BAD_REQUEST),
        (StatusCode::NOT_FOUND, StatusCode::BAD_REQUEST),
        (StatusCode::UNPROCESSABLE_ENTITY, StatusCode::BAD_REQUEST),
        (StatusCode::TOO_MANY_REQUESTS, StatusCode::TOO_MANY_REQUESTS),
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            StatusCode::INTERNAL_SERVER_ERROR,
        ),
    ] {
        let (app, _state) = setup().await;
        let (_, token) = register(&app).await;
        let base_url = mock_status_provider(provider_status).await;
        let connection =
            create_connection(&app, &token, "Local", "custom", &base_url, Some(API_KEY)).await;
        let (status, body) = call(
            &app,
            Method::POST,
            &format!("/api/users/me/ai/connections/{}/test", connection.id),
            Some(&token),
            vec![],
        )
        .await;
        assert_eq!(
            status,
            expected,
            "provider {provider_status}: {}",
            String::from_utf8_lossy(&body)
        );
    }
}

#[tokio::test]
async fn test_models_endpoint_without_provider_support() {
    let (app, _state) = setup().await;
    let (_, token) = register(&app).await;
    let chat = || async { Json(json!({ "choices": [{ "message": { "content": "OK" } }] })) };
    let app_mock = Router::new().route("/v1/chat/completions", post(chat));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app_mock).await.unwrap() });
    let connection = create_connection(
        &app,
        &token,
        "Local",
        "custom",
        &format!("http://{addr}/v1"),
        Some(API_KEY),
    )
    .await;

    let (status, body) = call(
        &app,
        Method::GET,
        &format!("/api/users/me/ai/connections/{}/models", connection.id),
        Some(&token),
        vec![],
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let models: AiModelsDto = serde_json::from_slice(&body).unwrap();
    assert!(!models.supported);
    assert!(models.models.is_empty());
}

#[tokio::test]
async fn test_update_without_key_keeps_the_stored_key() {
    let (app, _state) = setup().await;
    let (_, token) = register(&app).await;
    let connection = create_connection(
        &app,
        &token,
        "OpenRouter",
        "openrouter",
        "https://openrouter.ai/api/v1",
        Some(API_KEY),
    )
    .await;

    let (status, body) = call(
        &app,
        Method::PUT,
        &format!("/api/users/me/ai/connections/{}", connection.id),
        Some(&token),
        serde_json::to_vec(&json!({
            "name": "OpenRouter",
            "kind": "openrouter",
            "baseUrl": "https://openrouter.ai/api/v1",
            "model": "other/model"
        }))
        .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    let updated: AiConnectionDto = serde_json::from_slice(&body).unwrap();
    assert!(updated.has_api_key);
}

#[tokio::test]
async fn test_extra_headers_reject_secrets() {
    let (app, _state) = setup().await;
    let (_, token) = register(&app).await;
    for headers in [
        json!({ "Authorization": "secret" }),
        json!({ "x-goog-api-key": "secret" }),
        json!({ "x-custom": 42 }),
    ] {
        let (status, body) = call(
            &app,
            Method::POST,
            "/api/users/me/ai/connections",
            Some(&token),
            serde_json::to_vec(&json!({
                "name": "Bad headers",
                "kind": "custom",
                "baseUrl": "https://example.com/v1",
                "model": MODEL,
                "extraHeaders": headers
            }))
            .unwrap(),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "{}",
            String::from_utf8_lossy(&body)
        );
    }
}
