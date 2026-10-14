use sqlx::PgPool;
use crate::{
    auth::jwt::generate_token,
    config::Config,
    error::AppError,
    models::user::{
        AppUser, LoginRequestDto, RegisterRequestDto, ResetPasswordRequestDto,
        UpdateDiscogsRequestDto, UserResponseDto,
    },
    services::crypto_service::CryptoService,
};

pub struct UserService;

impl UserService {
    pub async fn register(
        pool: &PgPool,
        config: &Config,
        payload: RegisterRequestDto,
    ) -> Result<UserResponseDto, AppError> {
        let username = payload.username.trim();
        let password = payload.password;

        if username.len() < 3 {
            return Err(AppError::BadRequest("Username must be at least 3 characters long".to_string()));
        }
        if password.len() < 8 {
            return Err(AppError::BadRequest("Password must be at least 8 characters long".to_string()));
        }

        // Check if user already exists
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM app_user WHERE username = $1)")
            .bind(username)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;

        if exists {
            return Err(AppError::Conflict("Username already taken".to_string()));
        }

        let hashed_password = bcrypt::hash(&password, 10)
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {e}")))?;

        let user = sqlx::query_as::<_, AppUser>(
            "INSERT INTO app_user (username, password)
             VALUES ($1, $2)
             RETURNING id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token",
        )
        .bind(username)
        .bind(hashed_password)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;

        let token = generate_token(&user.username, &config.jwt_secret, config.jwt_expiration_secs)?;
        Ok(user.to_dto(Some(token)))
    }

    pub async fn login(
        pool: &PgPool,
        config: &Config,
        payload: LoginRequestDto,
    ) -> Result<UserResponseDto, AppError> {
        let user = sqlx::query_as::<_, AppUser>(
            "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token
             FROM app_user WHERE username = $1",
        )
        .bind(payload.username.trim())
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::Unauthorized("Invalid username or password".to_string()))?;

        let is_valid = if user.password.starts_with("$2a$")
            || user.password.starts_with("$2b$")
            || user.password.starts_with("$2y$")
        {
            bcrypt::verify(&payload.password, &user.password).unwrap_or(false)
        } else {
            // Fallback for legacy plain-text development seeds
            user.password == payload.password
        };

        if !is_valid {
            return Err(AppError::Unauthorized("Invalid username or password".to_string()));
        }

        let token = generate_token(&user.username, &config.jwt_secret, config.jwt_expiration_secs)?;
        Ok(user.to_dto(Some(token)))
    }

    pub async fn get_user(pool: &PgPool, username: &str) -> Result<UserResponseDto, AppError> {
        let user = sqlx::query_as::<_, AppUser>(
            "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token
             FROM app_user WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        Ok(user.to_dto(None))
    }

    pub async fn update_discogs(
        pool: &PgPool,
        crypto: &CryptoService,
        username: &str,
        payload: UpdateDiscogsRequestDto,
    ) -> Result<UserResponseDto, AppError> {
        let encrypted_token = crypto.encrypt(&payload.token);

        let user = sqlx::query_as::<_, AppUser>(
            "UPDATE app_user
             SET discogs_username = $1, discogs_token = $2
             WHERE username = $3
             RETURNING id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token",
        )
        .bind(payload.discogs_username)
        .bind(encrypted_token)
        .bind(username)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        Ok(user.to_dto(None))
    }

    pub async fn reset_password(
        pool: &PgPool,
        config: &Config,
        crypto: &CryptoService,
        payload: ResetPasswordRequestDto,
    ) -> Result<UserResponseDto, AppError> {
        let new_password = payload.new_password;
        if new_password.len() < 8 {
            return Err(AppError::BadRequest("Password must be at least 8 characters long".to_string()));
        }

        let hashed_password = bcrypt::hash(&new_password, 10)
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {e}")))?;

        let encrypted_token = payload
            .discogs_token
            .as_deref()
            .and_then(|t| crypto.encrypt(t));

        let user = if let Some(enc_token) = encrypted_token {
            sqlx::query_as::<_, AppUser>(
                "UPDATE app_user
                 SET password = $1, discogs_token = $2
                 WHERE username = $3
                 RETURNING id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token",
            )
            .bind(hashed_password)
            .bind(enc_token)
            .bind(payload.username.trim())
            .fetch_optional(pool)
            .await
        } else {
            sqlx::query_as::<_, AppUser>(
                "UPDATE app_user
                 SET password = $1
                 WHERE username = $2
                 RETURNING id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token",
            )
            .bind(hashed_password)
            .bind(payload.username.trim())
            .fetch_optional(pool)
            .await
        }
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        let token = generate_token(&user.username, &config.jwt_secret, config.jwt_expiration_secs)?;
        Ok(user.to_dto(Some(token)))
    }
}
