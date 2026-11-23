//! Management of provider-independent AI connections (#393). The service owns validation,
//! encryption, the single-default rule and the compatibility alias for the former OpenRouter
//! settings.

use crate::{
    clients::ai::AiTarget,
    config::Config,
    error::AppError,
    models::{
        ai_connection::{
            AiConnectionDto, AiConnectionRecord, AiConnectionTestDto, AiCredentials, AiModelsDto,
            AiPresetDto, AuthStyle, DEFAULT_OPENROUTER_BASE_URL, DEFAULT_OPENROUTER_MODEL,
            SaveAiConnectionRequest, find_preset, preset_dtos,
        },
        label_photo::{OpenRouterSettingsDto, UpdateOpenRouterSettingsRequest},
    },
    services::crypto_service::CryptoService,
    state::AppState,
};
use reqwest::header::{HeaderName, HeaderValue};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::net::IpAddr;
use url::Url;

const MAX_NAME_LEN: usize = 100;
const MAX_URL_LEN: usize = 500;
const MAX_MODEL_LEN: usize = 200;
const MAX_KEY_LEN: usize = 500;
const MAX_HEADERS: usize = 20;

pub struct AiConnectionService;

impl AiConnectionService {
    pub fn presets() -> Vec<AiPresetDto> {
        preset_dtos()
    }

