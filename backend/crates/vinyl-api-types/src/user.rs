use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequestDto {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponseDto {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discogs_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roon_host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roon_port: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roon_zone_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roon_zone_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roon_paired: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_discogs_token: Option<bool>,
}
