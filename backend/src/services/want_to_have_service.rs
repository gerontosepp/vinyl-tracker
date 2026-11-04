//! Want-to-Have list (#310): records known from label recognition or search that the user wants
//! to listen to before deciding to own them. Metadata is shared via `record_cache`.

use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        collection::SyncResultDto,
        user::AppUser,
        want_to_have::{WantToHaveItemDto, WantToHaveStatusDto},
    },
    services::{collection_sync::CollectionSyncService, crypto_service::CryptoService},
};
use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::{PgPool, Row, postgres::PgRow};

pub struct WantToHaveService;

const ITEM_SELECT: &str = "SELECT w.id, rc.discogs_id, rc.title, rc.artist, rc.release_year,
        rc.thumb_url, rc.format, w.created_at,
        COALESCE((SELECT array_agg(g.genre ORDER BY g.genre)
                  FROM record_genres g WHERE g.record_id = rc.id), '{}') AS genres
     FROM want_to_have_item w
     JOIN record_cache rc ON rc.id = w.record_id";

fn to_dto(row: &PgRow) -> WantToHaveItemDto {
    let created: NaiveDateTime = row.get("created_at");
    WantToHaveItemDto {
        id: row.get("id"),
        discogs_id: row.get("discogs_id"),
        title: row.get("title"),
        artist: row.get("artist"),
        year: row.get("release_year"),
        thumb_url: row.get("thumb_url"),
        format: row.get("format"),
        genres: row.get("genres"),
        created_at: DateTime::<Utc>::from_naive_utc_and_offset(created, Utc).to_rfc3339(),
    }
}

impl WantToHaveService {
    /// The user's list, newest first. Records the user owns meanwhile (added by another path)
    /// are left out.
    pub async fn list(pool: &PgPool, user_id: i64) -> Result<Vec<WantToHaveItemDto>, AppError> {
        let rows = sqlx::query(&format!(
            "{ITEM_SELECT} WHERE w.user_id = $1
               AND NOT EXISTS (SELECT 1 FROM collection_item ci
                               WHERE ci.user_id = w.user_id AND ci.record_id = w.record_id)
             ORDER BY w.created_at DESC, w.id DESC"
        ))
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(rows.iter().map(to_dto).collect())
    }

    /// Which of `discogs_ids` the user already owns or has on the list.
    pub async fn status(
        pool: &PgPool,
        user_id: i64,
        discogs_ids: &[i64],
    ) -> Result<WantToHaveStatusDto, AppError> {
        let in_collection: Vec<i64> = sqlx::query_scalar(
            "SELECT DISTINCT rc.discogs_id FROM collection_item ci
             JOIN record_cache rc ON rc.id = ci.record_id
             WHERE ci.user_id = $1 AND rc.discogs_id = ANY($2)",
        )
        .bind(user_id)
        .bind(discogs_ids)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        let in_want_to_have: Vec<i64> = sqlx::query_scalar(
            "SELECT rc.discogs_id FROM want_to_have_item w
             JOIN record_cache rc ON rc.id = w.record_id
             WHERE w.user_id = $1 AND rc.discogs_id = ANY($2)",
        )
        .bind(user_id)
        .bind(discogs_ids)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(WantToHaveStatusDto {
            in_collection,
            in_want_to_have,
        })
    }

    /// Adds a Discogs release; 409 if it is already owned or on the list.
    pub async fn add(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        discogs_id: i64,
    ) -> Result<WantToHaveItemDto, AppError> {
        if discogs_id <= 0 {
            return Err(AppError::BadRequest(
                "discogs_id must be a Discogs release ID".to_string(),
            ));
        }
        let status = Self::status(pool, user.id, &[discogs_id]).await?;
        if !status.in_collection.is_empty() {
            return Err(AppError::Conflict(
                "Record is already in your collection".to_string(),
            ));
        }
        if !status.in_want_to_have.is_empty() {
            return Err(AppError::Conflict(
                "Record is already on your Want-to-Have list".to_string(),
            ));
        }

        let enc_token = user.discogs_token.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a configured Discogs token".to_string())
        })?;
        let token = crypto.decrypt(enc_token).ok_or_else(|| {
            AppError::Internal("Failed to decrypt user Discogs token".to_string())
        })?;
        let release = discogs_client.get_release(discogs_id, &token).await?;

        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        let record_id = crate::services::collection_sync::upsert_release(&mut tx, &release).await?;
        let inserted = sqlx::query(
            "INSERT INTO want_to_have_item (user_id, record_id) VALUES ($1, $2)
             ON CONFLICT (user_id, record_id) DO NOTHING RETURNING id",
        )
        .bind(user.id)
        .bind(record_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        let Some(row) = inserted else {
            return Err(AppError::Conflict(
                "Record is already on your Want-to-Have list".to_string(),
            ));
        };
        let id: i64 = row.get("id");
        tx.commit().await.map_err(AppError::Database)?;

        Self::get(pool, user.id, id).await
    }

    async fn get(pool: &PgPool, user_id: i64, id: i64) -> Result<WantToHaveItemDto, AppError> {
        let row = sqlx::query(&format!("{ITEM_SELECT} WHERE w.id = $1 AND w.user_id = $2"))
            .bind(id)
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
            .ok_or_else(|| AppError::NotFound(format!("Want-to-Have item {id} not found")))?;
        Ok(to_dto(&row))
    }

    /// Removes an entry of the user; 404 for unknown or foreign IDs.
    pub async fn remove(pool: &PgPool, user_id: i64, id: i64) -> Result<(), AppError> {
        let res = sqlx::query("DELETE FROM want_to_have_item WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        if res.rows_affected() == 0 {
            return Err(AppError::NotFound(format!(
                "Want-to-Have item {id} not found"
            )));
        }
        Ok(())
    }

    /// Moves the entry into the collection. The entry is claimed first (deleted atomically), so a
    /// repeated or concurrent call cannot add a second copy; if adding fails the entry is put
    /// back. A record the user already owns is not added again.
    pub async fn to_collection(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
    ) -> Result<SyncResultDto, AppError> {
        let claimed = sqlx::query(
            "DELETE FROM want_to_have_item w USING record_cache rc
             WHERE w.id = $1 AND w.user_id = $2 AND rc.id = w.record_id
             RETURNING w.record_id, rc.discogs_id, w.created_at",
        )
        .bind(id)
        .bind(user.id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::NotFound(format!("Want-to-Have item {id} not found")))?;
        let record_id: i64 = claimed.get("record_id");
        let discogs_id: i64 = claimed.get("discogs_id");
        let created_at: NaiveDateTime = claimed.get("created_at");

        if !Self::status(pool, user.id, &[discogs_id])
            .await?
            .in_collection
            .is_empty()
        {
            return Ok(SyncResultDto {
                status: "SUCCESS".to_string(),
                added: 0,
                updated: 0,
                removed: 0,
                total: 0,
                placement: None,
            });
        }

        match CollectionSyncService::add_release_and_sync(
            pool,
            discogs_client,
            crypto,
            user,
            discogs_id,
        )
        .await
        {
            Ok(result) => Ok(result),
            Err(err) => {
                // Put the entry back so the user can retry
                sqlx::query(
                    "INSERT INTO want_to_have_item (user_id, record_id, created_at)
                     VALUES ($1, $2, $3) ON CONFLICT (user_id, record_id) DO NOTHING",
                )
                .bind(user.id)
                .bind(record_id)
                .bind(created_at)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
                Err(err)
            }
        }
    }
}