    pub async fn list(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
    ) -> Result<Vec<AiConnectionDto>, AppError> {
        let rows: Vec<AiConnectionRecord> = sqlx::query_as(
            "SELECT id, user_id, name, kind, base_url, model, api_key, auth_style, extra_headers,
                    is_default, created_at, updated_at
             FROM ai_connection WHERE user_id = $1
             ORDER BY is_default DESC, name ASC, id ASC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(rows.iter().map(|row| to_dto(row, crypto)).collect())
    }

    pub async fn get(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
        id: i64,
    ) -> Result<AiConnectionDto, AppError> {
        let row = fetch_owned(pool, user_id, id).await?;
        Ok(to_dto(&row, crypto))
    }

    pub async fn create(
        pool: &PgPool,
        crypto: &CryptoService,
        config: &Config,
        user_id: i64,
        request: SaveAiConnectionRequest,
    ) -> Result<AiConnectionDto, AppError> {
        let prepared = PreparedConnection::new(&request, config)?;
        if prepared.api_key.is_none() && prepared.preset().requires_api_key {
            return Err(AppError::BadRequest(
                "An API key is required for this provider".to_string(),
            ));
        }
        let encrypted = encrypted_key(crypto, prepared.api_key)?;

        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        // Serialise connection creation per user so two concurrent first connections cannot
        // both become the default (the partial unique index would turn the loser into a 500).
        sqlx::query("SELECT id FROM app_user WHERE id = $1 FOR UPDATE")
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM ai_connection WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&mut *tx)
                .await
                .map_err(AppError::Database)?;
        let is_default = count == 0;

        let row: AiConnectionRecord = sqlx::query_as(
            "INSERT INTO ai_connection
                 (user_id, name, kind, base_url, model, api_key, auth_style, extra_headers, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, user_id, name, kind, base_url, model, api_key, auth_style,
                       extra_headers, is_default, created_at, updated_at",
        )
        .bind(user_id)
        .bind(&prepared.name)
        .bind(prepared.kind)
        .bind(&prepared.base_url)
        .bind(&prepared.model)
        .bind(encrypted)
        .bind(prepared.auth_style.as_str())
        .bind(prepared.extra_headers.unwrap_or_else(|| json!({})))
        .bind(is_default)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        tx.commit().await.map_err(AppError::Database)?;
        Ok(to_dto(&row, crypto))
    }

    pub async fn update(
        pool: &PgPool,
        crypto: &CryptoService,
        config: &Config,
        user_id: i64,
        id: i64,
        request: SaveAiConnectionRequest,
    ) -> Result<AiConnectionDto, AppError> {
        let existing = fetch_owned(pool, user_id, id).await?;
        let prepared = PreparedConnection::new(&request, config)?;

        // `apiKey` missing keeps the stored key; an empty string removes it.
        let encrypted = match request.api_key.as_deref().map(str::trim) {
            None => existing.api_key.clone(),
            Some("") => None,
            Some(key) => encrypted_key(crypto, Some(key.to_string()))?,
        };

        let row: AiConnectionRecord = sqlx::query_as(
            "UPDATE ai_connection
             SET name = $3, kind = $4, base_url = $5, model = $6, api_key = $7,
                 auth_style = $8, extra_headers = COALESCE($9, extra_headers),
                 updated_at = NOW() AT TIME ZONE 'UTC'
             WHERE id = $1 AND user_id = $2
             RETURNING id, user_id, name, kind, base_url, model, api_key, auth_style,
                       extra_headers, is_default, created_at, updated_at",
        )
        .bind(id)
        .bind(user_id)
        .bind(&prepared.name)
        .bind(prepared.kind)
        .bind(&prepared.base_url)
        .bind(&prepared.model)
        .bind(encrypted)
        .bind(prepared.auth_style.as_str())
        .bind(&prepared.extra_headers)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(to_dto(&row, crypto))
    }

    pub async fn delete(pool: &PgPool, user_id: i64, id: i64) -> Result<(), AppError> {
        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        let was_default: Option<bool> = sqlx::query_scalar(
            "DELETE FROM ai_connection WHERE id = $1 AND user_id = $2 RETURNING is_default",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        let Some(was_default) = was_default else {
            return Err(AppError::NotFound("AI connection not found".to_string()));
        };
        if was_default {
            sqlx::query(
                "UPDATE ai_connection SET is_default = TRUE
                 WHERE id = (
                     SELECT id FROM ai_connection WHERE user_id = $1 ORDER BY id ASC LIMIT 1
                 )",
            )
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        }
        tx.commit().await.map_err(AppError::Database)?;
        Ok(())
    }

    pub async fn set_default(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
        id: i64,
    ) -> Result<AiConnectionDto, AppError> {
        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM ai_connection WHERE id = $1 AND user_id = $2)",
        )
        .bind(id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        if !exists {
            return Err(AppError::NotFound("AI connection not found".to_string()));
        }
        sqlx::query("UPDATE ai_connection SET is_default = FALSE WHERE user_id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        let row: AiConnectionRecord = sqlx::query_as(
            "UPDATE ai_connection SET is_default = TRUE, updated_at = NOW() AT TIME ZONE 'UTC'
             WHERE id = $1 AND user_id = $2
             RETURNING id, user_id, name, kind, base_url, model, api_key, auth_style,
                       extra_headers, is_default, created_at, updated_at",
        )
        .bind(id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        tx.commit().await.map_err(AppError::Database)?;
        Ok(to_dto(&row, crypto))
    }

    pub async fn test(
        state: &AppState,
        user_id: i64,
        id: i64,
    ) -> Result<AiConnectionTestDto, AppError> {
        let credentials = credentials_for(&state.pool, &state.crypto, state, user_id, id).await?;
        state
            .ai
            .test(&credentials.target(), &credentials.record.model)
            .await?;
        Ok(AiConnectionTestDto {
            ok: true,
            provider: credentials.record.provider_label().to_string(),
            model: credentials.record.model,
        })
    }

    pub async fn models(state: &AppState, user_id: i64, id: i64) -> Result<AiModelsDto, AppError> {
        let credentials = credentials_for(&state.pool, &state.crypto, state, user_id, id).await?;
        let models = state.ai.list_models(&credentials.target()).await?;
        Ok(AiModelsDto {
            supported: models.is_some(),
            models: models.unwrap_or_default(),
        })
    }

    /// Default connection for the automatic identification, `None` when none is usable.
    pub async fn default_credentials(
        pool: &PgPool,
        crypto: &CryptoService,
        config: &Config,
        user_id: i64,
    ) -> Result<Option<AiCredentials>, AppError> {
        let record: Option<AiConnectionRecord> = sqlx::query_as(
            "SELECT id, user_id, name, kind, base_url, model, api_key, auth_style, extra_headers,
                    is_default, created_at, updated_at
             FROM ai_connection WHERE user_id = $1 AND is_default ORDER BY id ASC LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
        let Some(record) = record else {
            return Ok(None);
        };
        if validate_base_url(&record.base_url, config).is_err() {
            tracing::warn!(
                "Default AI connection {} has an invalid base URL; ignoring it",
                record.id
            );
            return Ok(None);
        }
        let api_key = record.api_key.as_ref().and_then(|key| crypto.decrypt(key));
        if record.api_key.is_some() && api_key.is_none() {
            tracing::warn!(
                "Default AI connection {} has an undecryptable key; ignoring it",
                record.id
            );
            return Ok(None);
        }
        if api_key.is_none()
            && record.auth_style() != AuthStyle::None
            && find_preset(&record.kind).is_some_and(|preset| preset.requires_api_key)
        {
            return Ok(None);
        }
        Ok(Some(AiCredentials { record, api_key }))
    }

    pub async fn has_usable_default(
        pool: &PgPool,
        crypto: &CryptoService,
        config: &Config,
        user_id: i64,
    ) -> Result<bool, AppError> {
        Ok(Self::default_credentials(pool, crypto, config, user_id)
            .await?
            .is_some())
    }

    /// Compatibility alias for the former OpenRouter settings.
    pub async fn openrouter_settings(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
    ) -> Result<OpenRouterSettingsDto, AppError> {
        let row = openrouter_connection(pool, user_id).await?;
        Ok(OpenRouterSettingsDto {
            has_api_key: row
                .as_ref()
                .and_then(|row| row.api_key.as_ref())
                .is_some_and(|key| crypto.decrypt(key).is_some()),
            model: row
                .as_ref()
                .map(|row| row.model.clone())
                .unwrap_or_else(|| DEFAULT_OPENROUTER_MODEL.to_string()),
            default_model: DEFAULT_OPENROUTER_MODEL.to_string(),
        })
    }

    pub async fn update_openrouter_settings(
        pool: &PgPool,
        crypto: &CryptoService,
        user_id: i64,
        request: UpdateOpenRouterSettingsRequest,
    ) -> Result<OpenRouterSettingsDto, AppError> {
        let model = request
            .model
            .map(|m| m.trim().to_string())
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| DEFAULT_OPENROUTER_MODEL.to_string());
        if model.len() > MAX_MODEL_LEN {
            return Err(AppError::BadRequest(format!(
                "Model exceeds {MAX_MODEL_LEN} characters"
            )));
        }
        let encrypted = match request.api_key.map(|k| k.trim().to_string()) {
            None => None,
            Some(key) if key.is_empty() => Some(None),
            Some(key) if key.len() > MAX_KEY_LEN => {
                return Err(AppError::BadRequest("API key is too long".to_string()));
            }
            Some(key) => Some(Some(encrypted_key(crypto, Some(key))?)),
        };

        let existing = openrouter_connection(pool, user_id).await?;
        match existing {
            Some(row) => {
                sqlx::query(
                    "UPDATE ai_connection
                     SET model = $3, api_key = CASE WHEN $4 THEN $5 ELSE api_key END,
                         updated_at = NOW() AT TIME ZONE 'UTC'
                     WHERE id = $1 AND user_id = $2",
                )
                .bind(row.id)
                .bind(user_id)
                .bind(&model)
                .bind(encrypted.is_some())
                .bind(encrypted.flatten())
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
            }
            None => {
                let has_default: bool = sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM ai_connection WHERE user_id = $1 AND is_default)",
                )
                .bind(user_id)
                .fetch_one(pool)
                .await
                .map_err(AppError::Database)?;
                sqlx::query(
                    "INSERT INTO ai_connection
                         (user_id, name, kind, base_url, model, api_key, auth_style, extra_headers, is_default)
                     VALUES ($1, 'OpenRouter', 'openrouter', $2, $3, $4, 'bearer', '{}'::jsonb, $5)",
                )
                .bind(user_id)
                .bind(DEFAULT_OPENROUTER_BASE_URL)
                .bind(&model)
                .bind(encrypted.flatten())
                .bind(!has_default)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
            }
        }

        Self::openrouter_settings(pool, crypto, user_id).await
    }
}

