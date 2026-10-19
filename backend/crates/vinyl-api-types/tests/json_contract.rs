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
    };
    assert_wire_format(
        &dto,
        json!({"status": "SUCCESS", "added": 2, "updated": 1, "removed": 0, "total": 120}),
    );
}

#[test]
fn test_top_record_wire_format() {
    let dto = TopRecordDto {
        title: "Miles Davis - Kind of Blue".into(),
        record_title: "Kind of Blue".into(),
        artist: "Miles Davis".into(),
        thumb_url: None,
        count: 7,
    };
    assert_wire_format(
        &dto,
        json!({
            "title": "Miles Davis - Kind of Blue",
            "recordTitle": "Kind of Blue",
            "artist": "Miles Davis",
            "thumbUrl": null,
            "count": 7
        }),
    );
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
