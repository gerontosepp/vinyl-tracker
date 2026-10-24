//! Label photo inbox (#208): photos of record labels waiting to be identified, either by the
//! backend via OpenRouter (#235) or by Claude via MCP. Field names are camelCase, timestamps
//! ISO 8601 in UTC.

use serde::{Deserialize, Serialize};

/// How to read a label photo and find its Discogs release; shared by the MCP prompts and the
/// backend identification. Tool names: `search_discogs`, `get_record_details`.
pub const LABEL_READING_STEPS: &str = "\
1. Read everything printed on the label photo: artist, title, record label, catalog number, side (A/B), \
country, year or (c)/(p) notes, rights society (e.g. GEMA, BIEM), label code (LC) and the label design or colour. \
If the photo shows the run-out groove, also read the matrix / runout etching.\n\
2. Call `search_discogs` with `catno` and `label`. Without results, try catalog number variants (with and without spaces \
or hyphens), then `artist` + `release_title`, and finally a free-text `query`.\n\
3. Check the most promising candidates with `get_record_details` and compare country, year, label variant, catalog number \
and identifiers (matrix / runout, rights society, label code) with the photo.";

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

/// State of the automatic identification of a photo; `None` on the DTO when none was requested.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LabelIdentifyState {
    Queued,
    Running,
    Done,
    Error,
}

impl LabelIdentifyState {
    pub fn as_str(self) -> &'static str {
        match self {
            LabelIdentifyState::Queued => "queued",
            LabelIdentifyState::Running => "running",
            LabelIdentifyState::Done => "done",
            LabelIdentifyState::Error => "error",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "queued" => Some(LabelIdentifyState::Queued),
            "running" => Some(LabelIdentifyState::Running),
            "done" => Some(LabelIdentifyState::Done),
            "error" => Some(LabelIdentifyState::Error),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LabelMatchConfidence {
    High,
    Medium,
    Low,
}

/// A Discogs release proposed for a label photo, enriched with release data for display.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelCandidate {
    pub discogs_id: i64,
    pub confidence: LabelMatchConfidence,
    pub reason: String,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub year: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub catno: Option<String>,
    #[serde(default)]
    pub thumb_url: Option<String>,
    #[serde(default)]
    pub in_collection: bool,
}

/// Result of the automatic identification: best match, close alternatives and an optional hint
/// (e.g. which further photo would help).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelSuggestion {
    pub best: LabelCandidate,
    #[serde(default)]
    pub alternatives: Vec<LabelCandidate>,
    #[serde(default)]
    pub hint: Option<String>,
}

/// What the automatic identification read from the label, kept also without a Discogs match;
/// it pre-fills the form for a manual record (#242).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelReading {
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub catno: Option<String>,
    #[serde(default)]
    pub year: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub format: Option<String>,
}

/// `identifyState = done` without `suggestion` means no Discogs release matched; `identifyError`
/// then holds the model's hint instead of an error.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPhotoDto {
    pub id: i64,
    pub status: LabelPhotoStatus,
    pub discogs_id: Option<i64>,
    pub created_at: String,
    pub processed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identify_state: Option<LabelIdentifyState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<LabelSuggestion>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identify_error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identify_model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_reading: Option<LabelReading>,
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
    /// `true` when the photo is identified automatically (OpenRouter key configured).
    #[serde(default)]
    pub identifying: bool,
}

/// Result of deleting several label photos at once.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelPhotoDeleteDto {
    pub deleted: i64,
    pub pending_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLabelPhotoRequest {
    pub status: LabelPhotoStatus,
    #[serde(default)]
    pub discogs_id: Option<i64>,
}

/// OpenRouter settings of a user for the automatic label identification; the key itself is
/// never returned.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRouterSettingsDto {
    pub has_api_key: bool,
    pub model: String,
    pub default_model: String,
}

/// `apiKey`: missing keeps the stored key, an empty string removes it. `model`: missing or
/// empty resets to the default model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOpenRouterSettingsRequest {
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}