struct PreparedConnection {
    name: String,
    kind: String,
    base_url: String,
    model: String,
    api_key: Option<String>,
    auth_style: AuthStyle,
    extra_headers: Option<Value>,
}

impl PreparedConnection {
    fn new(request: &SaveAiConnectionRequest, config: &Config) -> Result<Self, AppError> {
        let name = request.name.trim().to_string();
        if name.is_empty() || name.len() > MAX_NAME_LEN {
            return Err(AppError::BadRequest(format!(
                "Name must be between 1 and {MAX_NAME_LEN} characters"
            )));
        }
        let model = request.model.trim().to_string();
        if model.is_empty() || model.len() > MAX_MODEL_LEN {
            return Err(AppError::BadRequest(format!(
                "Model must be between 1 and {MAX_MODEL_LEN} characters"
            )));
        }
        let preset = find_preset(request.kind.trim())
            .ok_or_else(|| AppError::BadRequest(format!("Unknown AI preset '{}'", request.kind)))?;
        let base_url = validate_base_url(&request.base_url, config)?;
        let auth_style = request
            .auth_style
            .as_deref()
            .map(|style| {
                AuthStyle::parse(style)
                    .ok_or_else(|| AppError::BadRequest(format!("Unknown auth style '{style}'")))
            })
            .transpose()?
            .unwrap_or(preset.auth_style);
        let extra_headers = request
            .extra_headers
            .clone()
            .map(validate_extra_headers)
            .transpose()?;
        let api_key = request
            .api_key
            .as_deref()
            .map(str::trim)
            .filter(|key| !key.is_empty())
            .map(str::to_string);
        if api_key.as_ref().is_some_and(|key| key.len() > MAX_KEY_LEN) {
            return Err(AppError::BadRequest("API key is too long".to_string()));
        }
        Ok(Self {
            name,
            kind: preset.kind.to_string(),
            base_url,
            model,
            api_key,
            auth_style,
            extra_headers,
        })
    }

