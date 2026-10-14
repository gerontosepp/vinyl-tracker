use serde::{Deserialize, Serialize};
use crate::models::discogs::{DiscogsFormat, DiscogsLabel, DiscogsTrack};

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
    pub notes: Option<String>,
    pub country: Option<String>,
    pub released: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateConditionRequestDto {
    #[serde(alias = "mediaCondition")]
    pub media_condition: Option<String>,
    #[serde(alias = "sleeveCondition")]
    pub sleeve_condition: Option<String>,
}
