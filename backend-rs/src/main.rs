use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use backend_rs::{
    config::Config,
    db::{init_pool, migrations::run_migrations},
    routes::create_app,
    state::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Initialize environment from .env if present
    dotenvy::dotenv().ok();

    // 2. Initialize Tracing Subscriber
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend_rs=info,tower_http=info,axum=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Vinyl Tracker Backend (Rust edition)...");

    // 3. Load configuration
    let config = Config::from_env();
    tracing::info!("Configured host: {}, port: {}", config.host, config.port);

    // 4. Run database migrations
    if let Err(e) = run_migrations(&config.database_url).await {
        tracing::error!("Migration failed: {e}");
        return Err(anyhow::anyhow!("Database migration failure: {e}"));
    }

    // 5. Initialize Database Pool
    let pool = init_pool(&config).await?;

    // 6. Assemble AppState and Router
    let state = AppState::new(pool, config.clone());
    let app = create_app(state);

    // 7. Bind and Serve
    let addr = SocketAddr::new(
        config.host.parse().unwrap_or_else(|_| [0, 0, 0, 0].into()),
        config.port,
    );
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Axum server successfully bound to http://{}", addr);

    axum::serve(listener, app).await?;
    Ok(())
}
