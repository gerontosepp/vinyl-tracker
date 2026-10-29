//! Storage configuration in the JSON backup: types, shelves and compartment boundaries.

use super::config::{validate_grid, validate_name};
use crate::{
    error::AppError,
    models::storage::{
        StorageBackup, StorageBackupBoundary, StorageBackupType, StorageBackupUnit, StorageMedia,
    },
};
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::collections::{HashMap, HashSet};

pub struct StorageBackupService;

impl StorageBackupService {
    /// Storage configuration of the user, `None` without storage types.
    pub async fn export(pool: &PgPool, user_id: i64) -> Result<Option<StorageBackup>, AppError> {
        let types: Vec<StorageBackupType> = sqlx::query(
            "SELECT name, media, grid_rows, grid_columns, capacity
             FROM storage_type WHERE user_id = $1 ORDER BY media DESC, name",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row| StorageBackupType {
            name: row.get("name"),
            media: row.get("media"),
            rows: i32::from(row.get::<i16, _>("grid_rows")),
            columns: i32::from(row.get::<i16, _>("grid_columns")),
            capacity: row.get("capacity"),
        })
        .collect();
        if types.is_empty() {
            return Ok(None);
        }

        let mut boundaries: HashMap<i64, Vec<StorageBackupBoundary>> = HashMap::new();
        for row in sqlx::query(
            "SELECT sb.unit_id, sb.compartment, sb.artist_key, sb.year_key, sb.title_key,
                    sb.instance_id
             FROM storage_boundary sb
             JOIN storage_unit su ON su.id = sb.unit_id
             WHERE su.user_id = $1
             ORDER BY sb.unit_id, sb.compartment",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
        {
            boundaries
                .entry(row.get("unit_id"))
                .or_default()
                .push(StorageBackupBoundary {
                    compartment: i32::from(row.get::<i16, _>("compartment")),
                    artist_key: row.get("artist_key"),
                    year_key: row.get("year_key"),
                    title_key: row.get("title_key"),
                    instance_id: row.get("instance_id"),
                });
        }

        let units: Vec<StorageBackupUnit> = sqlx::query(
            "SELECT su.id, su.name, st.name AS type_name
             FROM storage_unit su
             JOIN storage_type st ON st.id = su.type_id
             WHERE su.user_id = $1
             ORDER BY st.media DESC, su.sort_order, su.id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row| StorageBackupUnit {
            name: row.get("name"),
            type_name: row.get("type_name"),
            boundaries: boundaries.remove(&row.get("id")).unwrap_or_default(),
        })
        .collect();

        tracing::debug!(
            "Exported storage backup of user {user_id}: {} type(s), {} shelf/shelves",
            types.len(),
            units.len()
        );
        Ok(Some(StorageBackup { types, units }))
    }

    /// Validates the storage section of a backup; the error text describes the first problem.
    pub fn validate(backup: &StorageBackup) -> Result<(), String> {
        let message = |err: AppError| match err {
            AppError::BadRequest(detail) => detail,
            other => other.to_string(),
        };
        let mut grids: HashMap<&str, i32> = HashMap::new();
        for storage_type in &backup.types {
            validate_name(&storage_type.name)
                .map_err(|e| format!("storage type: {}", message(e)))?;
            if StorageMedia::parse(&storage_type.media).is_none() {
                return Err(format!(
                    "storage type '{}': unknown media '{}'",
                    storage_type.name, storage_type.media
                ));
            }
            validate_grid(
                storage_type.rows,
                storage_type.columns,
                storage_type.capacity,
            )
            .map_err(|e| format!("storage type '{}': {}", storage_type.name, message(e)))?;
            grids.insert(
                storage_type.name.trim(),
                storage_type.rows * storage_type.columns,
            );
        }
        for unit in &backup.units {
            validate_name(&unit.name).map_err(|e| format!("shelf: {}", message(e)))?;
            let compartments = grids.get(unit.type_name.trim()).ok_or_else(|| {
                format!(
                    "shelf '{}': unknown storage type '{}'",
                    unit.name, unit.type_name
                )
            })?;
            if let Some(boundary) = unit
                .boundaries
                .iter()
                .find(|b| !(1..=*compartments).contains(&b.compartment))
            {
                return Err(format!(
                    "shelf '{}': invalid compartment {}",
                    unit.name, boundary.compartment
                ));
            }
        }
        Ok(())
    }

