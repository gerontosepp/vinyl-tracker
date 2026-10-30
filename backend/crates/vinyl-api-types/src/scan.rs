use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRequest {
    pub barcode: String,
    /// Identify mode (#294): resolve the record without logging a listen.
    #[serde(default)]
    pub identify: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedRecordDto {
    #[serde(rename = "discogsId")]
    pub discogs_id: i64,
    pub title: String,
    pub artist: String,
    #[serde(rename = "thumbUrl")]
    pub thumb_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsMatchDto {
    pub id: i64,
    pub title: String,
    pub year: Option<String>,
    #[serde(rename = "thumbUrl")]
    pub thumb_url: Option<String>,
    #[serde(rename = "coverImage")]
    pub cover_image: Option<String>,
    pub format: Option<Vec<String>>,
    pub country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResultDto {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub record: Option<TrackedRecordDto>,
    #[serde(rename = "discogsMatches", skip_serializing_if = "Option::is_none")]
    pub discogs_matches: Option<Vec<DiscogsMatchDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetResultDto {
    pub success: bool,
    pub message: String,
    #[serde(rename = "deletedCount")]
    pub deleted_count: i64,
}
