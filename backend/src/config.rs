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
    pub encryption_salt: Option<String>,
    pub discogs_user_agent: String,
    pub discogs_api_base_url: String,
    pub image_proxy_allowed_hosts: String,
    pub cors_allowed_origins: Vec<String>,
    pub cors_allow_credentials: bool,
}

impl Config {
    pub fn from_env() -> Self {
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

        Self {
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
        }
    }
}
