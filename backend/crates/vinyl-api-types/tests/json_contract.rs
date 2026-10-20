//! Pins the JSON field names of the REST API. A failing test here means the wire format changed,
//! which breaks the Angular frontend and older MCP server binaries.

use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use vinyl_api_types::{
    analytics::{CollectionValueData, CollectionValueResponse, TopRecordDto},
    collection::SyncResultDto,
    discogs::{DiscogsPagination, DiscogsSearchResponse, DiscogsSearchResult},
    roon::{RoonPlayRequestDto, RoonStatusDto, RoonZoneDto},
    scan::{DiscogsMatchDto, ScanResultDto, TrackedRecordDto},
    storage::{
        MediaLayoutDto, StorageCompartmentDto, StorageLayoutDto, StorageMedia, StorageMoveDto,
        StorageNeighborsDto, StoragePlacementDto, StorageRecordRefDto, StorageSlotDto,
        StorageTypeDto, StorageUnitLayoutDto,
    },
    user::UserResponseDto,
};

/// Serializes `value`, compares it with `expected` and checks that it deserializes back unchanged.
fn assert_wire_format<T: Serialize + DeserializeOwned>(value: &T, expected: Value) {
    let actual = serde_json::to_value(value).unwrap();
    assert_eq!(actual, expected);
    let roundtrip: T = serde_json::from_value(actual.clone()).unwrap();
    assert_eq!(serde_json::to_value(roundtrip).unwrap(), actual);
}

fn tracked_record() -> TrackedRecordDto {
    TrackedRecordDto {
        discogs_id: 42,
        title: "Kind of Blue".into(),
        artist: "Miles Davis".into(),
        thumb_url: Some("https://i.discogs.com/t.jpg".into()),
    }
}

#[test]
fn test_sync_result_wire_format() {
    let dto = SyncResultDto {
        status: "SUCCESS".into(),
        added: 2,
        updated: 1,
        removed: 0,
        total: 120,
        placement: None,
    };
    assert_wire_format(
        &dto,
        json!({"status": "SUCCESS", "added": 2, "updated": 1, "removed": 0, "total": 120}),
    );
}

fn slot(compartment: i32) -> StorageSlotDto {
    StorageSlotDto {
        unit_id: Some(3),
        unit_name: Some("Kallax-1".into()),
        compartment: Some(compartment),
        row: Some(1),
        column: Some(compartment),
        oversized: false,
        unplaced: false,
    }
}

fn record_ref(discogs_id: i64) -> StorageRecordRefDto {
    StorageRecordRefDto {
        discogs_id,
        artist: Some("Miles Davis".into()),
        title: "Kind of Blue".into(),
    }
}

#[test]
fn test_storage_placement_wire_format() {
    let dto = StoragePlacementDto {
        discogs_id: 42,
        slot: slot(2),
        neighbors: StorageNeighborsDto {
            previous: Some(record_ref(41)),
            next: None,
        },
        moves: vec![StorageMoveDto {
            record: record_ref(43),
            from: slot(2),
            to: slot(3),
        }],
    };
    let slot_json = |c: i32| {
        json!({"unitId": 3, "unitName": "Kallax-1", "compartment": c, "row": 1, "column": c,
               "oversized": false, "unplaced": false})
    };
    let ref_json =
        |id: i64| json!({"discogsId": id, "artist": "Miles Davis", "title": "Kind of Blue"});
    assert_wire_format(
        &dto,
        json!({
            "discogsId": 42,
            "slot": slot_json(2),
            "neighbors": {"previous": ref_json(41), "next": null},
            "moves": [{"record": ref_json(43), "from": slot_json(2), "to": slot_json(3)}]
        }),
    );
}

#[test]
fn test_sync_result_with_placement() {
    let dto: SyncResultDto = serde_json::from_value(json!({
        "status": "SUCCESS", "added": 1, "updated": 0, "removed": 0, "total": 1,
        "placement": {
            "discogsId": 42,
            "slot": {"unitId": null, "unitName": null, "compartment": null, "row": null,
                     "column": null, "unplaced": true},
            "neighbors": {"previous": null, "next": null}
        }
    }))
    .unwrap();
    let placement = dto.placement.unwrap();
    assert!(placement.slot.unplaced);
    assert!(!placement.slot.oversized);
    assert!(placement.moves.is_empty());
}

