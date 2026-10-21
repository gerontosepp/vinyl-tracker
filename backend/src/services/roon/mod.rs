pub mod client;
pub mod moo;

use crate::{
    error::AppError,
    models::{
        roon::{RoonPlayRequestDto, RoonSettingsDto, RoonStatusDto, RoonZoneDto},
        user::AppUser,
    },
    services::roon::client::RoonClient,
};
use sqlx::PgPool;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{RwLock, mpsc};

#[derive(Clone)]
pub struct RoonService {
    sessions: Arc<RwLock<HashMap<i64, RoonClient>>>,
}

impl Default for RoonService {
    fn default() -> Self {
        Self::new()
    }
}

impl RoonService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_status(&self, pool: &PgPool, user: &AppUser) -> RoonStatusDto {
        let host = match &user.roon_host {
            Some(h) if !h.trim().is_empty() => h.trim().to_string(),
            _ => {
                return RoonStatusDto {
                    connected: false,
                    paired: false,
                    core_name: None,
                    core_id: None,
                    host: user.roon_host.clone(),
                    port: Some(user.roon_port.unwrap_or(9100)),
                    selected_zone_id: user.roon_zone_id.clone(),
                    selected_zone_name: user.roon_zone_name.clone(),
                    zones: Vec::new(),
                };
            }
        };

        let port = user.roon_port.unwrap_or(9100);

        match self.get_or_create_client(pool, user, &host, port).await {
            Ok(client) => {
                let connected = client.is_connected();
                let paired = client.is_paired();
                let core_id = client.get_core_id().await;
                let core_name = client.get_core_name().await;
                let zones = client.get_zones().await;

                RoonStatusDto {
                    connected,
                    paired,
                    core_name,
                    core_id,
                    host: Some(host),
                    port: Some(port),
                    selected_zone_id: user.roon_zone_id.clone(),
                    selected_zone_name: user.roon_zone_name.clone(),
                    zones,
                }
            }
            Err(e) => {
                tracing::debug!("Roon client connection error for user {}: {e}", user.id);
                let paired = user
                    .roon_token
                    .as_ref()
                    .map(|t| !t.trim().is_empty())
                    .unwrap_or(false);
                RoonStatusDto {
                    connected: false,
                    paired,
                    core_name: None,
                    core_id: None,
                    host: Some(host),
                    port: Some(port),
                    selected_zone_id: user.roon_zone_id.clone(),
                    selected_zone_name: user.roon_zone_name.clone(),
                    zones: Vec::new(),
                }
            }
        }
    }

    pub async fn get_zones(&self, pool: &PgPool, user: &AppUser) -> Vec<RoonZoneDto> {
        let host = match &user.roon_host {
            Some(h) if !h.trim().is_empty() => h.trim().to_string(),
            _ => return Vec::new(),
        };

        let port = user.roon_port.unwrap_or(9100);

        match self.get_or_create_client(pool, user, &host, port).await {
            Ok(client) => client.get_zones().await,
            Err(_) => Vec::new(),
        }
    }

    pub async fn update_settings(
        &self,
        pool: &PgPool,
        user: &AppUser,
        settings: RoonSettingsDto,
    ) -> Result<RoonStatusDto, AppError> {
        // Disconnect existing session
        {
            let mut sessions = self.sessions.write().await;
            sessions.remove(&user.id);
        }

        let host = settings
            .roon_host
            .as_deref()
            .map(|h| h.trim())
            .filter(|h| !h.is_empty())
            .map(|h| h.to_string());

        let port = settings.roon_port.unwrap_or(9100);

        // Update database
        if host.is_none() {
            sqlx::query(
                r#"
                UPDATE app_user
                SET roon_host = NULL, roon_port = $1, roon_zone_id = $2, roon_zone_name = $3, roon_token = NULL
                WHERE id = $4
                "#,
            )
            .bind(port)
            .bind(&settings.roon_zone_id)
            .bind(&settings.roon_zone_name)
            .bind(user.id)
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                r#"
                UPDATE app_user
                SET roon_host = $1, roon_port = $2, roon_zone_id = $3, roon_zone_name = $4
                WHERE id = $5
                "#,
            )
            .bind(&host)
            .bind(port)
            .bind(&settings.roon_zone_id)
            .bind(&settings.roon_zone_name)
            .bind(user.id)
            .execute(pool)
            .await?;
        }

        // Fetch updated user
        let updated_user: AppUser = sqlx::query_as("SELECT * FROM app_user WHERE id = $1")
            .bind(user.id)
            .fetch_one(pool)
            .await?;

        Ok(self.get_status(pool, &updated_user).await)
    }

    pub async fn play_album(
        &self,
        pool: &PgPool,
        user: &AppUser,
        request: RoonPlayRequestDto,
    ) -> Result<bool, AppError> {
        let host = match &user.roon_host {
            Some(h) if !h.trim().is_empty() => h.trim().to_string(),
            _ => {
                return Err(AppError::BadRequest(
                    "Roon Core is not configured. Please configure host in Settings.".to_string(),
                ));
            }
        };

        let port = user.roon_port.unwrap_or(9100);
        let client = self
            .get_or_create_client(pool, user, &host, port)
            .await
            .map_err(|e| {
                AppError::BadRequest(format!("Roon Core is not connected at {host}:{port} ({e})"))
            })?;

        if !client.is_connected() {
            return Err(AppError::BadRequest(format!(
                "Roon Core is not connected at {host}:{port}"
            )));
        }

        let mut target_zone_id = request
            .zone_id
            .clone()
            .or_else(|| user.roon_zone_id.clone());
        if target_zone_id.as_deref().unwrap_or("").trim().is_empty() {
            let zones = client.get_zones().await;
            if let Some(first) = zones.first() {
                target_zone_id = Some(first.zone_id.clone());
            } else {
                return Err(AppError::BadRequest(
                    "No Roon playback zone selected or found.".to_string(),
                ));
            }
        }

        let zone_id = target_zone_id.unwrap();
        client
            .play_album(&zone_id, &request.artist, &request.title)
            .await
    }

    async fn get_or_create_client(
        &self,
        pool: &PgPool,
        user: &AppUser,
        host: &str,
        port: i32,
    ) -> Result<RoonClient, AppError> {
        {
            let sessions = self.sessions.read().await;
            if let Some(client) = sessions.get(&user.id).filter(|c| c.is_connected()) {
                return Ok(client.clone());
            }
        }

        let (token_tx, mut token_rx) = mpsc::channel::<String>(4);
        let user_id = user.id;
        let pool_clone = pool.clone();

        tokio::spawn(async move {
            if let Some(new_token) = token_rx.recv().await {
                let _ = sqlx::query("UPDATE app_user SET roon_token = $1 WHERE id = $2")
                    .bind(new_token)
                    .bind(user_id)
                    .execute(&pool_clone)
                    .await;
            }
        });

        let client = RoonClient::connect(
            host.to_string(),
            port,
            user.roon_token.clone(),
            Some(token_tx),
        )
        .await?;

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(user.id, client.clone());
        }

        Ok(client)
    }
}
