//! Writes the genres of a cached record. `record_genres` is unique per record and genre (migration
//! `16`), and both functions are single idempotent statements, so concurrent writers cannot store
//! a genre twice. The genres are inserted deduplicated and in a fixed order, so concurrent writers
//! of the same record take their locks on the unique index in the same order and cannot deadlock.

use crate::error::AppError;
use sqlx::PgExecutor;

/// Inserts the genres in `$2` for the record in `$1` that it does not have yet.
macro_rules! insert_missing_genres_sql {
    () => {
        "INSERT INTO record_genres (record_id, genre)
         SELECT $1, genre FROM (
             SELECT genre FROM UNNEST($2::varchar[]) AS genre GROUP BY genre ORDER BY genre COLLATE \"C\"
         ) AS genres
         ON CONFLICT DO NOTHING"
    };
}

/// Makes the genres of the record exactly `genres`: removes the others, adds the missing ones.
pub async fn replace_genres<'e>(
    executor: impl PgExecutor<'e>,
    record_id: i64,
    genres: &[String],
) -> Result<(), AppError> {
    sqlx::query(concat!(
        "WITH removed AS (
             DELETE FROM record_genres WHERE record_id = $1 AND genre <> ALL($2::varchar[])
         ) ",
        insert_missing_genres_sql!()
    ))
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
    sqlx::query(insert_missing_genres_sql!())
        .bind(record_id)
        .bind(genres)
        .execute(executor)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}
