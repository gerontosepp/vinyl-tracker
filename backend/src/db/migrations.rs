use std::collections::HashSet;
use chrono::Utc;
use refinery::embed_migrations;
use tokio_postgres::NoTls;
use crate::error::AppError;

embed_migrations!("migrations");

/// Runs all database migrations, ensuring full compatibility with existing
/// databases (both Flyway-managed and legacy Hibernate-created schemas).
pub async fn run_migrations(database_url: &str) -> Result<(), AppError> {
    tracing::info!("Connecting to database for schema migration check...");

    let (mut client, connection) = tokio_postgres::connect(database_url, NoTls)
        .await
        .map_err(|e| AppError::Migration(format!("Failed to connect to database for migrations: {e}")))?;

    // Spawn the connection driver in the background
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            tracing::error!("PostgreSQL migration connection error: {e}");
        }
    });

    // Ensure refinery_schema_history table exists
    client
        .execute(
            "CREATE TABLE IF NOT EXISTS refinery_schema_history (
                version INT4 PRIMARY KEY,
                name VARCHAR(255),
                applied_on VARCHAR(255),
                checksum VARCHAR(255)
            );",
            &[],
        )
        .await
        .map_err(|e| AppError::Migration(format!("Failed to ensure refinery_schema_history: {e}")))?;

    let mut applied_versions: HashSet<i32> = HashSet::new();

    // 1. Check if flyway_schema_history exists
    let flyway_exists: bool = client
        .query_one(
            "SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'flyway_schema_history'
            );",
            &[],
        )
        .await
        .map(|row| row.get(0))
        .unwrap_or(false);

    if flyway_exists {
        tracing::info!("Found existing 'flyway_schema_history' table. Synchronizing Flyway migration state...");
        let rows = client
            .query(
                "SELECT version FROM flyway_schema_history WHERE success = true;",
                &[],
            )
            .await
            .map_err(|e| AppError::Migration(format!("Failed to query flyway_schema_history: {e}")))?;

        for row in rows {
            let ver_str: String = row.get(0);
            if let Ok(ver) = ver_str.parse::<i32>() {
                applied_versions.insert(ver);
            }
        }
    } else {
        // 2. Fallback check for existing tables (e.g. from Hibernate or pre-existing setups)
        let app_user_exists: bool = client
            .query_one(
                "SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'app_user'
                );",
                &[],
            )
            .await
            .map(|row| row.get(0))
            .unwrap_or(false);

        if app_user_exists {
            tracing::info!("Detected existing schema without Flyway history. Analyzing baseline version...");
            // V1: app_user exists
            applied_versions.insert(1);

            // V2: indexes exist
            let idx_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM pg_indexes 
                        WHERE indexname = 'idx_record_cache_discogs'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if idx_exists {
                applied_versions.insert(2);
            }

            // V3: lowest_price column in record_cache
            let lowest_price_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'record_cache' AND column_name = 'lowest_price'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if lowest_price_exists {
                applied_versions.insert(3);
            }

            // V4: format column in record_cache
            let format_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'record_cache' AND column_name = 'format'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if format_exists {
                applied_versions.insert(4);
            }

            // V5: salt column dropped from app_user
            let salt_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'app_user' AND column_name = 'salt'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if !salt_exists {
                applied_versions.insert(5);
            }

            // V6: roon_host column in app_user
            let roon_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'app_user' AND column_name = 'roon_host'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if roon_exists {
                applied_versions.insert(6);
                applied_versions.insert(7); // V7 format update belongs to same release
            }

            // V8: media_condition column in collection_item
            let media_cond_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'collection_item' AND column_name = 'media_condition'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if media_cond_exists {
                applied_versions.insert(8);
            }

            // V9: median_price column in record_cache
            let median_price_exists: bool = client
                .query_one(
                    "SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = 'record_cache' AND column_name = 'median_price'
                    );",
                    &[],
                )
                .await
                .map(|row| row.get(0))
                .unwrap_or(false);
            if median_price_exists {
                applied_versions.insert(9);
            }

            tracing::info!("Detected existing schema versions: {:?}", applied_versions);
        }
    }

    // Populate refinery_schema_history for all detected applied versions
    let runner = migrations::runner();
    let now_str = Utc::now().to_rfc3339();

    for m in runner.get_migrations() {
        let ver = m.version() as i32;
        if applied_versions.contains(&ver) {
            let name = m.name();
            let checksum = m.checksum().to_string();
            client
                .execute(
                    "INSERT INTO refinery_schema_history (version, name, applied_on, checksum)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (version) DO NOTHING;",
                    &[&ver, &name, &now_str, &checksum],
                )
                .await
                .map_err(|e| AppError::Migration(format!("Failed to record migration {ver}: {e}")))?;
        }
    }

    // 3. Execute pending refinery migrations
    let report = runner
        .run_async(&mut client)
        .await
        .map_err(|e| AppError::Migration(format!("Refinery migration failed: {e}")))?;

    let applied = report.applied_migrations();
    if applied.is_empty() {
        tracing::info!("Database schema is up to date (no pending migrations).");
    } else {
        for m in applied {
            tracing::info!("Applied migration V{}__{}", m.version(), m.name());
        }
    }

    Ok(())
}
