use std::sync::Arc;
use sqlx::PgPool;
use crate::{
    clients::discogs::DiscogsClient,
    config::Config,
    services::{crypto_service::CryptoService, image_proxy::ImageProxyService},
};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub crypto: Arc<CryptoService>,
    pub discogs_client: Arc<DiscogsClient>,
    pub image_proxy: Arc<ImageProxyService>,
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

        let discogs_client = DiscogsClient::with_base_url(
            config.discogs_api_base_url.clone(),
            config.discogs_user_agent.clone(),
        );

        let image_proxy = ImageProxyService::new(
            &config.image_proxy_allowed_hosts,
            config.discogs_user_agent.clone(),
        );

        Self {
            pool,
            config: Arc::new(config),
            crypto: Arc::new(crypto),
            discogs_client: Arc::new(discogs_client),
            image_proxy: Arc::new(image_proxy),
        }
    }
}
