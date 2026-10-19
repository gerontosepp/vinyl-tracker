use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

// ============================================================================
// MCP Tool Request Models
// ============================================================================

/// Arguments for querying the user's vinyl collection.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct GetCollectionArgs {
    /// Page number (default: 1)
    pub page: Option<i32>,
    /// Items per page (default: 50)
    pub per_page: Option<i32>,
    /// Sort field: "artist", "listens", or "addedAt" (default: "artist")
    pub sort: Option<String>,
    /// Sort order: "asc" or "desc" (default: "asc")
    pub sort_order: Option<String>,
    /// Filter to return only records played at least this many times
    pub min_plays: Option<i32>,
    /// Search query string to filter by album title or artist
    pub search: Option<String>,
    /// Filter collection by category: "all", "vinyl", or "cd" (default: "all")
    pub category: Option<String>,
    /// Filter collection by genres (e.g. ["Jazz", "Rock"])
    pub genres: Option<Vec<String>>,
    /// Filter collection by year or year ranges (e.g. "1970, 1971" or "1970-1972")
    pub years: Option<String>,
}

/// Arguments for scanning a barcode or custom Discogs QR code.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ScanBarcodeArgs {
    /// Barcode string or custom QR code string (e.g. "discogs-id:12345" or standard UPC/EAN)
    pub barcode: String,
}

/// Arguments for deleting a listen event.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct DeleteScanArgs {
    /// The unique ID of the listen event to delete
    pub id: i64,
}

/// Arguments for adding an album/release to the user's collection.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct AddToCollectionArgs {
    /// The Discogs release ID of the album to add to the collection
    pub release_id: i64,
}

/// Arguments for removing an album from the user's collection.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct RemoveFromCollectionArgs {
    /// The Discogs release ID of the album to remove from the collection
    pub release_id: i64,
    /// Optional specific collection instance ID to delete
    pub instance_id: Option<i64>,
}

/// Arguments for directly logging a record listen event by record ID or Discogs release ID.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogRecordListenArgs {
    /// The internal record ID or Discogs release ID to log a listen event for
    pub id: i64,
}

/// Arguments for updating media and sleeve condition grading of a record.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct UpdateRecordConditionArgs {
    /// Internal record ID or Discogs release ID
    pub id: i64,
    /// Optional media condition according to Goldmine Standard (e.g. "Mint (M)", "Near Mint (NM or M-)", "Very Good Plus (VG+)", "Very Good (VG)", "Good Plus (G+)", "Good (G)", "Fair (F)", "Poor (P)")
    pub media_condition: Option<String>,
    /// Optional sleeve condition according to Goldmine Standard
    pub sleeve_condition: Option<String>,
}

/// Arguments for refreshing collection market prices from Discogs.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct RefreshCollectionPricesArgs {
    /// If true, only records currently missing price information will be refreshed (default: true). Set false to force refresh all records.
    pub only_missing: Option<bool>,
}

/// Arguments for querying analytics within an optional date range.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct AnalyticsDateRangeArgs {
    /// Optional start date (ISO 8601 format: YYYY-MM-DD)
    pub from: Option<String>,
    /// Optional end date (ISO 8601 format: YYYY-MM-DD)
    pub to: Option<String>,
}

/// Arguments for getting a random record recommendation from the user's collection.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct GetRandomRecordArgs {
    /// Optional genre filter (e.g. "Rock", "Jazz", "Electronic")
    pub genre: Option<String>,
    /// Filter to only return unplayed records (default: false)
    pub unplayed_only: Option<bool>,
}

/// Arguments for querying unplayed records from the user's collection ("shelf of shame").
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct GetUnplayedRecordsArgs {
    /// Page number (default: 1)
    pub page: Option<i32>,
    /// Items per page (default: 50)
    pub per_page: Option<i32>,
}

/// Arguments for fetching album details with tracklist, formats, labels, and listen history.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct GetRecordDetailsArgs {
    /// The internal record ID or Discogs release ID
    pub id: i64,
}

/// Arguments for searching the global Discogs database.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct SearchDiscogsArgs {
    /// Search query (album title, artist name, barcode, etc.)
    pub query: String,
    /// Discogs entity type filter (default: "release", or "master", "artist")
    pub r#type: Option<String>,
    /// Page number (default: 1)
    pub page: Option<i32>,
    /// Items per page (default: 50)
    pub per_page: Option<i32>,
}

