pub mod migrations;

use crate::{config::Config, error::AppError};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::time::Duration;

/// Returns a sanitized database connection URL with the password masked.
pub fn sanitize_db_url(raw_url: &str) -> String {
    if let Ok(mut parsed) = url::Url::parse(raw_url) {
        if parsed.password().is_some() {
            let _ = parsed.set_password(Some("****"));
        }
        parsed.to_string()
    } else {
        "<invalid-database-url>".to_string()
    }
}

pub async fn init_pool(config: &Config) -> Result<PgPool, AppError> {
    let sanitized_url = sanitize_db_url(&config.database_url);
    tracing::info!(
        "Initializing PostgreSQL connection pool at {sanitized_url} (max: {}, min: {})...",
        config.database_max_connections,
        config.database_min_connections
    );

    let max_retries: u32 = std::env::var("DATABASE_CONNECT_RETRIES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(15);
    let retry_delay_secs: u64 = std::env::var("DATABASE_CONNECT_RETRY_INTERVAL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2);

    let mut attempt: u32 = 0;
    let pool = loop {
        attempt += 1;
        let result = PgPoolOptions::new()
            .max_connections(config.database_max_connections)
            .min_connections(config.database_min_connections)
            .acquire_timeout(Duration::from_secs(config.database_acquire_timeout_secs))
            .idle_timeout(Duration::from_secs(config.database_idle_timeout_secs))
            .connect(&config.database_url)
            .await;
        match result {
            Ok(pool) => break pool,
            Err(e) if attempt < max_retries => {
                tracing::warn!(
                    "Failed to connect to database at {sanitized_url} (attempt {attempt}/{max_retries}): {e}. Retrying in {retry_delay_secs}s..."
                );
                tokio::time::sleep(Duration::from_secs(retry_delay_secs)).await;
            }
            Err(e) => {
                tracing::error!(
                    "Failed to connect connection pool to database at {sanitized_url} after {attempt} attempts: {e}"
                );
                return Err(AppError::Database(e));
            }
        }
    };

    // Verify connectivity with a quick ping
    sqlx::query("SELECT 1").execute(&pool).await.map_err(|e| {
        tracing::error!("Failed to ping PostgreSQL database at {sanitized_url}: {e}");
        AppError::Database(e)
    })?;

    tracing::info!("PostgreSQL connection pool initialized and verified successfully.");
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_db_url_masks_password() {
        let raw = "postgres://vinyl_user:secret_password_123@postgres:5432/vinyl_tracker";
        let sanitized = sanitize_db_url(raw);
        assert_eq!(
            sanitized,
            "postgres://vinyl_user:****@postgres:5432/vinyl_tracker"
        );
        assert!(!sanitized.contains("secret_password_123"));
    }

    #[test]
    fn test_sanitize_db_url_without_password() {
        let raw = "postgres://postgres:5432/vinyl_tracker";
        let sanitized = sanitize_db_url(raw);
        assert_eq!(sanitized, "postgres://postgres:5432/vinyl_tracker");
    }

    #[test]
    fn test_sanitize_db_url_invalid_format() {
        let raw = "not_a_valid_url";
        let sanitized = sanitize_db_url(raw);
        assert_eq!(sanitized, "<invalid-database-url>");
    }
}
