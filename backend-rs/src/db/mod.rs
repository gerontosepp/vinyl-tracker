pub mod migrations;

use std::time::Duration;
use sqlx::{postgres::PgPoolOptions, PgPool};
use crate::{config::Config, error::AppError};

pub async fn init_pool(config: &Config) -> Result<PgPool, AppError> {
    tracing::info!(
        "Initializing PostgreSQL connection pool (max: {}, min: {})...",
        config.database_max_connections,
        config.database_min_connections
    );

    let pool = PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .min_connections(config.database_min_connections)
        .acquire_timeout(Duration::from_secs(config.database_acquire_timeout_secs))
        .idle_timeout(Duration::from_secs(config.database_idle_timeout_secs))
        .connect(&config.database_url)
        .await
        .map_err(|e| AppError::Database(e))?;

    // Verify connectivity with a quick ping
    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to ping PostgreSQL database: {e}");
            AppError::Database(e)
        })?;

    tracing::info!("PostgreSQL connection pool initialized and verified successfully.");
    Ok(pool)
}