#[test]
fn test_storage_layout_wire_format() {
    let dto = StorageLayoutDto {
        media: vec![MediaLayoutDto {
            media: StorageMedia::Cd,
            units: vec![StorageUnitLayoutDto {
                id: 3,
                name: "CD-1".into(),
                type_name: "IKEA CD".into(),
                rows: 12,
                columns: 1,
                compartments: vec![StorageCompartmentDto {
                    number: 1,
                    row: 1,
                    column: 1,
                    capacity: 11,
                    used: 9,
                    count: 8,
                    first_artist: Some("Abba".into()),
                    last_artist: Some("Beatles".into()),
                    oversized: false,
                }],
            }],
            unplaced_count: 0,
        }],
    };
    assert_wire_format(
        &dto,
        json!({"media": [{
            "media": "cd",
            "units": [{
                "id": 3, "name": "CD-1", "typeName": "IKEA CD", "rows": 12, "columns": 1,
                "compartments": [{
                    "number": 1, "row": 1, "column": 1, "capacity": 11, "used": 9, "count": 8,
                    "firstArtist": "Abba", "lastArtist": "Beatles", "oversized": false
                }]
            }],
            "unplacedCount": 0
        }]}),
    );
}

#[test]
fn test_storage_type_wire_format() {
    let dto = StorageTypeDto {
        id: 1,
        name: "Kallax 2×4".into(),
        media: StorageMedia::Vinyl,
        rows: 2,
        columns: 4,
        capacity: 70,
        unit_count: 2,
    };
    assert_wire_format(
        &dto,
        json!({"id": 1, "name": "Kallax 2×4", "media": "vinyl", "rows": 2, "columns": 4,
               "capacity": 70, "unitCount": 2}),
    );
}

#[test]
fn test_record_types_without_storage_from_older_servers() {
    let release: vinyl_api_types::collection::CollectionRelease = serde_json::from_value(json!({
        "id": 1, "instance_id": 2, "listen_count": 0, "date_added": "2026-01-01T00:00:00Z",
        "rating": null, "media_condition": null, "sleeve_condition": null,
        "last_played_at": null, "notes": null,
        "basic_information": {
            "id": 1, "title": "T", "artists": [], "year": null, "thumb": null,
            "cover_image": null, "genres": [], "styles": [], "format": "LP",
            "lowest_price": null, "median_price": null
        }
    }))
    .unwrap();
    assert!(release.storage.is_none());
    let json = serde_json::to_value(&release).unwrap();
    assert!(json.get("storage").is_none(), "absent storage is omitted");
}

#[test]
fn test_top_record_wire_format() {
    let dto = TopRecordDto {
        discogs_id: 1_000_001,
        title: "Miles Davis - Kind of Blue".into(),
        record_title: "Kind of Blue".into(),
        artist: "Miles Davis".into(),
        thumb_url: None,
        count: 7,
    };
    assert_wire_format(
        &dto,
        json!({
            "discogsId": 1_000_001,
            "title": "Miles Davis - Kind of Blue",
            "recordTitle": "Kind of Blue",
            "artist": "Miles Davis",
            "thumbUrl": null,
            "count": 7
        }),
    );
}

#[test]
fn test_top_record_without_discogs_id_from_older_servers() {
    let dto: TopRecordDto = serde_json::from_value(json!({
        "title": "Kind of Blue",
        "recordTitle": "Kind of Blue",
        "artist": "Miles Davis",
        "thumbUrl": null,
        "count": 7
    }))
    .unwrap();
    assert_eq!(dto.discogs_id, 0);
    assert_eq!(dto.count, 7);
}

#[test]
fn test_collection_value_wire_format() {
    let eur = |value| CollectionValueData {
        currency: "EUR".into(),
        value,
    };
    let dto = CollectionValueResponse {
        minimum: eur(100.0),
        median: eur(250.5),
        maximum: eur(400.0),
    };
    assert_wire_format(
        &dto,
        json!({
            "minimum": {"currency": "EUR", "value": 100.0},
            "median": {"currency": "EUR", "value": 250.5},
            "maximum": {"currency": "EUR", "value": 400.0}
        }),
    );
}

