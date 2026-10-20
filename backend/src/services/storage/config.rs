//! Storage types and shelves of a user. Changes that alter the compartments of a medium
//! (shelf added/removed/reordered, grid changed) redistribute that medium automatically.

use super::StorageService;
use crate::{
    error::AppError,
    models::storage::{
        CreateStorageTypeRequest, ReorderStorageUnitsRequest, StorageMedia, StorageTypeDto,
        StorageTypesDto, StorageUnitDto, StorageUnitRequest, StorageUnitsDto,
        UpdateStorageTypeRequest,
    },
};
use sqlx::{PgPool, Row};
use std::collections::HashSet;

const MAX_NAME_LENGTH: usize = 100;
const GRID_RANGE: std::ops::RangeInclusive<i32> = 1..=12;
const CAPACITY_RANGE: std::ops::RangeInclusive<i32> = 1..=500;

pub(super) fn validate_name(name: &str) -> Result<String, AppError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > MAX_NAME_LENGTH {
        return Err(AppError::BadRequest(format!(
            "Name must be 1–{MAX_NAME_LENGTH} characters long"
        )));
    }
    Ok(name.to_string())
}

pub(super) fn validate_grid(rows: i32, columns: i32, capacity: i32) -> Result<(), AppError> {
    if !GRID_RANGE.contains(&rows) || !GRID_RANGE.contains(&columns) {
        return Err(AppError::BadRequest(
            "Rows and columns must be between 1 and 12".to_string(),
        ));
    }
    if !CAPACITY_RANGE.contains(&capacity) {
        return Err(AppError::BadRequest(
            "Capacity must be between 1 and 500 discs per compartment".to_string(),
        ));
    }
    Ok(())
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    matches!(err, sqlx::Error::Database(db) if db.code().as_deref() == Some("23505"))
}

fn parse_media(value: &str) -> StorageMedia {
    StorageMedia::parse(value).unwrap_or(StorageMedia::Vinyl)
}

pub struct StorageConfigService;

