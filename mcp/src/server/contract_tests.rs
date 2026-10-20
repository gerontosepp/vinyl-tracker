//! Contract tests: a mock backend answers with the shared `vinyl-api-types` (serialized exactly
//! like the real backend) and the MCP tools must report the backend data correctly.

use super::VinylMcpServer;
use crate::client::VinylApiClient;
use crate::models::*;
use axum::{
    Json, Router,
    http::StatusCode,
    routing::{get, post},
};
use rmcp::handler::server::wrapper::Parameters;
use vinyl_api_types::{
    analytics::CollectionValueData,
    scan::{DiscogsMatchDto, TrackedRecordDto},
};

fn sync_result() -> SyncResultDto {
    SyncResultDto {
        status: "SUCCESS".to_string(),
        added: 3,
        updated: 2,
        removed: 1,
        total: 120,
        placement: None,
    }
}

fn tracked_record() -> TrackedRecordDto {
    TrackedRecordDto {
        discogs_id: 42,
        title: "Kind of Blue".to_string(),
        artist: "Miles Davis".to_string(),
        thumb_url: None,
    }
}

async fn mock_backend() -> VinylMcpServer {
    let app = Router::new()
        .route(
            "/api/collection/sync",
            post(|| async { Json(sync_result()) }),
        )
        .route(
            "/api/collection/releases/{id}",
            post(|| async { Json(sync_result()) }),
        )
        .route(
            "/api/analytics/top",
            get(|| async {
                Json(vec![TopRecordDto {
                    discogs_id: 1_000_001,
                    title: "Miles Davis - Kind of Blue".to_string(),
                    record_title: "Kind of Blue".to_string(),
                    artist: "Miles Davis".to_string(),
                    thumb_url: None,
                    count: 7,
                }])
            }),
        )
        .route(
            "/api/analytics/recent",
            get(|| async {
                Json(vec![ListenEventDto {
                    id: 1,
                    record: Some(tracked_record()),
                    timestamp: "2026-10-19T12:00:00Z".to_string(),
                }])
            }),
        )
        .route(
            "/api/analytics/collection/value",
            get(|| async {
                let eur = |value| CollectionValueData {
                    currency: "EUR".to_string(),
                    value,
                };
                Json(CollectionValueResponse {
                    minimum: eur(100.0),
                    median: eur(250.5),
                    maximum: eur(400.0),
                })
            }),
        )
        .route(
            "/api/scan",
            post(|Json(req): Json<ScanRequest>| async move {
                if req.barcode == "known" {
                    (
                        StatusCode::OK,
                        Json(ScanResultDto {
                            success: true,
                            message: "Listen logged".to_string(),
                            record: Some(tracked_record()),
                            discogs_matches: None,
                        }),
                    )
                } else {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(ScanResultDto {
                            success: false,
                            message: "Not in collection".to_string(),
                            record: None,
                            discogs_matches: Some(vec![DiscogsMatchDto {
                                id: 7,
                                title: "John Coltrane - Blue Train".to_string(),
                                year: Some("1957".to_string()),
                                thumb_url: None,
                                cover_image: None,
                                format: Some(vec!["Vinyl".to_string()]),
                                country: Some("US".to_string()),
                            }]),
                        }),
                    )
                }
            }),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

    VinylMcpServer::new(VinylApiClient::new(
        base_url,
        Some("test-token".to_string()),
        None,
        None,
    ))
}

#[tokio::test]
async fn test_sync_collection_reports_all_counts() {
    let server = mock_backend().await;
    let output = server.sync_collection().await.expect("sync must succeed");
    assert_eq!(
        output,
        "Sync completed successfully: 3 added, 2 updated, 1 removed (120 records in total)."
    );
}

#[tokio::test]
async fn test_add_to_collection_reports_sync_result() {
    let server = mock_backend().await;
    let output = server
        .add_to_collection(Parameters(AddToCollectionArgs { release_id: 99 }))
        .await
        .expect("add must succeed");
    assert!(output.contains("release 99"), "{output}");
    assert!(output.contains("3 added, 2 updated, 1 removed"), "{output}");
}

#[tokio::test]
async fn test_get_top_records_includes_play_count() {
    let server = mock_backend().await;
    let output = server
        .get_top_records(Parameters(AnalyticsDateRangeArgs::default()))
        .await
        .expect("top records must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json[0]["recordTitle"], "Kind of Blue");
    assert_eq!(json[0]["count"], 7);
}

#[tokio::test]
async fn test_get_recent_listens_includes_record() {
    let server = mock_backend().await;
    let output = server
        .get_recent_listens(Parameters(AnalyticsDateRangeArgs::default()))
        .await
        .expect("recent listens must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json[0]["record"]["discogsId"], 42);
    assert_eq!(json[0]["record"]["artist"], "Miles Davis");
}

#[tokio::test]
async fn test_get_collection_value_includes_currency() {
    let server = mock_backend().await;
    let output = server
        .get_collection_value()
        .await
        .expect("collection value must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json["median"]["value"], 250.5);
    assert_eq!(json["median"]["currency"], "EUR");
}

#[tokio::test]
async fn test_scan_barcode_returns_recognized_record() {
    let server = mock_backend().await;
    let output = server
        .scan_barcode(Parameters(ScanBarcodeArgs {
            barcode: "known".to_string(),
        }))
        .await
        .expect("scan must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json["record"]["title"], "Kind of Blue");
}

#[tokio::test]
async fn test_scan_barcode_returns_discogs_suggestions_for_unknown_barcode() {
    let server = mock_backend().await;
    let output = server
        .scan_barcode(Parameters(ScanBarcodeArgs {
            barcode: "unknown".to_string(),
        }))
        .await
        .expect("scan result with suggestions must be returned, not an error");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json["success"], false);
    assert_eq!(json["discogsMatches"][0]["id"], 7);
}
