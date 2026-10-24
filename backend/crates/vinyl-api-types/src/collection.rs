use crate::discogs::{DiscogsArtist, DiscogsFormat, DiscogsLabel, DiscogsPagination, DiscogsTrack};
use crate::record::RecordSource;
use crate::storage::{StoragePlacementDto, StorageSlotDto};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionNote {
    #[serde(rename = "field_id")]
    pub field_id: Option<i64>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicInformation {
    pub id: i64,
    pub title: String,
    pub artists: Vec<DiscogsArtist>,
    pub year: Option<i32>,
    #[serde(rename = "thumb")]
    pub thumb_url: Option<String>,
    #[serde(rename = "cover_image")]
    pub cover_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tracklist: Option<Vec<DiscogsTrack>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formats: Option<Vec<DiscogsFormat>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<DiscogsLabel>>,
    pub genres: Vec<String>,
    pub styles: Vec<String>,
    pub format: String,
    #[serde(rename = "lowest_price")]
    pub lowest_price: Option<f64>,
    #[serde(rename = "median_price")]
    pub median_price: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionRelease {
    pub id: i64,
    #[serde(rename = "instance_id")]
    pub instance_id: i64,
    #[serde(rename = "listen_count")]
    pub listen_count: i64,
    #[serde(rename = "date_added")]
    pub date_added: String,
    pub rating: Option<i32>,
    #[serde(rename = "basic_information")]
    pub basic_information: BasicInformation,
    #[serde(rename = "media_condition")]
    pub media_condition: Option<String>,
    #[serde(rename = "sleeve_condition")]
    pub sleeve_condition: Option<String>,
    #[serde(rename = "last_played_at")]
    pub last_played_at: Option<String>,
    pub notes: Option<Vec<CollectionNote>>,
    /// Custom sort string replacing the automatic artist sort key; `None` uses the automatic key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_key: Option<String>,
    /// Computed storage slot; `None` when no shelf is configured for the medium.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage: Option<StorageSlotDto>,
    #[serde(default)]
    pub source: RecordSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionResponse {
    pub releases: Vec<CollectionRelease>,
    pub pagination: DiscogsPagination,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResultDto {
    pub status: String,
    pub added: i32,
    pub updated: i32,
    pub removed: i32,
    pub total: i32,
    /// Placement hint for a newly added record (only when shelves exist for its medium).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placement: Option<StoragePlacementDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceRefreshResultDto {
    pub updated_count: i32,
    pub failed_count: i32,
}
