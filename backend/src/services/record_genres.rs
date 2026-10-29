//! Writes the genres of a cached record. `record_genres` is unique per record and genre (migration
//! `16`), and both functions are single idempotent statements, so concurrent writers cannot store
//! a genre twice.

use crate::error::AppError;
use sqlx::PgExecutor;

/// Makes the genres of the record exactly `genres`: removes the others, adds the missing ones.
pub async fn replace_genres<'e>(
    executor: impl PgExecutor<'e>,
    record_id: i64,
    genres: &[String],
) -> Result<(), AppError> {
    sqlx::query(
        "WITH removed AS (
             DELETE FROM record_genres WHERE record_id = $1 AND genre <> ALL($2::varchar[])
         )
         INSERT INTO record_genres (record_id, genre)
         SELECT $1, genre FROM UNNEST($2::varchar[]) AS genre
         ON CONFLICT DO NOTHING",
    )
    .bind(record_id)
    .bind(genres)
    .execute(executor)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Adds the genres the record does not have yet and keeps the existing ones.
pub async fn add_genres<'e>(
    executor: impl PgExecutor<'e>,
    record_id: i64,
    genres: &[String],
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO record_genres (record_id, genre)
         SELECT $1, genre FROM UNNEST($2::varchar[]) AS genre
         ON CONFLICT DO NOTHING",
    )
    .bind(record_id)
    .bind(genres)
    .execute(executor)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}
