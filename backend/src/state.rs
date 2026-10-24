use crate::{
    clients::{discogs::DiscogsClient, openrouter::OpenRouterClient},
    config::Config,
    services::{crypto_service::CryptoService, image_proxy::ImageProxyService, roon::RoonService},
};
use governor::{
    Quota, RateLimiter, clock::DefaultClock, middleware::NoOpMiddleware,
    state::keyed::DefaultKeyedStateStore,
};
use sqlx::PgPool;
use std::{net::IpAddr, num::NonZeroU32, sync::Arc};
use tokio::sync::Semaphore;

/// Label identifications running at the same time; each one holds a vision model request and
/// several Discogs calls, which share the 60 requests per minute.
const MAX_PARALLEL_IDENTIFICATIONS: usize = 2;

pub type AuthRateLimiter =
    RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock, NoOpMiddleware>;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub crypto: Arc<CryptoService>,
    pub discogs_client: Arc<DiscogsClient>,
    pub image_proxy: Arc<ImageProxyService>,
    pub roon: Arc<RoonService>,
    pub auth_rate_limiter: Arc<AuthRateLimiter>,
    pub openrouter: Arc<OpenRouterClient>,
    pub identify_slots: Arc<Semaphore>,
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

        let roon = RoonService::new();
        let openrouter = OpenRouterClient::new(config.openrouter_api_base_url.clone());

        let limit = NonZeroU32::new(config.auth_rate_limit_for_period)
            .unwrap_or_else(|| NonZeroU32::new(10).unwrap());
        let auth_rate_limiter = Arc::new(RateLimiter::keyed(Quota::per_minute(limit)));

        Self {
            pool,
            config: Arc::new(config),
            crypto: Arc::new(crypto),
            discogs_client: Arc::new(discogs_client),
            image_proxy: Arc::new(image_proxy),
            roon: Arc::new(roon),
            auth_rate_limiter,
            openrouter: Arc::new(openrouter),
            identify_slots: Arc::new(Semaphore::new(MAX_PARALLEL_IDENTIFICATIONS)),
        }
    }
}
