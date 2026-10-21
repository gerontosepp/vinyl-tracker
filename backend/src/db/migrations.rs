use crate::error::AppError;
use sqlx::{
    PgPool,
    migrate::{Migrate, Migrator},
};
use std::collections::BTreeSet;

pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Advisory lock key guarding the creation of `_sqlx_migrations` (distinct from sqlx's own migration lock).
const MIGRATIONS_TABLE_LOCK_KEY: i64 = 0x5649_4E59_4C42_4153; // "VINYLBAS"

/// Runs all pending database migrations via `sqlx::migrate`.
pub async fn run_migrations(pool: &PgPool) -> Result<(), AppError> {
    let mut conn = pool.acquire().await?;

    // Concurrent `CREATE TABLE IF NOT EXISTS` can fail in PostgreSQL, so the table is created
    // while holding the advisory lock.
    sqlx::query("SELECT pg_advisory_lock($1)")
        .bind(MIGRATIONS_TABLE_LOCK_KEY)
        .execute(&mut *conn)
        .await?;
    let ensure_result = conn
        .ensure_migrations_table()
        .await
        .map_err(|e| AppError::Migration(format!("Failed to ensure _sqlx_migrations: {e}")));
    sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(MIGRATIONS_TABLE_LOCK_KEY)
        .execute(&mut *conn)
        .await?;
    ensure_result?;
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