#[test]
fn test_scan_result_wire_format() {
    let found = ScanResultDto {
        success: true,
        message: "Logged".into(),
        record: Some(tracked_record()),
        discogs_matches: None,
    };
    assert_wire_format(
        &found,
        json!({
            "success": true,
            "message": "Logged",
            "record": {
                "discogsId": 42,
                "title": "Kind of Blue",
                "artist": "Miles Davis",
                "thumbUrl": "https://i.discogs.com/t.jpg"
            }
        }),
    );

    let suggestions = ScanResultDto {
        success: false,
        message: "Not in collection".into(),
        record: None,
        discogs_matches: Some(vec![DiscogsMatchDto {
            id: 7,
            title: "Blue Train".into(),
            year: Some("1957".into()),
            thumb_url: None,
            cover_image: None,
            format: Some(vec!["Vinyl".into()]),
            country: Some("US".into()),
        }]),
    };
    assert_wire_format(
        &suggestions,
        json!({
            "success": false,
            "message": "Not in collection",
            "discogsMatches": [{
                "id": 7,
                "title": "Blue Train",
                "year": "1957",
                "thumbUrl": null,
                "coverImage": null,
                "format": ["Vinyl"],
                "country": "US"
            }]
        }),
    );
}

#[test]
fn test_roon_wire_format() {
    let zone = RoonZoneDto {
        zone_id: "z1".into(),
        name: "Wohnzimmer".into(),
        state: "playing".into(),
    };
    let status = RoonStatusDto {
        connected: true,
        paired: true,
        core_name: None,
        core_id: None,
        host: Some("10.0.0.2".into()),
        port: Some(9330),
        selected_zone_id: Some("z1".into()),
        selected_zone_name: Some("Wohnzimmer".into()),
        zones: vec![zone],
    };
    assert_wire_format(
        &status,
        json!({
            "connected": true,
            "paired": true,
            "host": "10.0.0.2",
            "port": 9330,
            "selectedZoneId": "z1",
            "selectedZoneName": "Wohnzimmer",
            "zones": [{"zoneId": "z1", "name": "Wohnzimmer", "state": "playing"}]
        }),
    );

    let request: RoonPlayRequestDto =
        serde_json::from_value(json!({"artist": "A", "title": "T", "zone_id": "z1"})).unwrap();
    assert_eq!(
        request.zone_id.as_deref(),
        Some("z1"),
        "snake_case alias must stay accepted"
    );
    assert_wire_format(
        &request,
        json!({"artist": "A", "title": "T", "zoneId": "z1"}),
    );
}

#[test]
fn test_user_response_wire_format_omits_empty_fields() {
    let dto = UserResponseDto {
        id: 1,
        username: "oliver".into(),
        discogs_username: Some("oli".into()),
        token: None,
        roon_host: None,
        roon_port: None,
        roon_zone_id: None,
        roon_zone_name: None,
        roon_paired: Some(false),
        has_discogs_token: Some(true),
    };
    assert_wire_format(
        &dto,
        json!({
            "id": 1,
            "username": "oliver",
            "discogsUsername": "oli",
            "roonPaired": false,
            "hasDiscogsToken": true
        }),
    );
}

#[test]
fn test_discogs_search_wire_format() {
    let dto = DiscogsSearchResponse {
        pagination: DiscogsPagination {
            page: 1,
            pages: 1,
            per_page: 50,
            items: 1,
        },
        results: vec![DiscogsSearchResult {
            id: 9,
            title: "Artist - Album".into(),
            thumb: None,
            cover_image: None,
            year: None,
            format: None,
            genre: None,
            style: None,
            barcode: None,
            catno: None,
            country: None,
            type_name: Some("release".into()),
        }],
    };
    let json = serde_json::to_value(&dto).unwrap();
    assert_eq!(json["results"][0]["type"], "release");
    assert_eq!(json["pagination"]["per_page"], 50);
}
