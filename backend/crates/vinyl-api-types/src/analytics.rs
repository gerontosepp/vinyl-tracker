use crate::scan::TrackedRecordDto;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListenEventDto {
    pub id: i64,
    pub record: Option<TrackedRecordDto>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopRecordDto {
    /// Discogs release ID; lets clients open the record's details. Defaults to 0 for
    /// responses of servers that predate the field.
    #[serde(rename = "discogsId", default)]
    pub discogs_id: i64,
    pub title: String,
    #[serde(rename = "recordTitle")]
    pub record_title: String,
    pub artist: String,
    #[serde(rename = "thumbUrl")]
    pub thumb_url: Option<String>,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionValueData {
    pub currency: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionValueResponse {
    pub minimum: CollectionValueData,
    pub median: CollectionValueData,
    pub maximum: CollectionValueData,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GenreBreakdownItem {
    pub name: String,
    pub value: i64,
}
