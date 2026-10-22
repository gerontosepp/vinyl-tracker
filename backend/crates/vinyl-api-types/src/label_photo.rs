//! Label photo inbox (#208): photos of record labels waiting to be identified by Claude via
//! MCP. Field names are camelCase, timestamps ISO 8601 in UTC.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LabelPhotoStatus {
    Pending,
    Identified,
    Failed,
}

impl LabelPhotoStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            LabelPhotoStatus::Pending => "pending",
            LabelPhotoStatus::Identified => "identified",
            LabelPhotoStatus::Failed => "failed",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "pending" => Some(LabelPhotoStatus::Pending),
            "identified" => Some(LabelPhotoStatus::Identified),
            "failed" => Some(LabelPhotoStatus::Failed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPhotoDto {
    pub id: i64,
    pub status: LabelPhotoStatus,
    pub discogs_id: Option<i64>,
    pub created_at: String,
    pub processed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPhotosDto {
    pub photos: Vec<LabelPhotoDto>,
    pub pending_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPhotoUploadDto {
    pub id: i64,
    pub pending_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLabelPhotoRequest {
    pub status: LabelPhotoStatus,
    #[serde(default)]
    pub discogs_id: Option<i64>,
}
