use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub database_max_connections: u32,
    pub database_min_connections: u32,
    pub database_acquire_timeout_secs: u64,
    pub database_idle_timeout_secs: u64,
    pub jwt_secret: String,
    pub jwt_expiration_secs: u64,
    pub encryption_password: Option<String>,
    pub app_env: String,
    pub encryption_salt: Option<String>,
    pub discogs_user_agent: String,
    pub discogs_api_base_url: String,
    pub image_proxy_allowed_hosts: String,
    pub cors_allowed_origins: Vec<String>,
    pub cors_allow_credentials: bool,
    pub auth_cookie_name: String,
    pub auth_cookie_max_age_secs: u64,
    pub auth_cookie_secure: bool,
    pub auth_cookie_same_site: String,
    pub auth_cookie_path: String,
    pub auth_cookie_domain: Option<String>,
    pub auth_rate_limit_for_period: u32,
}

impl Config {
    pub fn from_env() -> Self {
        let app_env = env::var("APP_ENV")
            .or_else(|_| env::var("ENVIRONMENT"))
            .unwrap_or_else(|_| "development".to_string());

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8080);

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            let db_user = env::var("POSTGRES_USER").unwrap_or_else(|_| "vinyl_user".to_string());
            let db_pass =
                env::var("POSTGRES_PASSWORD").unwrap_or_else(|_| "vinyl_password".to_string());
            let db_name = env::var("POSTGRES_DB").unwrap_or_else(|_| "vinyl_tracker".to_string());
            let db_host = env::var("POSTGRES_HOST").unwrap_or_else(|_| "localhost".to_string());
            let db_port = env::var("POSTGRES_PORT").unwrap_or_else(|_| "5432".to_string());
            format!("postgres://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}")
        });

        let database_max_connections = env::var("DATABASE_MAX_CONNECTIONS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(20);

        let database_min_connections = env::var("DATABASE_MIN_CONNECTIONS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);

        let database_acquire_timeout_secs = env::var("DATABASE_ACQUIRE_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);

        let database_idle_timeout_secs = env::var("DATABASE_IDLE_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(600);

        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "superSecretDevelopmentKeyDoNotUseInProduction123!".to_string());

        let jwt_expiration_secs = env::var("JWT_EXPIRATION_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(604800); // 7 days

        let encryption_password = env::var("VINYL_ENCRYPTION_PASSWORD").ok();
        let encryption_salt = env::var("VINYL_ENCRYPTION_SALT").ok();

        let discogs_user_agent = env::var("DISCOGS_USER_AGENT").unwrap_or_else(|_| {
            "VinylTracker/1.0 (+https://github.com/gerontosepp/vinyl-tracker)".to_string()
        });

        let discogs_api_base_url = env::var("DISCOGS_API_BASE_URL")
            .unwrap_or_else(|_| "https://api.discogs.com".to_string());

        let image_proxy_allowed_hosts = env::var("IMAGE_PROXY_ALLOWED_HOSTS")
            .unwrap_or_else(|_| "i.discogs.com,s.discogs.com,api.discogs.com".to_string());

        let cors_origins_raw = env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| {
            "http://localhost:5173,https://localhost:5173,http://localhost:3000,http://127.0.0.1:5173".to_string()
        });

        let cors_allowed_origins = cors_origins_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let cors_allow_credentials = env::var("CORS_ALLOW_CREDENTIALS")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(true);

        let auth_cookie_name =
            env::var("AUTH_COOKIE_NAME").unwrap_or_else(|_| "vinyl_token".to_string());

        let auth_cookie_max_age_secs = env::var("AUTH_COOKIE_MAX_AGE_SECONDS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(86400);

        let is_prod = app_env.eq_ignore_ascii_case("production");
        let auth_cookie_secure = env::var("AUTH_COOKIE_SECURE")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(is_prod);

        let auth_cookie_same_site =
            env::var("AUTH_COOKIE_SAME_SITE").unwrap_or_else(|_| "Lax".to_string());

        let auth_cookie_path = env::var("AUTH_COOKIE_PATH").unwrap_or_else(|_| "/".to_string());

        let auth_cookie_domain = env::var("AUTH_COOKIE_DOMAIN")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let auth_rate_limit_for_period = env::var("AUTH_RATE_LIMIT_FOR_PERIOD")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10);

        Self {
            app_env,
            host,
            port,
            database_url,
            database_max_connections,
            database_min_connections,
            database_acquire_timeout_secs,
            database_idle_timeout_secs,
            jwt_secret,
            jwt_expiration_secs,
            encryption_password,
            encryption_salt,
            discogs_user_agent,
            discogs_api_base_url,
            image_proxy_allowed_hosts,
            cors_allowed_origins,
            cors_allow_credentials,
            auth_cookie_name,
            auth_cookie_max_age_secs,
            auth_cookie_secure,
            auth_cookie_same_site,
            auth_cookie_path,
            auth_cookie_domain,
            auth_rate_limit_for_period,
        }
    }

    /// Validates application configuration.
    /// - `JWT_SECRET` must be at least 32 characters long.
    /// - In production mode (`APP_ENV=production`), the insecure development default key is disallowed.
    pub fn validate(&self) -> Result<(), String> {
        if self.jwt_secret.trim().len() < 32 {
            return Err(format!(
                "JWT_SECRET is invalid: must be at least 32 characters long (current length: {}).",
                self.jwt_secret.trim().len()
            ));
        }

        if self.app_env.eq_ignore_ascii_case("production")
            && self.jwt_secret == "superSecretDevelopmentKeyDoNotUseInProduction123!"
        {
            return Err("JWT_SECRET is using the insecure default key in production mode. A secure, randomly generated key with at least 32 characters is required.".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config(secret: &str, app_env: &str) -> Config {
        let mut config = Config::from_env();
        config.jwt_secret = secret.to_string();
        config.app_env = app_env.to_string();
        config
    }

    #[test]
    fn test_valid_jwt_secret_passes() {
        let config = create_test_config(
            "a_valid_and_sufficiently_long_jwt_secret_32_chars!",
            "development",
        );
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_short_jwt_secret_fails_validation() {
        let config = create_test_config("too_short_secret", "development");
        let err = config.validate().unwrap_err();
        assert!(err.contains("at least 32 characters"));
    }

    #[test]
    fn test_default_jwt_secret_rejected_in_production() {
        let config = create_test_config(
            "superSecretDevelopmentKeyDoNotUseInProduction123!",
            "production",
        );
        let err = config.validate().unwrap_err();
        assert!(err.contains("insecure default key in production mode"));
    }

    #[test]
    fn test_custom_jwt_secret_accepted_in_production() {
        let config = create_test_config(
            "customProductionSecretWithAtLeast32CharactersHere!",
            "production",
        );
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_default_jwt_secret_accepted_in_development() {
        let config = create_test_config(
            "superSecretDevelopmentKeyDoNotUseInProduction123!",
            "development",
        );
        assert!(config.validate().is_ok());
    }
}