    fn preset(&self) -> &'static crate::models::ai_connection::AiPreset {
        find_preset(&self.kind).expect("validated preset")
    }
}

async fn fetch_owned(pool: &PgPool, user_id: i64, id: i64) -> Result<AiConnectionRecord, AppError> {
    sqlx::query_as(
        "SELECT id, user_id, name, kind, base_url, model, api_key, auth_style, extra_headers,
                is_default, created_at, updated_at
         FROM ai_connection WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("AI connection not found".to_string()))
}

async fn openrouter_connection(
    pool: &PgPool,
    user_id: i64,
) -> Result<Option<AiConnectionRecord>, AppError> {
    sqlx::query_as(
        "SELECT id, user_id, name, kind, base_url, model, api_key, auth_style, extra_headers,
                is_default, created_at, updated_at
         FROM ai_connection
         WHERE user_id = $1 AND kind = 'openrouter'
         ORDER BY is_default DESC, id ASC LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)
}

async fn credentials_for(
    pool: &PgPool,
    crypto: &CryptoService,
    state: &AppState,
    user_id: i64,
    id: i64,
) -> Result<AiCredentials, AppError> {
    let record = fetch_owned(pool, user_id, id).await?;
    validate_base_url(&record.base_url, &state.config)?;
    let api_key = record.api_key.as_ref().and_then(|key| crypto.decrypt(key));
    if record.api_key.is_some() && api_key.is_none() {
        return Err(AppError::Internal(
            "The stored API key cannot be decrypted".to_string(),
        ));
    }
    if api_key.is_none()
        && record.auth_style() != AuthStyle::None
        && find_preset(&record.kind).is_some_and(|preset| preset.requires_api_key)
    {
        return Err(AppError::BadRequest(
            "No API key is configured for this AI connection".to_string(),
        ));
    }
    Ok(AiCredentials { record, api_key })
}

pub fn to_dto(row: &AiConnectionRecord, crypto: &CryptoService) -> AiConnectionDto {
    AiConnectionDto {
        id: row.id,
        name: row.name.clone(),
        kind: row.kind.clone(),
        base_url: row.base_url.clone(),
        model: row.model.clone(),
        has_api_key: row
            .api_key
            .as_ref()
            .is_some_and(|key| crypto.decrypt(key).is_some()),
        auth_style: row.auth_style().as_str().to_string(),
        extra_headers: row.extra_headers.clone(),
        is_default: row.is_default,
        created_at: row.created_at_rfc3339(),
        updated_at: row.updated_at_rfc3339(),
    }
}

fn encrypted_key(crypto: &CryptoService, key: Option<String>) -> Result<Option<String>, AppError> {
    key.map(|key| {
        crypto
            .encrypt(&key)
            .ok_or_else(|| AppError::Internal("Failed to encrypt the API key".to_string()))
    })
    .transpose()
}

