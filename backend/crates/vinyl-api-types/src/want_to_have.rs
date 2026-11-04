use serde::{Deserialize, Serialize};

/// A record on the user's Want-to-Have list (#310): known from label recognition or search, not
/// owned. Details (tracklist, labels) come from `GET /api/records/{discogs_id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WantToHaveItemDto {
    pub id: i64,
    #[serde(rename = "discogs_id")]
    pub discogs_id: i64,
    pub title: String,
    pub artist: String,
    pub year: Option<String>,
    #[serde(rename = "thumb_url")]
    pub thumb_url: Option<String>,
    pub format: Option<String>,
    pub genres: Vec<String>,
    /// UTC, ISO 8601
    #[serde(rename = "created_at")]
    pub created_at: String,
}

/// Adds a Discogs release to the Want-to-Have list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddWantToHaveRequestDto {
    #[serde(alias = "discogsId")]
    pub discogs_id: i64,
}

/// Which of the queried Discogs IDs are already owned or on the Want-to-Have list.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WantToHaveStatusDto {
    #[serde(rename = "in_collection")]
    pub in_collection: Vec<i64>,
    #[serde(rename = "in_want_to_have")]
    pub in_want_to_have: Vec<i64>,
}