    /// Creates missing types and shelves by name; existing ones stay unchanged. Boundaries are
    /// only restored for media that had no shelves before, so existing layouts keep theirs.
    pub async fn restore(
        tx: &mut Transaction<'_, Postgres>,
        user_id: i64,
        backup: &StorageBackup,
    ) -> Result<(), AppError> {
        let media_with_shelves: HashSet<String> = sqlx::query_scalar(
            "SELECT DISTINCT st.media FROM storage_unit su
             JOIN storage_type st ON st.id = su.type_id
             WHERE su.user_id = $1",
        )
        .bind(user_id)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .collect();

        tracing::debug!(
            "Restoring storage backup of user {user_id}: {} type(s), {} shelf/shelves",
            backup.types.len(),
            backup.units.len()
        );
        for storage_type in &backup.types {
            sqlx::query(
                "INSERT INTO storage_type (user_id, name, media, grid_rows, grid_columns, capacity)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, name) DO NOTHING",
            )
            .bind(user_id)
            .bind(storage_type.name.trim())
            .bind(&storage_type.media)
            .bind(storage_type.rows as i16)
            .bind(storage_type.columns as i16)
            .bind(storage_type.capacity)
            .execute(&mut **tx)
            .await?;
        }

        // The user's types by name: (id, media, compartments)
        let types: HashMap<String, (i64, String, i32)> = sqlx::query(
            "SELECT id, name, media, grid_rows, grid_columns FROM storage_type WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|row| {
            let compartments = i32::from(row.get::<i16, _>("grid_rows"))
                * i32::from(row.get::<i16, _>("grid_columns"));
            (
                row.get("name"),
                (row.get("id"), row.get("media"), compartments),
            )
        })
        .collect();

        for unit in &backup.units {
            let Some((type_id, media, compartments)) = types.get(unit.type_name.trim()) else {
                continue;
            };
            let unit_id: Option<i64> = sqlx::query_scalar(
                "INSERT INTO storage_unit (user_id, type_id, name, sort_order)
                 VALUES ($1, $2, $3, (
                     SELECT COALESCE(MAX(su.sort_order), 0) + 1
                     FROM storage_unit su JOIN storage_type st ON st.id = su.type_id
                     WHERE su.user_id = $1 AND st.media = $4))
                 ON CONFLICT (user_id, name) DO NOTHING
                 RETURNING id",
            )
            .bind(user_id)
            .bind(type_id)
            .bind(unit.name.trim())
            .bind(media)
            .fetch_optional(&mut **tx)
            .await?;
            let Some(unit_id) = unit_id else {
                continue;
            };
            if media_with_shelves.contains(media) {
                continue;
            }
            for boundary in unit
                .boundaries
                .iter()
                .filter(|b| b.compartment <= *compartments)
            {
                sqlx::query(
                    "INSERT INTO storage_boundary
                         (unit_id, compartment, artist_key, year_key, title_key, instance_id)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT DO NOTHING",
                )
                .bind(unit_id)
                .bind(boundary.compartment as i16)
                .bind(&boundary.artist_key)
                .bind(&boundary.year_key)
                .bind(&boundary.title_key)
                .bind(boundary.instance_id)
                .execute(&mut **tx)
                .await?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn backup() -> StorageBackup {
        StorageBackup {
            types: vec![StorageBackupType {
                name: "Kallax 2×2".into(),
                media: "vinyl".into(),
                rows: 2,
                columns: 2,
                capacity: 70,
            }],
            units: vec![StorageBackupUnit {
                name: "Kallax-1".into(),
                type_name: "Kallax 2×2".into(),
                boundaries: vec![StorageBackupBoundary {
                    compartment: 2,
                    artist_key: Some("beatles".into()),
                    year_key: Some("1969".into()),
                    title_key: "abbey road".into(),
                    instance_id: 7,
                }],
            }],
        }
    }

    #[test]
    fn test_validate_accepts_valid_backup() {
        assert_eq!(StorageBackupService::validate(&backup()), Ok(()));
        assert_eq!(
            StorageBackupService::validate(&StorageBackup::default()),
            Ok(())
        );
    }

    #[test]
    fn test_validate_rejects_invalid_entries() {
        type Mutation = fn(&mut StorageBackup);
        let cases: Vec<(Mutation, &str)> = vec![
            (|b| b.types[0].name = " ".into(), "Name must be"),
            (|b| b.types[0].media = "tape".into(), "unknown media 'tape'"),
            (|b| b.types[0].rows = 13, "between 1 and 12"),
            (|b| b.types[0].capacity = 0, "between 1 and 500"),
            (
                |b| b.units[0].type_name = "Billy".into(),
                "unknown storage type 'Billy'",
            ),
            (
                |b| b.units[0].boundaries[0].compartment = 5,
                "invalid compartment 5",
            ),
        ];
        for (mutate, expected) in cases {
            let mut value = backup();
            mutate(&mut value);
            let error = StorageBackupService::validate(&value).unwrap_err();
            assert!(error.contains(expected), "{error}");
        }
    }
}
