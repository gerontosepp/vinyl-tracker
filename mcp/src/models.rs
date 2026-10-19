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
    pub top_genres: Vec<GenreBreakdownItem>,
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

// ============================================================================
// Backend API DTOs (shared with the backend, see backend/crates/vinyl-api-types)
// ============================================================================

pub use vinyl_api_types::{
    analytics::{CollectionValueResponse, GenreBreakdownItem, ListenEventDto, TopRecordDto},
    collection::{CollectionRelease, CollectionResponse, PriceRefreshResultDto, SyncResultDto},
    discogs::DiscogsSearchResponse,
    record::{RecordDetailDto, UpdateConditionRequestDto},
    roon::{RoonPlayRequestDto, RoonPlayResponseDto, RoonStatusDto, RoonZoneDto},
    scan::{ResetResultDto, ScanRequest, ScanResultDto},
    user::{LoginRequestDto, UserResponseDto},
};

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
    fn test_collection_summary_resource_serialization() {
        let summary = CollectionSummaryResource {
            total_records: 42,
            vinyl_count: 30,
            cd_count: 12,
            unplayed_count: 5,
            top_genres: vec![GenreBreakdownItem {
                name: "Rock".to_string(),
                value: 20,
            }],
        };

        let json = serde_json::to_value(&summary).expect("serialize summary");
        assert_eq!(json["top_genres"][0]["name"], "Rock");
        let parsed: CollectionSummaryResource =
            serde_json::from_value(json).expect("deserialize summary");
        assert_eq!(parsed.total_records, 42);
        assert_eq!(parsed.vinyl_count, 30);
        assert_eq!(parsed.cd_count, 12);
        assert_eq!(parsed.unplayed_count, 5);
    }
}
