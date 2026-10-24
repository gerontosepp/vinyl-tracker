use crate::{
    clients::openrouter::DEFAULT_OPENROUTER_MODEL,
    error::AppError,
    models::label_photo::{OpenRouterSettingsDto, UpdateOpenRouterSettingsRequest},
    services::crypto_service::CryptoService,
};
use sqlx::{PgPool, Row};

const MAX_MODEL_LEN: usize = 100;
const MAX_API_KEY_LEN: usize = 500;

/// Decrypted OpenRouter credentials of a user.
pub struct OpenRouterCredentials {
    pub api_key: String,
    pub model: String,
}

pub struct OpenRouterSettingsService;

impl OpenRouterSettingsService {
    /// Reports a key only if it can be decrypted, i.e. if the identification can actually use it.
    pub async fn get(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
    ) -> Result<OpenRouterSettingsDto, AppError> {
        let row =
            sqlx::query("SELECT openrouter_api_key, openrouter_model FROM app_user WHERE id = $1")
                .bind(user_id)
                .fetch_one(pool)
                .await
                .map_err(AppError::Database)?;
        let api_key: Option<String> = row.get("openrouter_api_key");
        let model: Option<String> = row.get("openrouter_model");
        Ok(OpenRouterSettingsDto {
            has_api_key: api_key.is_some_and(|key| crypto.decrypt(&key).is_some()),
            model: model.unwrap_or_else(|| DEFAULT_OPENROUTER_MODEL.to_string()),
            default_model: DEFAULT_OPENROUTER_MODEL.to_string(),
        })
    }

    pub async fn update(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
        request: UpdateOpenRouterSettingsRequest,
    ) -> Result<OpenRouterSettingsDto, AppError> {
        let model = request
            .model
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty() && m != DEFAULT_OPENROUTER_MODEL);
        if model.as_ref().is_some_and(|m| m.len() > MAX_MODEL_LEN) {
            return Err(AppError::BadRequest(format!(
                "Model exceeds {MAX_MODEL_LEN} characters"
            )));
        }

        // `None` keeps the stored key; an empty string removes it
        let encrypted_key = match request.api_key.map(|k| k.trim().to_string()) {
            None => None,
            Some(key) if key.is_empty() => Some(None),
            Some(key) if key.len() > MAX_API_KEY_LEN => {
                return Err(AppError::BadRequest("API key is too long".to_string()));
            }
            Some(key) => Some(Some(crypto.encrypt(&key).ok_or_else(|| {
                AppError::Internal("Failed to encrypt the API key".to_string())
            })?)),
        };

        sqlx::query(
            "UPDATE app_user
             SET openrouter_model = $2,
                 openrouter_api_key = CASE WHEN $3 THEN $4 ELSE openrouter_api_key END
             WHERE id = $1",
        )
        .bind(user_id)
        .bind(&model)
        .bind(encrypted_key.is_some())
        .bind(encrypted_key.flatten())
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

        Self::get(pool, crypto, user_id).await
    }

    /// Credentials for the automatic identification, `None` without a usable API key.
    pub async fn credentials(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
    ) -> Result<Option<OpenRouterCredentials>, AppError> {
        let row =
            sqlx::query("SELECT openrouter_api_key, openrouter_model FROM app_user WHERE id = $1")
                .bind(user_id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;
        let Some(row) = row else {
            return Ok(None);
        };
        let api_key = row
            .get::<Option<String>, _>("openrouter_api_key")
            .and_then(|encrypted| crypto.decrypt(&encrypted));
        Ok(api_key.map(|api_key| OpenRouterCredentials {
            api_key,
            model: row
                .get::<Option<String>, _>("openrouter_model")
                .unwrap_or_else(|| DEFAULT_OPENROUTER_MODEL.to_string()),
        }))
    }
}
