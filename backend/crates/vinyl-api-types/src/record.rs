use crate::discogs::{DiscogsFormat, DiscogsIdentifier, DiscogsLabel, DiscogsTrack};
use crate::storage::{StorageNeighborsDto, StoragePlacementDto, StorageSlotDto};
use serde::{Deserialize, Serialize};

/// Where a record comes from: a Discogs release, or a manual record without a Discogs entry
/// (#242). Manual records have negative IDs (`discogs_id = instance_id = -n`).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordSource {
    #[default]
    Discogs,
    Manual,
}

impl RecordSource {
    pub fn as_str(self) -> &'static str {
        match self {
            RecordSource::Discogs => "discogs",
            RecordSource::Manual => "manual",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "discogs" => Some(RecordSource::Discogs),
            "manual" => Some(RecordSource::Manual),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordDetailDto {
    pub id: Option<i64>,
    #[serde(rename = "discogs_id")]
    pub discogs_id: i64,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub year: Option<String>,
    #[serde(rename = "thumb_url")]
    pub thumb_url: Option<String>,
    pub genres: Vec<String>,
    #[serde(rename = "in_collection")]
    pub in_collection: bool,
    #[serde(rename = "instance_id")]
    pub instance_id: Option<i64>,
    #[serde(rename = "listen_count")]
    pub listen_count: i64,
    #[serde(rename = "last_listened_at")]
    pub last_listened_at: Option<String>,
    #[serde(rename = "added_at")]
    pub added_at: Option<String>,
    #[serde(rename = "media_condition")]
    pub media_condition: Option<String>,
    #[serde(rename = "sleeve_condition")]
    pub sleeve_condition: Option<String>,
    /// Custom sort string of the record; `None` uses `default_sort_key`.
    #[serde(default)]
    pub sort_key: Option<String>,
    /// Automatic artist sort key (artist without a leading article, lowercase).
    #[serde(default)]
    pub default_sort_key: Option<String>,
    #[serde(rename = "lowest_price")]
    pub lowest_price: Option<f64>,
    #[serde(rename = "median_price")]
    pub median_price: Option<f64>,
    #[serde(rename = "num_for_sale")]
    pub num_for_sale: Option<i32>,
    #[serde(rename = "listen_history")]
    pub listen_history: Vec<String>,
    pub tracklist: Vec<DiscogsTrack>,
    pub format: String,
    pub formats: Vec<DiscogsFormat>,
    pub labels: Vec<DiscogsLabel>,
    #[serde(default)]
    pub identifiers: Vec<DiscogsIdentifier>,
    pub notes: Option<String>,
    pub country: Option<String>,
    pub released: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage: Option<StorageSlotDto>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_neighbors: Option<StorageNeighborsDto>,
    #[serde(default)]
    pub source: RecordSource,
    /// Barcode of a manual record (Discogs releases list theirs in `identifiers`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub barcode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConditionRequestDto {
    #[serde(alias = "mediaCondition")]
    pub media_condition: Option<String>,
    #[serde(alias = "sleeveCondition")]
    pub sleeve_condition: Option<String>,
}

/// Sets (`Some`) or resets (`None` or blank) the custom sort string of a record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSortKeyRequestDto {
    #[serde(default, alias = "sortKey")]
    pub sort_key: Option<String>,
}

/// Creates or updates a manual record (#242). Artist, title and format are required; `value`
/// is the user's own estimate and counts towards the collection value.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualRecordRequest {
    pub artist: String,
    pub title: String,
    pub format: String,
    #[serde(default)]
    pub year: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub catno: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub barcode: Option<String>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub media_condition: Option<String>,
    #[serde(default)]
    pub sleeve_condition: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub value: Option<f64>,
    /// Label photo the record was read from: it becomes the cover and is completed.
    #[serde(default)]
    pub label_photo_id: Option<i64>,
}

/// A newly created manual record and its shelf placement (when shelves exist for its medium).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualRecordCreatedDto {
    pub record: RecordDetailDto,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placement: Option<StoragePlacementDto>,
}
