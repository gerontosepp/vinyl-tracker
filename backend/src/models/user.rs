use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AppUser {
    pub id: i64,
    pub username: String,
    pub password: String,
    pub discogs_username: Option<String>,
    pub discogs_token: Option<String>,
    pub roon_host: Option<String>,
    pub roon_port: Option<i32>,
    pub roon_zone_id: Option<String>,
    pub roon_zone_name: Option<String>,
    pub roon_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequestDto {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequestDto {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequestDto {
    pub username: String,
    #[serde(alias = "newPassword", alias = "new_password")]
    pub new_password: String,
    #[serde(alias = "discogsToken", alias = "discogs_token")]
    pub discogs_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDiscogsRequestDto {
    pub token: String,
    #[serde(alias = "discogsUsername", alias = "discogs_username")]
    pub discogs_username: Option<String>,
    pub password: Option<String>,
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

impl AppUser {
    pub fn to_dto(&self, token: Option<String>) -> UserResponseDto {
        let roon_paired = self
            .roon_token
            .as_ref()
            .map(|t| !t.trim().is_empty())
            .unwrap_or(false);

        let has_discogs_token = self
            .discogs_token
            .as_ref()
            .map(|t| !t.trim().is_empty())
            .unwrap_or(false);

        UserResponseDto {
            id: self.id,
            username: self.username.clone(),
            discogs_username: self.discogs_username.clone(),
            token,
            roon_host: self.roon_host.clone(),
            roon_port: self.roon_port,
            roon_zone_id: self.roon_zone_id.clone(),
            roon_zone_name: self.roon_zone_name.clone(),
            roon_paired: Some(roon_paired),
            has_discogs_token: Some(has_discogs_token),
        }
    }
}
