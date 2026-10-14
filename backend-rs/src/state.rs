use std::sync::Arc;
use sqlx::PgPool;
use crate::{config::Config, services::crypto_service::CryptoService};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub crypto: Arc<CryptoService>,
}

impl AppState {
    pub fn new(pool: PgPool, config: Config) -> Self {
        let password = config
            .encryption_password
            .clone()
            .unwrap_or_else(|| "changeit-for-production-use-23948239048".to_string());
        let salt = config
            .encryption_salt
            .clone()
            .unwrap_or_else(|| "5c074494c45680a7".to_string());

        let crypto = CryptoService::new(&password, &salt)
            .expect("Failed to initialize CryptoService with configured password and salt");

        Self {
            pool,
            config: Arc::new(config),
            crypto: Arc::new(crypto),
        }
    }
}
