use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoonZoneDto {
    pub zone_id: String,
    pub name: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoonStatusDto {
    pub connected: bool,
    pub paired: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub core_id: Option<String>,
    pub host: Option<String>,
    pub port: Option<i32>,
    pub selected_zone_id: Option<String>,
    pub selected_zone_name: Option<String>,
    pub zones: Vec<RoonZoneDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoonSettingsDto {
    #[serde(alias = "host", alias = "roon_host")]
    pub roon_host: Option<String>,
    #[serde(alias = "port", alias = "roon_port")]
    pub roon_port: Option<i32>,
    #[serde(alias = "zone_id", alias = "zoneId", alias = "roon_zone_id")]
    pub roon_zone_id: Option<String>,
    #[serde(alias = "zone_name", alias = "zoneName", alias = "roon_zone_name")]
    pub roon_zone_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoonPlayRequestDto {
    pub artist: String,
    pub title: String,
    #[serde(alias = "zone_id")]
    pub zone_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoonPlayResponseDto {
    pub success: bool,
    pub message: String,
}
