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
use sqlx::PgPool;

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
            return Err(AppError::BadRequest(
                "Username must be at least 3 characters long".to_string(),
            ));
        }
        if password.len() < 8 {
            return Err(AppError::BadRequest(
                "Password must be at least 8 characters long".to_string(),
            ));
        }

        // Check if user already exists
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM app_user WHERE username = $1)")
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

        let token = generate_token(
            &user.username,
            &config.jwt_secret,
            config.jwt_expiration_secs,
        )?;
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

        let is_valid = bcrypt::verify(&payload.password, &user.password).unwrap_or(false);

        if !is_valid {
            return Err(AppError::Unauthorized(
                "Invalid username or password".to_string(),
            ));
        }

        let token = generate_token(
            &user.username,
            &config.jwt_secret,
            config.jwt_expiration_secs,
        )?;
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
        _config: &Config,
        crypto: &CryptoService,
        payload: ResetPasswordRequestDto,
    ) -> Result<UserResponseDto, AppError> {
        let username = payload.username.trim();
        if username.is_empty() {
            return Err(AppError::BadRequest("Username cannot be empty".to_string()));
        }

        let new_password = payload.new_password;
        if new_password.len() < 8 {
            return Err(AppError::BadRequest(
                "Password must be at least 8 characters long".to_string(),
            ));
        }

        // 1. Fetch user to verify credentials
        let user = sqlx::query_as::<_, AppUser>(
            "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token
             FROM app_user WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // 2. Verify identity:
        // Must either provide correct current_password OR correct discogs_token matching the user's stored token
        let verified_by_password = payload
            .current_password
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_some_and(|pw| bcrypt::verify(pw, &user.password).unwrap_or(false));

        let verified_by_discogs = payload
            .discogs_token
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_some_and(|provided| {
                user.discogs_token
                    .as_deref()
                    .and_then(|enc| crypto.decrypt(enc))
                    .is_some_and(|decrypted| decrypted == provided)
            });

        if !verified_by_password && !verified_by_discogs {
            return Err(AppError::Unauthorized(
                "Invalid verification credentials for password reset. A valid current password or matching Discogs verification token is required.".to_string(),
            ));
        }

        // 3. Hash new password
        let hashed_password = bcrypt::hash(&new_password, 10)
            .map_err(|e| AppError::Internal(format!("Failed to hash password: {e}")))?;

        // 4. Update password and optionally re-encrypt Discogs token
        let encrypted_token = payload
            .discogs_token
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .and_then(|t| crypto.encrypt(t.trim()))
            .or_else(|| user.discogs_token.clone());

        let updated_user = sqlx::query_as::<_, AppUser>(
            "UPDATE app_user
             SET password = $1, discogs_token = $2
             WHERE id = $3
             RETURNING id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token",
        )
        .bind(hashed_password)
        .bind(encrypted_token)
        .bind(user.id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;

        // Return user DTO without auto-login token to require explicit login
        Ok(updated_user.to_dto(None))
    }
}