impl StorageConfigService {
    pub async fn list_types(pool: &PgPool, user_id: i64) -> Result<Vec<StorageTypeDto>, AppError> {
        let rows = sqlx::query(
            "SELECT st.id, st.name, st.media, st.grid_rows, st.grid_columns, st.capacity,
                    (SELECT COUNT(*) FROM storage_unit su WHERE su.type_id = st.id) AS unit_count
             FROM storage_type st
             WHERE st.user_id = $1
             ORDER BY st.media DESC, st.name",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| StorageTypeDto {
                id: row.get("id"),
                name: row.get("name"),
                media: parse_media(row.get("media")),
                rows: i32::from(row.get::<i16, _>("grid_rows")),
                columns: i32::from(row.get::<i16, _>("grid_columns")),
                capacity: row.get("capacity"),
                unit_count: row.get("unit_count"),
            })
            .collect())
    }

    async fn types_result(
        pool: &PgPool,
        user_id: i64,
        redistributed: Vec<StorageMedia>,
    ) -> Result<StorageTypesDto, AppError> {
        Ok(StorageTypesDto {
            types: Self::list_types(pool, user_id).await?,
            redistributed,
        })
    }

    pub async fn create_type(
        pool: &PgPool,
        user_id: i64,
        req: CreateStorageTypeRequest,
    ) -> Result<StorageTypesDto, AppError> {
        let name = validate_name(&req.name)?;
        validate_grid(req.rows, req.columns, req.capacity)?;
        sqlx::query(
            "INSERT INTO storage_type (user_id, name, media, grid_rows, grid_columns, capacity)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(user_id)
        .bind(&name)
        .bind(req.media.as_str())
        .bind(req.rows as i16)
        .bind(req.columns as i16)
        .bind(req.capacity)
        .execute(pool)
        .await
        .map_err(|e| {
            if is_unique_violation(&e) {
                AppError::Conflict(format!("A storage type named '{name}' already exists"))
            } else {
                AppError::Database(e)
            }
        })?;
        Self::types_result(pool, user_id, Vec::new()).await
    }

    /// Changing the grid of a type in use redistributes its medium; a capacity change only
    /// balances overflowing compartments.
    pub async fn update_type(
        pool: &PgPool,
        user_id: i64,
        type_id: i64,
        req: UpdateStorageTypeRequest,
    ) -> Result<StorageTypesDto, AppError> {
        let name = validate_name(&req.name)?;
        validate_grid(req.rows, req.columns, req.capacity)?;
        let current = sqlx::query(
            "SELECT media, grid_rows, grid_columns, capacity,
                    EXISTS (SELECT 1 FROM storage_unit su WHERE su.type_id = st.id) AS in_use
             FROM storage_type st WHERE id = $1 AND user_id = $2",
        )
        .bind(type_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Storage type {type_id} not found")))?;

        let media = parse_media(current.get("media"));
        let grid_changed = i32::from(current.get::<i16, _>("grid_rows")) != req.rows
            || i32::from(current.get::<i16, _>("grid_columns")) != req.columns;
        let capacity_changed = current.get::<i32, _>("capacity") != req.capacity;
        let in_use: bool = current.get("in_use");

        sqlx::query(
            "UPDATE storage_type SET name = $1, grid_rows = $2, grid_columns = $3, capacity = $4
             WHERE id = $5 AND user_id = $6",
        )
        .bind(&name)
        .bind(req.rows as i16)
        .bind(req.columns as i16)
        .bind(req.capacity)
        .bind(type_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| {
            if is_unique_violation(&e) {
                AppError::Conflict(format!("A storage type named '{name}' already exists"))
            } else {
                AppError::Database(e)
            }
        })?;

        let mut redistributed = Vec::new();
        if in_use && grid_changed {
            StorageService::redistribute(pool, user_id, media).await?;
            redistributed.push(media);
        } else if in_use && capacity_changed {
            StorageService::commit(pool, user_id, media).await?;
        }
        Self::types_result(pool, user_id, redistributed).await
    }

    pub async fn delete_type(
        pool: &PgPool,
        user_id: i64,
        type_id: i64,
    ) -> Result<StorageTypesDto, AppError> {
        let in_use: Option<bool> = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM storage_unit su WHERE su.type_id = st.id)
             FROM storage_type st WHERE id = $1 AND user_id = $2",
        )
        .bind(type_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
        match in_use {
            None => {
                return Err(AppError::NotFound(format!(
                    "Storage type {type_id} not found"
                )));
            }
            Some(true) => {
                return Err(AppError::Conflict(
                    "The storage type is still used by shelves".to_string(),
                ));
            }
            Some(false) => {}
        }
        sqlx::query("DELETE FROM storage_type WHERE id = $1 AND user_id = $2")
            .bind(type_id)
            .bind(user_id)
            .execute(pool)
            .await?;
        Self::types_result(pool, user_id, Vec::new()).await
    }

    pub async fn list_units(pool: &PgPool, user_id: i64) -> Result<Vec<StorageUnitDto>, AppError> {
        let rows = sqlx::query(
            "SELECT su.id, su.name, su.type_id, su.sort_order, st.media
             FROM storage_unit su
             JOIN storage_type st ON st.id = su.type_id
             WHERE su.user_id = $1
             ORDER BY st.media DESC, su.sort_order, su.id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|row| StorageUnitDto {
                id: row.get("id"),
                name: row.get("name"),
                type_id: row.get("type_id"),
                media: parse_media(row.get("media")),
                sort_order: row.get("sort_order"),
            })
            .collect())
    }

    async fn units_result(
        pool: &PgPool,
        user_id: i64,
        redistributed: Vec<StorageMedia>,
    ) -> Result<StorageUnitsDto, AppError> {
        for &media in &redistributed {
            StorageService::redistribute(pool, user_id, media).await?;
        }
        Ok(StorageUnitsDto {
            units: Self::list_units(pool, user_id).await?,
            redistributed,
        })
    }

    async fn type_media(
        pool: &PgPool,
        user_id: i64,
        type_id: i64,
    ) -> Result<StorageMedia, AppError> {
        let media: Option<String> =
            sqlx::query_scalar("SELECT media FROM storage_type WHERE id = $1 AND user_id = $2")
                .bind(type_id)
                .bind(user_id)
                .fetch_optional(pool)
                .await?;
        media
            .map(|m| parse_media(&m))
            .ok_or_else(|| AppError::NotFound(format!("Storage type {type_id} not found")))
    }

    async fn unit_media(
        pool: &PgPool,
        user_id: i64,
        unit_id: i64,
    ) -> Result<(StorageMedia, i64), AppError> {
        let row = sqlx::query(
            "SELECT st.media, su.type_id
             FROM storage_unit su JOIN storage_type st ON st.id = su.type_id
             WHERE su.id = $1 AND su.user_id = $2",
        )
        .bind(unit_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Shelf {unit_id} not found")))?;
        Ok((parse_media(row.get("media")), row.get("type_id")))
    }

    fn unit_name_conflict(name: &str) -> impl FnOnce(sqlx::Error) -> AppError + '_ {
        move |e| {
            if is_unique_violation(&e) {
                AppError::Conflict(format!("A shelf named '{name}' already exists"))
            } else {
                AppError::Database(e)
            }
        }
    }

    /// New shelves are appended after the existing shelves of their medium.
    pub async fn create_unit(
        pool: &PgPool,
        user_id: i64,
        req: StorageUnitRequest,
    ) -> Result<StorageUnitsDto, AppError> {
        let name = validate_name(&req.name)?;
        let media = Self::type_media(pool, user_id, req.type_id).await?;
        sqlx::query(
            "INSERT INTO storage_unit (user_id, type_id, name, sort_order)
             VALUES ($1, $2, $3, (
                 SELECT COALESCE(MAX(su.sort_order), 0) + 1
                 FROM storage_unit su JOIN storage_type st ON st.id = su.type_id
                 WHERE su.user_id = $1 AND st.media = $4))",
        )
        .bind(user_id)
        .bind(req.type_id)
        .bind(&name)
        .bind(media.as_str())
        .execute(pool)
        .await
        .map_err(Self::unit_name_conflict(&name))?;
        Self::units_result(pool, user_id, vec![media]).await
    }

    /// Renaming keeps the layout; changing the type redistributes the affected media.
    pub async fn update_unit(
        pool: &PgPool,
        user_id: i64,
        unit_id: i64,
        req: StorageUnitRequest,
    ) -> Result<StorageUnitsDto, AppError> {
        let name = validate_name(&req.name)?;
        let (old_media, old_type) = Self::unit_media(pool, user_id, unit_id).await?;
        let new_media = Self::type_media(pool, user_id, req.type_id).await?;
        sqlx::query(
            "UPDATE storage_unit SET name = $1, type_id = $2 WHERE id = $3 AND user_id = $4",
        )
        .bind(&name)
        .bind(req.type_id)
        .bind(unit_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(Self::unit_name_conflict(&name))?;

        let mut redistributed = Vec::new();
        if old_type != req.type_id {
            redistributed.push(old_media);
            if new_media != old_media {
                redistributed.push(new_media);
            }
        }
        Self::units_result(pool, user_id, redistributed).await
    }

    pub async fn delete_unit(
        pool: &PgPool,
        user_id: i64,
        unit_id: i64,
    ) -> Result<StorageUnitsDto, AppError> {
        let (media, _) = Self::unit_media(pool, user_id, unit_id).await?;
        sqlx::query("DELETE FROM storage_unit WHERE id = $1 AND user_id = $2")
            .bind(unit_id)
            .bind(user_id)
            .execute(pool)
            .await?;
        Self::units_result(pool, user_id, vec![media]).await
    }

    /// `unit_ids` must list every shelf of the medium exactly once.
    pub async fn reorder_units(
        pool: &PgPool,
        user_id: i64,
        req: ReorderStorageUnitsRequest,
    ) -> Result<StorageUnitsDto, AppError> {
        let existing: HashSet<i64> = Self::list_units(pool, user_id)
            .await?
            .into_iter()
            .filter(|u| u.media == req.media)
            .map(|u| u.id)
            .collect();
        let requested: HashSet<i64> = req.unit_ids.iter().copied().collect();
        if requested.len() != req.unit_ids.len() || requested != existing {
            return Err(AppError::BadRequest(
                "unitIds must contain every shelf of the medium exactly once".to_string(),
            ));
        }

        let mut tx = pool.begin().await?;
        for (position, unit_id) in req.unit_ids.iter().enumerate() {
            sqlx::query("UPDATE storage_unit SET sort_order = $1 WHERE id = $2 AND user_id = $3")
                .bind(position as i32 + 1)
                .bind(unit_id)
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Self::units_result(pool, user_id, vec![req.media]).await
    }
}
