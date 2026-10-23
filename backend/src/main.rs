use backend_rs::{
    config::Config,
    db::{init_pool, migrations::run_migrations},
    routes::create_app,
    services::label_photo_service::LabelPhotoService,
    state::AppState,
};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

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
    if let Err(e) = config.validate() {
        tracing::error!("Configuration validation failed: {e}");
        return Err(anyhow::anyhow!("Configuration validation failed: {e}"));
    }
    tracing::info!("Configured host: {}, port: {}", config.host, config.port);
    tracing::info!(
        "Database target: {}",
        backend_rs::db::sanitize_db_url(&config.database_url)
    );

    // 4. Initialize Database Pool
    let pool = init_pool(&config).await?;

    // 5. Run database migrations
    if let Err(e) = run_migrations(&pool).await {
        tracing::error!("Migration failed: {e}");
        return Err(anyhow::anyhow!("Database migration failure: {e}"));
    }

    // Identifications cut off by the restart are reported as errors the user can retry
    match LabelPhotoService::fail_interrupted_identifications(&pool).await {
        Ok(0) => {}
        Ok(n) => tracing::warn!("{n} interrupted label identification(s) marked as failed"),
        Err(e) => tracing::error!("Failed to reset interrupted label identifications: {e}"),
    }

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

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    tracing::info!("Server shut down gracefully");
    Ok(())
}

/// Resolves on Ctrl+C or SIGTERM (sent by `docker stop`), letting in-flight requests finish.
async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::error!("Failed to install Ctrl+C handler: {e}");
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(e) => {
                tracing::error!("Failed to install SIGTERM handler: {e}");
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    tracing::info!("Shutdown signal received, draining in-flight requests...");
}
