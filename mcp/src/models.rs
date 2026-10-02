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

/// Arguments for querying analytics within an optional date range.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
pub struct AnalyticsDateRangeArgs {
    /// Optional start date (ISO 8601 format: YYYY-MM-DD)
    pub from: Option<String>,
    /// Optional end date (ISO 8601 format: YYYY-MM-DD)
    pub to: Option<String>,
}

// ============================================================================
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

        let resp: CollectionResponse = serde_json::from_str(json).expect("deserialize collection response");
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
        let top: Vec<TopRecordDto> = serde_json::from_str(top_json).expect("deserialize top records");
        assert_eq!(top.len(), 1);
        assert_eq!(top[0].title, "Abbey Road");
        assert_eq!(top[0].play_count, 15);

        let value_json = r#"{
            "minimum": "€1,200.00",
            "median": "€2,500.00",
            "maximum": "€5,000.00"
        }"#;
        let val: CollectionValueDto = serde_json::from_str(value_json).expect("deserialize collection value");
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
}