/// Validates a user-supplied base URL against SSRF and transport rules from the design.
pub fn validate_base_url(raw: &str, config: &Config) -> Result<String, AppError> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed.len() > MAX_URL_LEN {
        return Err(AppError::BadRequest(
            "Base URL must be between 1 and 500 characters".to_string(),
        ));
    }
    let url =
        Url::parse(trimmed).map_err(|e| AppError::BadRequest(format!("Invalid base URL: {e}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(AppError::BadRequest(
            "Base URL must use http or https".to_string(),
        ));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::BadRequest(
            "Base URL must not contain user information".to_string(),
        ));
    }
    if url.fragment().is_some() {
        return Err(AppError::BadRequest(
            "Base URL must not contain a fragment".to_string(),
        ));
    }
    let host = url
        .host_str()
        .ok_or_else(|| AppError::BadRequest("Base URL must contain a host".to_string()))?
        .to_ascii_lowercase();

    if matches!(
        host.as_str(),
        "metadata" | "metadata.google.internal" | "169.254.169.254" | "fd00:ec2::254"
    ) {
        return Err(AppError::BadRequest(
            "Base URL points to a blocked metadata host".to_string(),
        ));
    }

    let (private, link_local_or_special) = match host.parse::<IpAddr>() {
        Ok(ip) => (is_private_ip(ip), is_special_ip(ip)),
        Err(_) => (is_private_hostname(&host), false),
    };
    if link_local_or_special {
        return Err(AppError::BadRequest(
            "Base URL must not point to link-local or multicast addresses".to_string(),
        ));
    }
    if !private && url.scheme() == "http" {
        return Err(AppError::BadRequest(
            "Public AI endpoints must use HTTPS".to_string(),
        ));
    }
    if !config.ai_base_url_allowed_hosts.is_empty()
        && !config
            .ai_base_url_allowed_hosts
            .iter()
            .any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}")))
    {
        return Err(AppError::BadRequest(
            "Base URL host is not in AI_BASE_URL_ALLOWED_HOSTS".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_loopback(),
        IpAddr::V6(ip) => ip.is_loopback() || ip.is_unique_local(),
    }
}

fn is_special_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_link_local() || ip.is_unspecified() || ip.is_multicast() || ip.is_broadcast()
        }
        IpAddr::V6(ip) => ip.is_unicast_link_local() || ip.is_unspecified() || ip.is_multicast(),
    }
}

fn is_private_hostname(host: &str) -> bool {
    host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host == "host.docker.internal"
        || host == "gateway.docker.internal"
        || !host.contains('.')
}

fn validate_extra_headers(value: Value) -> Result<Value, AppError> {
    let Some(headers) = value.as_object() else {
        return Err(AppError::BadRequest(
            "extraHeaders must be a JSON object".to_string(),
        ));
    };
    if headers.len() > MAX_HEADERS {
        return Err(AppError::BadRequest(format!(
            "At most {MAX_HEADERS} extra headers are allowed"
        )));
    }
    for (name, value) in headers {
        let lower = name.to_ascii_lowercase();
        if matches!(lower.as_str(), "host" | "content-length" | "cookie")
            || lower.contains("auth")
            || lower.contains("key")
            || lower.contains("token")
            || lower.contains("secret")
        {
            return Err(AppError::BadRequest(format!(
                "Header '{name}' must not be set manually"
            )));
        }
        HeaderName::from_bytes(name.as_bytes())
            .map_err(|_| AppError::BadRequest(format!("Invalid header name '{name}'")))?;
        let value = value
            .as_str()
            .ok_or_else(|| AppError::BadRequest(format!("Header '{name}' must be a string")))?;
        HeaderValue::try_from(value)
            .map_err(|_| AppError::BadRequest(format!("Invalid value for header '{name}'")))?;
    }
    Ok(Value::Object(headers.clone()))
}

/// Handy for tests and callers that need a bare target without a full credentials struct.
impl AiCredentials {
    pub fn target(&self) -> AiTarget<'_> {
        AiTarget {
            kind: &self.record.kind,
            base_url: &self.record.base_url,
            api_key: self.api_key.as_deref(),
            auth_style: self.record.auth_style(),
            extra_headers: &self.record.extra_headers,
        }
    }
}
