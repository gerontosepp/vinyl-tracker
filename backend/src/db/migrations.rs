use crate::error::AppError;
use sqlx::{
    PgConnection, PgPool,
    migrate::{Migrate, Migrator},
};
use std::collections::BTreeSet;

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Advisory lock key guarding the one-time baseline import (distinct from sqlx's own migration lock).
const BASELINE_LOCK_KEY: i64 = 0x5649_4E59_4C42_4153; // "VINYLBAS"

/// Runs all pending database migrations via `sqlx::migrate`.
///
/// On the first run against a database that was previously managed by refinery, Flyway or a
/// legacy Hibernate schema, the already applied versions are imported into `_sqlx_migrations`
/// so they are not executed again. The legacy history tables are left untouched.
pub async fn run_migrations(pool: &PgPool) -> Result<(), AppError> {
    let mut conn = pool.acquire().await?;

    // Concurrent `CREATE TABLE IF NOT EXISTS` can fail in PostgreSQL, so table creation
    // and the baseline import both happen while holding the advisory lock.
    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(BASELINE_LOCK_KEY)
        .execute(&mut *conn)
        .await?;
    let baseline_result = import_legacy_baseline(&mut conn).await;
    sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(BASELINE_LOCK_KEY)
        .execute(&mut *conn)
        .await?;
    baseline_result?;
    drop(conn);

    let applied_before = applied_versions(pool).await?;
    MIGRATOR
        .run(pool)
        .await
        .map_err(|e| AppError::Migration(format!("Migration failed: {e}")))?;
    let newly_applied: Vec<i64> = applied_versions(pool)
        .await?
        .difference(&applied_before)
        .copied()
        .collect();

    if newly_applied.is_empty() {
        tracing::info!("Database schema is up to date (no pending migrations).");
    } else {
        for version in newly_applied {
            tracing::info!("Applied migration V{version}");
        }
    }

    Ok(())
}

async fn applied_versions(pool: &PgPool) -> Result<BTreeSet<i64>, AppError> {
    let mut conn = pool.acquire().await?;
    let applied = conn
        .list_applied_migrations()
        .await
        .map_err(|e| AppError::Migration(format!("Failed to list applied migrations: {e}")))?;
    Ok(applied.into_iter().map(|m| m.version).collect())
}

async fn import_legacy_baseline(conn: &mut PgConnection) -> Result<(), AppError> {
    conn.ensure_migrations_table()
        .await
        .map_err(|e| AppError::Migration(format!("Failed to ensure _sqlx_migrations: {e}")))?;

    let already_tracked = conn
        .list_applied_migrations()
        .await
        .map_err(|e| AppError::Migration(format!("Failed to list applied migrations: {e}")))?;
    if !already_tracked.is_empty() {
        return Ok(());
    }

    let legacy_versions = detect_legacy_versions(conn).await?;
    if legacy_versions.is_empty() {
        return Ok(());
    }

    tracing::info!(
        "Importing legacy migration baseline into _sqlx_migrations: {legacy_versions:?}"
    );
    for migration in MIGRATOR
        .iter()
        .filter(|m| legacy_versions.contains(&m.version))
    {
        sqlx::query(
            "INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time)
             VALUES ($1, $2, TRUE, $3, 0)
             ON CONFLICT (version) DO NOTHING",
        )
        .bind(migration.version)
        .bind(migration.description.as_ref())
        .bind(migration.checksum.as_ref())
        .execute(&mut *conn)
        .await?;
    }

    Ok(())
}

/// Determines which migrations a database already contains, in order of reliability:
/// refinery history, Flyway history (Spring Boot era), or schema inspection.
pub async fn detect_legacy_versions(conn: &mut PgConnection) -> Result<BTreeSet<i64>, AppError> {
    if table_exists(conn, "refinery_schema_history").await? {
        let versions: Vec<i32> = sqlx::query_scalar("SELECT version FROM refinery_schema_history")
            .fetch_all(&mut *conn)
            .await?;
        if !versions.is_empty() {
            tracing::info!(
                "Found refinery_schema_history with {} entries.",
                versions.len()
            );
            return Ok(versions.into_iter().map(i64::from).collect());
        }
    }

    if table_exists(conn, "flyway_schema_history").await? {
        let versions: Vec<Option<String>> =
            sqlx::query_scalar("SELECT version FROM flyway_schema_history WHERE success = true")
                .fetch_all(&mut *conn)
                .await?;
        let parsed: BTreeSet<i64> = versions
            .into_iter()
            .flatten()
            .filter_map(|v| v.parse().ok())
            .collect();
        if !parsed.is_empty() {
            tracing::info!("Found flyway_schema_history with versions {parsed:?}.");
            return Ok(parsed);
        }
    }

    if !table_exists(conn, "app_user").await? {
        return Ok(BTreeSet::new());
    }

    tracing::info!("Detected existing schema without migration history. Analyzing baseline...");
    let mut versions = BTreeSet::from([1]);
    if index_exists(conn, "idx_record_cache_discogs").await? {
        versions.insert(2);
    }
    if column_exists(conn, "record_cache", "lowest_price").await? {
        versions.insert(3);
    }
    if column_exists(conn, "record_cache", "format").await? {
        versions.insert(4);
    }
    if !column_exists(conn, "app_user", "salt").await? {
        versions.insert(5);
    }
    if column_exists(conn, "app_user", "roon_host").await? {
        versions.insert(6);
        versions.insert(7); // V7 format update shipped in the same release as V6
    }
    if column_exists(conn, "collection_item", "media_condition").await? {
        versions.insert(8);
    }
    if column_exists(conn, "record_cache", "median_price").await? {
        versions.insert(9);
    }
    tracing::info!("Detected existing schema versions: {versions:?}");
    Ok(versions)
}

async fn table_exists(conn: &mut PgConnection, table: &str) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT FROM information_schema.tables
                        WHERE table_schema = current_schema() AND table_name = $1)",
    )
    .bind(table)
    .fetch_one(&mut *conn)
    .await?)
}

async fn index_exists(conn: &mut PgConnection, index: &str) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT FROM pg_indexes
                        WHERE schemaname = current_schema() AND indexname = $1)",
    )
    .bind(index)
    .fetch_one(&mut *conn)
    .await?)
}

async fn column_exists(
    conn: &mut PgConnection,
    table: &str,
    column: &str,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2)",
    )
    .bind(table)
    .bind(column)
    .fetch_one(&mut *conn)
    .await?)
}