/// Arguments for exporting the user's vinyl collection.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ExportCollectionArgs {
    /// Export format: "json" or "csv"
    pub format: String,
}

/// Arguments for the record recommendation prompt template.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct RecommendRecordPromptArgs {
    /// Optional genre preference (e.g. "Jazz", "Electronic", "Rock")
    pub genre: Option<String>,
    /// Optional mood or listening context (e.g. "relaxing", "energetic", "focus", "evening")
    pub mood: Option<String>,
}

/// Arguments for the grading audit prompt template.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct GradingAuditPromptArgs {
    /// Optional maximum number of unrated records to audit (default: 10)
    pub limit: Option<i32>,
}

/// Structured representation of the vinyl://collection/summary resource.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSummaryResource {
    pub total_records: i64,
    pub vinyl_count: i64,
    pub cd_count: i64,
    pub unplayed_count: i64,
    pub top_genres: serde_json::Value,
}
// Backend API DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionResponse {
    pub releases: Vec<CollectionRelease>,
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionRelease {
    pub id: i64,
    #[serde(alias = "instanceId", alias = "instance_id")]
    pub instance_id: Option<i64>,
    #[serde(alias = "listenCount", alias = "listen_count")]
    pub listen_count: Option<i64>,
    #[serde(alias = "basicInformation", alias = "basic_information")]
    pub basic_information: Option<BasicInformation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicInformation {
    pub id: Option<i64>,
    pub title: Option<String>,
    pub year: Option<i32>,
    #[serde(alias = "thumbUrl", alias = "thumb_url", alias = "thumb")]
    pub thumb_url: Option<String>,
    #[serde(default)]
    pub artists: Vec<Artist>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(alias = "lowestPrice", alias = "lowest_price")]
    pub lowest_price: Option<f64>,
    #[serde(alias = "medianPrice", alias = "median_price")]
    pub median_price: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: i32,
    pub pages: i32,
    #[serde(alias = "perPage", alias = "per_page")]
    pub per_page: i32,
    pub items: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResultDto {
    #[serde(alias = "addedCount", alias = "added_count")]
    pub added_count: i32,
    #[serde(alias = "removedCount", alias = "removed_count")]
    pub removed_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceRefreshResultDto {
    #[serde(alias = "updatedCount", alias = "updated_count")]
    pub updated_count: i32,
    #[serde(alias = "failedCount", alias = "failed_count")]
    pub failed_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResultDto {
    pub success: bool,
    pub message: String,
    #[serde(alias = "trackedRecord", alias = "tracked_record")]
    pub tracked_record: Option<TrackedRecordDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedRecordDto {
    #[serde(alias = "discogsId", alias = "discogs_id")]
    pub discogs_id: Option<i64>,
    pub title: Option<String>,
    pub artist: Option<String>,
    #[serde(alias = "thumbUrl", alias = "thumb_url", alias = "thumb")]
    pub thumb_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetResultDto {
    pub success: bool,
    pub message: String,
    #[serde(alias = "deletedCount", alias = "deleted_count")]
    pub deleted_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopRecordDto {
    pub title: String,
    pub artist: String,
    #[serde(alias = "thumbUrl", alias = "thumb_url", alias = "thumb")]
    pub thumb_url: Option<String>,
    #[serde(alias = "playCount", alias = "play_count")]
    pub play_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenEventDto {
    pub id: i64,
    pub timestamp: Option<String>,
    pub record: Option<RecordDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordDto {
    pub id: Option<i64>,
    #[serde(alias = "discogsId", alias = "discogs_id")]
    pub discogs_id: Option<i64>,
    pub title: String,
    pub artist: String,
    pub year: Option<String>,
    #[serde(alias = "thumbUrl", alias = "thumb_url", alias = "thumb")]
    pub thumb_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionValueDto {
    pub minimum: Option<String>,
    pub median: Option<String>,
    pub maximum: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserResponseDto {
    pub id: Option<i64>,
    pub username: String,
    #[serde(alias = "discogsUsername", alias = "discogs_username")]
    pub discogs_username: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequestDto {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordDetailDto {
    pub id: Option<i64>,
    #[serde(alias = "discogsId", alias = "discogs_id")]
    pub discogs_id: i64,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub year: Option<String>,
    #[serde(alias = "thumbUrl", alias = "thumb_url")]
    pub thumb_url: Option<String>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(alias = "inCollection", alias = "in_collection")]
    pub in_collection: bool,
    #[serde(alias = "instanceId", alias = "instance_id")]
    pub instance_id: Option<i64>,
    #[serde(alias = "listenCount", alias = "listen_count")]
    pub listen_count: i64,
    #[serde(alias = "lastListenedAt", alias = "last_listened_at")]
    pub last_listened_at: Option<String>,
    #[serde(alias = "addedAt", alias = "added_at")]
    pub added_at: Option<String>,
    #[serde(alias = "mediaCondition", alias = "media_condition")]
    pub media_condition: Option<String>,
    #[serde(alias = "sleeveCondition", alias = "sleeve_condition")]
    pub sleeve_condition: Option<String>,
    #[serde(alias = "lowestPrice", alias = "lowest_price")]
    pub lowest_price: Option<f64>,
    #[serde(alias = "medianPrice", alias = "median_price")]
    pub median_price: Option<f64>,
    #[serde(alias = "numForSale", alias = "num_for_sale")]
    pub num_for_sale: Option<i32>,
    #[serde(default, alias = "listenHistory", alias = "listen_history")]
    pub listen_history: Vec<String>,
    #[serde(default)]
    pub tracklist: Vec<TrackDto>,
    #[serde(default)]
    pub formats: Vec<FormatDto>,
    #[serde(default)]
    pub labels: Vec<LabelDto>,
    pub notes: Option<String>,
    pub country: Option<String>,
    pub released: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackDto {
    pub position: Option<String>,
    pub title: Option<String>,
    pub duration: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatDto {
    pub name: Option<String>,
    pub qty: Option<String>,
    #[serde(default)]
    pub descriptions: Vec<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelDto {
    pub name: Option<String>,
    pub catno: Option<String>,
    #[serde(alias = "entityTypeName", alias = "entity_type_name")]
    pub entity_type_name: Option<String>,
    pub id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsSearchResponse {
    pub pagination: Option<Pagination>,
    #[serde(default)]
    pub results: Vec<DiscogsSearchResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsSearchResult {
    pub id: i64,
    pub title: Option<String>,
    pub year: Option<String>,
    #[serde(alias = "thumbUrl", alias = "thumb_url", alias = "thumb")]
    pub thumb_url: Option<String>,
    #[serde(alias = "coverImage", alias = "cover_image")]
    pub cover_image: Option<String>,
    #[serde(default)]
    pub barcode: Vec<String>,
    #[serde(default)]
    pub genre: Vec<String>,
    #[serde(default)]
    pub style: Vec<String>,
    #[serde(default)]
    pub format: Vec<String>,
    pub country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct PlayRecordOnRoonArgs {
    /// Artist name of the record to play
    pub artist: String,
    /// Album or track title of the record to play
    pub title: String,
    /// Optional target Roon playback zone ID (defaults to user's configured default zone)
    pub zone_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoonPlayResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoonZoneDto {
    #[serde(alias = "zone_id")]
    pub zone_id: String,
    pub name: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoonStatusDto {
    pub connected: bool,
    pub paired: bool,
    pub core_name: Option<String>,
    pub core_id: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    pub selected_zone_id: Option<String>,
    pub selected_zone_name: Option<String>,
    #[serde(default)]
    pub zones: Vec<RoonZoneDto>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collection_args_default() {
        let args = GetCollectionArgs::default();
        assert!(args.page.is_none());
        assert!(args.per_page.is_none());
        assert!(args.sort.is_none());
        assert!(args.sort_order.is_none());
        assert!(args.min_plays.is_none());
        assert!(args.search.is_none());
    }

    #[test]
    fn test_collection_response_deserialization() {
        let json = r#"{
            "releases": [
                {
                    "id": 12345,
                    "instanceId": 67890,
                    "listenCount": 3,
                    "basicInformation": {
                        "id": 12345,
                        "title": "Wish You Were Here",
                        "year": 1975,
                        "thumbUrl": "https://example.com/cover.jpg",
                        "artists": [{"name": "Pink Floyd"}],
                        "genres": ["Rock", "Progressive Rock"]
                    }
                }
            ],
            "pagination": {
                "page": 1,
                "pages": 1,
                "perPage": 50,
                "items": 1
            }
        }"#;

        let resp: CollectionResponse =
            serde_json::from_str(json).expect("deserialize collection response");
        assert_eq!(resp.releases.len(), 1);
        let rel = &resp.releases[0];
        assert_eq!(rel.id, 12345);
        assert_eq!(rel.instance_id, Some(67890));
        assert_eq!(rel.listen_count, Some(3));
        let info = rel.basic_information.as_ref().unwrap();
        assert_eq!(info.title.as_deref(), Some("Wish You Were Here"));
        assert_eq!(info.artists[0].name.as_deref(), Some("Pink Floyd"));
        assert_eq!(info.genres, vec!["Rock", "Progressive Rock"]);
        assert_eq!(resp.pagination.unwrap().items, 1);
    }

    #[test]
    fn test_scan_result_deserialization() {
        let json = r#"{
            "success": true,
            "message": "Now playing: The Dark Side of the Moon",
            "trackedRecord": {
                "discogsId": 9999,
                "title": "The Dark Side of the Moon",
                "artist": "Pink Floyd",
                "thumbUrl": "https://example.com/dsotm.jpg"
            }
        }"#;

        let res: ScanResultDto = serde_json::from_str(json).expect("deserialize scan result");
        assert!(res.success);
        assert_eq!(res.message, "Now playing: The Dark Side of the Moon");
        let rec = res.tracked_record.unwrap();
        assert_eq!(rec.discogs_id, Some(9999));
        assert_eq!(rec.title.as_deref(), Some("The Dark Side of the Moon"));
        assert_eq!(rec.artist.as_deref(), Some("Pink Floyd"));
    }

    #[test]
    fn test_reset_result_deserialization() {
        let json = r#"{
            "success": true,
            "message": "All listens have been reset",
            "deletedCount": 42
        }"#;

        let res: ResetResultDto = serde_json::from_str(json).expect("deserialize reset result");
        assert!(res.success);
        assert_eq!(res.deleted_count, 42);
    }

    #[test]
    fn test_analytics_dtos_deserialization() {
        let top_json = r#"[
            {
                "title": "Abbey Road",
                "artist": "The Beatles",
                "thumbUrl": "https://example.com/abbey.jpg",
                "playCount": 15
            }
        ]"#;
        let top: Vec<TopRecordDto> =
            serde_json::from_str(top_json).expect("deserialize top records");
        assert_eq!(top.len(), 1);
        assert_eq!(top[0].title, "Abbey Road");
        assert_eq!(top[0].play_count, 15);

        let value_json = r#"{
            "minimum": "€1,200.00",
            "median": "€2,500.00",
            "maximum": "€5,000.00"
        }"#;
        let val: CollectionValueDto =
            serde_json::from_str(value_json).expect("deserialize collection value");
        assert_eq!(val.median.as_deref(), Some("€2,500.00"));
    }

    #[test]
    fn test_user_response_deserialization() {
        let json = r#"{
            "id": 1,
            "username": "vinyl_fan",
            "discogsUsername": "vinyl_fan_discogs"
        }"#;
        let user: UserResponseDto = serde_json::from_str(json).expect("deserialize user response");
        assert_eq!(user.id, Some(1));
        assert_eq!(user.username, "vinyl_fan");
        assert_eq!(user.discogs_username.as_deref(), Some("vinyl_fan_discogs"));
    }

    #[test]
    fn test_record_detail_dto_deserialization() {
        let json = r#"{
            "id": 10,
            "discogs_id": 9999,
            "title": "A Night at the Opera",
            "artist": "Queen",
            "year": "1975",
            "in_collection": true,
            "instance_id": 5555,
            "listen_count": 8,
            "tracklist": [
                {
                    "position": "A1",
                    "title": "Death on Two Legs",
                    "duration": "3:43"
                }
            ],
            "formats": [
                {
                    "name": "Vinyl",
                    "qty": "1",
                    "descriptions": ["LP", "Album"]
                }
            ],
            "labels": [
                {
                    "name": "EMI",
                    "catno": "EMTC 103"
                }
            ]
        }"#;

        let detail: RecordDetailDto =
            serde_json::from_str(json).expect("deserialize record detail");
        assert_eq!(detail.id, Some(10));
        assert_eq!(detail.discogs_id, 9999);
        assert_eq!(detail.title.as_deref(), Some("A Night at the Opera"));
        assert!(detail.in_collection);
        assert_eq!(detail.listen_count, 8);
        assert_eq!(detail.tracklist.len(), 1);
        assert_eq!(
            detail.tracklist[0].title.as_deref(),
            Some("Death on Two Legs")
        );
        assert_eq!(detail.formats.len(), 1);
        assert_eq!(detail.formats[0].name.as_deref(), Some("Vinyl"));
        assert_eq!(detail.labels.len(), 1);
        assert_eq!(detail.labels[0].name.as_deref(), Some("EMI"));
    }

    #[test]
    fn test_discogs_search_response_deserialization() {
        let json = r#"{
            "pagination": {
                "page": 1,
                "pages": 5,
                "per_page": 20,
                "items": 100
            },
            "results": [
                {
                    "id": 123456,
                    "title": "Bohemian Rhapsody",
                    "year": "1975",
                    "genre": ["Rock"],
                    "format": ["Vinyl", "7\""]
                }
            ]
        }"#;

        let search: DiscogsSearchResponse =
            serde_json::from_str(json).expect("deserialize search response");
        assert_eq!(search.results.len(), 1);
        assert_eq!(search.results[0].id, 123456);
        assert_eq!(
            search.results[0].title.as_deref(),
            Some("Bohemian Rhapsody")
        );
        assert_eq!(search.results[0].genre, vec!["Rock"]);
    }

    #[test]
    fn test_roon_zone_dto_deserialization() {
        let json = r#"[
            {
                "zoneId": "16013a96-6e27-4a0e-9276-88094916a040",
                "name": "Living Room",
                "state": "playing"
            },
            {
                "zone_id": "22222222-6e27-4a0e-9276-88094916a040",
                "name": "Office",
                "state": "paused"
            }
        ]"#;

        let zones: Vec<RoonZoneDto> = serde_json::from_str(json).expect("deserialize roon zones");
        assert_eq!(zones.len(), 2);
        assert_eq!(zones[0].name, "Living Room");
        assert_eq!(zones[0].zone_id, "16013a96-6e27-4a0e-9276-88094916a040");
        assert_eq!(zones[0].state, "playing");
        assert_eq!(zones[1].name, "Office");
        assert_eq!(zones[1].zone_id, "22222222-6e27-4a0e-9276-88094916a040");
    }

    #[test]
    fn test_price_refresh_result_dto_deserialization() {
        let json = r#"{
            "updatedCount": 12,
            "failedCount": 1
        }"#;
        let res: PriceRefreshResultDto =
            serde_json::from_str(json).expect("deserialize price refresh result");
        assert_eq!(res.updated_count, 12);
        assert_eq!(res.failed_count, 1);
    }

    #[test]
    fn test_roon_status_dto_deserialization() {
        let json = r#"{
            "connected": true,
            "paired": true,
            "coreName": "LivingRoom Core",
            "coreId": "core-123",
            "host": "192.168.1.100",
            "port": 9330,
            "selectedZoneId": "16013a96-6e27-4a0e-9276-88094916a040",
            "selectedZoneName": "Living Room",
            "zones": [
                {
                    "zoneId": "16013a96-6e27-4a0e-9276-88094916a040",
                    "name": "Living Room",
                    "state": "playing"
                }
            ]
        }"#;

        let status: RoonStatusDto = serde_json::from_str(json).expect("deserialize roon status");
        assert!(status.connected);
        assert!(status.paired);
        assert_eq!(status.core_name.as_deref(), Some("LivingRoom Core"));
        assert_eq!(status.host.as_deref(), Some("192.168.1.100"));
        assert_eq!(status.port, Some(9330));
        assert_eq!(status.zones.len(), 1);
        assert_eq!(status.zones[0].name, "Living Room");
    }

    #[test]
    fn test_collection_summary_resource_serialization() {
        let summary = CollectionSummaryResource {
            total_records: 42,
            vinyl_count: 30,
            cd_count: 12,
            unplayed_count: 5,
            top_genres: serde_json::json!([{"genre": "Rock", "count": 20}]),
        };

        let json = serde_json::to_string(&summary).expect("serialize summary");
        let parsed: CollectionSummaryResource =
            serde_json::from_str(&json).expect("deserialize summary");
        assert_eq!(parsed.total_records, 42);
        assert_eq!(parsed.vinyl_count, 30);
        assert_eq!(parsed.cd_count, 12);
        assert_eq!(parsed.unplayed_count, 5);
    }
}
