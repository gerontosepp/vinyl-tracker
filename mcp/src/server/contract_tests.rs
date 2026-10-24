//! Contract tests: a mock backend answers with the shared `vinyl-api-types` (serialized exactly
//! like the real backend) and the MCP tools must report the backend data correctly.

use super::VinylMcpServer;
use crate::client::VinylApiClient;
use crate::models::*;
use axum::{
    Json, Router,
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch, post},
};
use rmcp::handler::server::wrapper::Parameters;
use std::collections::HashMap;
use vinyl_api_types::{
    analytics::CollectionValueData,
    collection::BasicInformation,
    discogs::{DiscogsArtist, DiscogsPagination, DiscogsSearchResult},
    scan::{DiscogsMatchDto, TrackedRecordDto},
    storage::{
        MediaLayoutDto, StorageCompartmentDto, StorageMedia, StorageMoveDto, StorageNeighborsDto,
        StorageRecordRefDto, StorageSlotDto, StorageUnitLayoutDto,
    },
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

fn slot(compartment: i32) -> StorageSlotDto {
    StorageSlotDto {
        unit_id: Some(3),
        unit_name: Some("Kallax-1".to_string()),
        compartment: Some(compartment),
        row: Some(1),
        column: Some(compartment),
        oversized: false,
        unplaced: false,
    }
}

fn record_ref(discogs_id: i64, artist: &str, title: &str) -> StorageRecordRefDto {
    StorageRecordRefDto {
        discogs_id,
        artist: Some(artist.to_string()),
        title: title.to_string(),
    }
}

fn placement(discogs_id: i64) -> StoragePlacementDto {
    StoragePlacementDto {
        discogs_id,
        slot: slot(2),
        neighbors: StorageNeighborsDto {
            previous: Some(record_ref(10, "Can", "Tago Mago")),
            next: Some(record_ref(11, "Cure", "Disintegration")),
        },
        moves: vec![StorageMoveDto {
            record: record_ref(12, "Cream", "Disraeli Gears"),
            from: slot(2),
            to: slot(3),
        }],
    }
}

fn collection_release(storage: Option<StorageSlotDto>) -> CollectionRelease {
    CollectionRelease {
        id: 42,
        instance_id: 4200,
        listen_count: 3,
        date_added: "2026-10-01T10:00:00Z".to_string(),
        rating: None,
        basic_information: BasicInformation {
            id: 42,
            title: "Kind of Blue".to_string(),
            artists: vec![DiscogsArtist {
                name: "Miles Davis".to_string(),
                id: None,
            }],
            year: Some(1959),
            thumb_url: None,
            cover_image: None,
            tracklist: None,
            formats: None,
            labels: None,
            genres: vec!["Jazz".to_string()],
            styles: Vec::new(),
            format: "LP".to_string(),
            lowest_price: None,
            median_price: None,
        },
        media_condition: None,
        sleeve_condition: None,
        last_played_at: None,
        notes: None,
        sort_key: None,
        storage,
    }
}

fn storage_layout() -> StorageLayoutDto {
    StorageLayoutDto {
        media: vec![MediaLayoutDto {
            media: StorageMedia::Vinyl,
            units: vec![StorageUnitLayoutDto {
                id: 3,
                name: "Kallax-1".to_string(),
                type_name: "Kallax 1×4".to_string(),
                rows: 1,
                columns: 4,
                compartments: vec![StorageCompartmentDto {
                    number: 1,
                    row: 1,
                    column: 1,
                    capacity: 70,
                    used: 64,
                    count: 60,
                    first_artist: Some("ABBA".to_string()),
                    last_artist: Some("Beatles".to_string()),
                    oversized: false,
                }],
            }],
            unplaced_count: 2,
        }],
    }
}

fn label_photo(id: i64, status: LabelPhotoStatus, discogs_id: Option<i64>) -> LabelPhotoDto {
    LabelPhotoDto {
        id,
        status,
        discogs_id,
        created_at: "2026-10-22T09:00:00Z".to_string(),
        processed_at: None,
        identify_state: None,
        suggestion: None,
        identify_error: None,
        identify_model: None,
    }
}

async fn mock_backend() -> VinylMcpServer {
    let app = Router::new()
        .route(
            "/api/discogs/search",
            get(|Query(query): Query<HashMap<String, String>>| async move {
                // Echo the received criteria so the test sees what was passed on
                let mut criteria: Vec<String> =
                    query.iter().map(|(k, v)| format!("{k}={v}")).collect();
                criteria.sort();
                Json(DiscogsSearchResponse {
                    pagination: DiscogsPagination {
                        page: 1,
                        pages: 1,
                        per_page: 50,
                        items: 1,
                    },
                    results: vec![DiscogsSearchResult {
                        id: 804,
                        title: criteria.join("&"),
                        thumb: None,
                        cover_image: None,
                        year: Some("1973".to_string()),
                        format: None,
                        genre: None,
                        style: None,
                        barcode: None,
                        catno: Some("SHVL 804".to_string()),
                        label: Some(vec!["Harvest".to_string()]),
                        country: Some("UK".to_string()),
                        type_name: Some("release".to_string()),
                    }],
                })
            }),
        )
        .route(
            "/api/label-photos",
            get(|Query(query): Query<HashMap<String, String>>| async move {
                assert_eq!(query.get("status").map(String::as_str), Some("pending"));
                let limit: usize = query["limit"].parse().unwrap();
                let photos: Vec<LabelPhotoDto> = [5, 6, 7]
                    .into_iter()
                    .take(limit)
                    .map(|id| label_photo(id, LabelPhotoStatus::Pending, None))
                    .collect();
                Json(LabelPhotosDto {
                    photos,
                    pending_count: 3,
                })
            }),
        )
        .route(
            "/api/label-photos/{id}/image",
            get(|Path(id): Path<i64>| async move {
                ([("content-type", "image/jpeg")], format!("jpeg-{id}"))
            }),
        )
        .route(
            "/api/label-photos/{id}",
            patch(
                |Path(id): Path<i64>, Json(req): Json<UpdateLabelPhotoRequest>| async move {
                    if id == 404 {
                        StatusCode::NOT_FOUND.into_response()
                    } else {
                        Json(label_photo(id, req.status, req.discogs_id)).into_response()
                    }
                },
            ),
        )
        .route(
            "/api/collection/sync",
            post(|| async { Json(sync_result()) }),
        )
        .route(
            "/api/collection/releases/{id}",
            post(|Path(id): Path<i64>| async move {
                Json(SyncResultDto {
                    placement: Some(placement(id)),
                    ..sync_result()
                })
            }),
        )
        .route(
            "/api/collection",
            get(|Query(query): Query<HashMap<String, String>>| async move {
                // Only the copy in compartment 2 matches the storage filter
                let filtered = query.get("storage_unit").map(String::as_str) == Some("3")
                    && query.get("compartment").map(String::as_str) == Some("2");
                Json(CollectionResponse {
                    releases: vec![collection_release(filtered.then(|| slot(2)))],
                    pagination: DiscogsPagination {
                        page: 1,
                        pages: 1,
                        per_page: 50,
                        items: 1,
                    },
                })
            }),
        )
        .route(
            "/api/storage/placement/{id}",
            get(|Path(id): Path<i64>| async move {
                if id == 42 {
                    Json(placement(id)).into_response()
                } else {
                    StatusCode::NO_CONTENT.into_response()
                }
            }),
        )
        .route(
            "/api/storage/layout",
            get(|| async { Json(storage_layout()) }),
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
            "/api/analytics/top-artists",
            get(|Query(query): Query<HashMap<String, String>>| async move {
                // Echo the period so the test sees it was passed on
                let artist = match (query.get("from"), query.get("to")) {
                    (Some(from), Some(to)) => format!("{from}..{to}"),
                    _ => "Miles Davis".to_string(),
                };
                Json(vec![TopArtistDto {
                    artist,
                    count: 9,
                    record_count: 2,
                    thumb_urls: vec!["https://i.discogs.com/kob.jpg".to_string()],
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
    assert!(output.contains("Shelf placement:"), "{output}");
    assert!(output.contains(r#""unitName":"Kallax-1""#), "{output}");
    assert!(
        output.contains("Disraeli Gears"),
        "moves are reported: {output}"
    );
}

#[tokio::test]
async fn test_get_user_collection_passes_storage_filter_and_reports_slot() {
    let server = mock_backend().await;
    let output = server
        .get_user_collection(Parameters(GetCollectionArgs {
            storage_unit: Some("3".to_string()),
            compartment: Some(2),
            ..GetCollectionArgs::default()
        }))
        .await
        .expect("collection must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    let storage = &json["releases"][0]["storage"];
    assert_eq!(storage["unitName"], "Kallax-1");
    assert_eq!(storage["compartment"], 2);

    let output = server
        .get_user_collection(Parameters(GetCollectionArgs::default()))
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert!(json["releases"][0].get("storage").is_none());
}

#[tokio::test]
async fn test_get_record_placement_reports_slot_neighbors_and_moves() {
    let server = mock_backend().await;
    let output = server
        .get_record_placement(Parameters(GetRecordPlacementArgs { discogs_id: 42 }))
        .await
        .expect("placement must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json["discogsId"], 42);
    assert_eq!(json["slot"]["unitName"], "Kallax-1");
    assert_eq!(json["slot"]["compartment"], 2);
    assert_eq!(json["neighbors"]["previous"]["title"], "Tago Mago");
    assert_eq!(json["neighbors"]["next"]["artist"], "Cure");
    assert_eq!(json["moves"][0]["to"]["compartment"], 3);

    let output = server
        .get_record_placement(Parameters(GetRecordPlacementArgs { discogs_id: 7 }))
        .await
        .expect("no shelf is not an error");
    assert_eq!(
        output,
        "No shelf is configured for the medium of release 7."
    );
}

#[tokio::test]
async fn test_get_storage_layout_reports_compartments() {
    let server = mock_backend().await;
    let output = server
        .get_storage_layout()
        .await
        .expect("layout must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    let media = &json["media"][0];
    assert_eq!(media["media"], "vinyl");
    assert_eq!(media["unplacedCount"], 2);
    let compartment = &media["units"][0]["compartments"][0];
    assert_eq!(compartment["used"], 64);
    assert_eq!(compartment["capacity"], 70);
    assert_eq!(compartment["firstArtist"], "ABBA");
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
async fn test_get_top_artists_reports_counts_and_passes_the_period() {
    let server = mock_backend().await;
    let output = server
        .get_top_artists(Parameters(AnalyticsDateRangeArgs::default()))
        .await
        .expect("top artists must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json[0]["artist"], "Miles Davis");
    assert_eq!(json[0]["count"], 9);
    assert_eq!(json[0]["recordCount"], 2);

    let output = server
        .get_top_artists(Parameters(AnalyticsDateRangeArgs {
            from: Some("2026-10-01".to_string()),
            to: Some("2026-10-07".to_string()),
        }))
        .await
        .unwrap();
    assert!(output.contains("2026-10-01..2026-10-07"), "{output}");
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

#[tokio::test]
async fn test_search_discogs_passes_structured_filters() {
    let server = mock_backend().await;
    let output = server
        .search_discogs(Parameters(SearchDiscogsArgs {
            catno: Some("SHVL 804".to_string()),
            label: Some("Harvest".to_string()),
            ..SearchDiscogsArgs::default()
        }))
        .await
        .expect("search must succeed");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json["results"][0]["title"], "catno=SHVL 804&label=Harvest");
    assert_eq!(json["results"][0]["label"][0], "Harvest");
}

#[tokio::test]
async fn test_get_label_inbox_returns_images() {
    let server = mock_backend().await;
    let result = server
        .get_label_inbox(Parameters(GetLabelInboxArgs { limit: Some(2) }))
        .await
        .expect("inbox must succeed");
    let json = serde_json::to_value(&result).unwrap();
    let content = json["content"].as_array().unwrap();

    assert_eq!(
        content.len(),
        5,
        "summary + (caption, image) per photo: {json}"
    );
    let summary = content[0]["text"].as_str().unwrap();
    assert!(
        summary.starts_with("2 of 3 open label photo(s)"),
        "{summary}"
    );
    assert_eq!(content[1]["text"], "Label photo 5:");
    assert_eq!(content[2]["type"], "image");
    assert_eq!(content[2]["mimeType"], "image/jpeg");
    let decoded = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        content[2]["data"].as_str().unwrap(),
    )
    .unwrap();
    assert_eq!(decoded, b"jpeg-5");
    assert_eq!(content[3]["text"], "Label photo 6:");
}

#[tokio::test]
async fn test_resolve_label_photo_sets_status() {
    let server = mock_backend().await;
    let output = server
        .resolve_label_photo(Parameters(ResolveLabelPhotoArgs {
            id: 5,
            status: "identified".to_string(),
            discogs_id: Some(804),
        }))
        .await
        .expect("resolve must succeed");
    assert_eq!(output, "Label photo 5 marked as identified.");

    let err = server
        .resolve_label_photo(Parameters(ResolveLabelPhotoArgs {
            id: 5,
            status: "done".to_string(),
            discogs_id: None,
        }))
        .await
        .unwrap_err();
    assert!(err.contains("Invalid status 'done'"), "{err}");

    let err = server
        .resolve_label_photo(Parameters(ResolveLabelPhotoArgs {
            id: 404,
            status: "failed".to_string(),
            discogs_id: None,
        }))
        .await
        .unwrap_err();
    assert!(err.contains("404"), "{err}");
}

#[tokio::test]
async fn test_label_prompts_require_confirmation() {
    let server = mock_backend().await;
    let text = |messages: Vec<rmcp::model::PromptMessage>| {
        serde_json::to_value(&messages).unwrap()[0]["content"]["text"]
            .as_str()
            .unwrap()
            .to_string()
    };

    let identify = text(
        server
            .identify_record_from_label(Parameters(IdentifyRecordPromptArgs {
                action: Some("add".to_string()),
            }))
            .await,
    );
    assert!(identify.contains("`search_discogs` with `catno` and `label`"));
    assert!(identify.contains("Never add or log anything before the user has confirmed"));
    assert!(identify.contains("add the record with `add_to_collection`"));

    let inbox = text(
        server
            .process_label_inbox(Parameters(ProcessLabelInboxPromptArgs { limit: Some(3) }))
            .await,
    );
    assert!(inbox.contains("Fetch up to 3 open photos with `get_label_inbox`"));
    assert!(inbox.contains("`resolve_label_photo`"));
}
