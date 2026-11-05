//! Want-to-Have list (#310): records known from label recognition or search that the user wants
//! to listen to before deciding to own them. Metadata is shared via `record_cache`.

use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        collection::SyncResultDto,
        user::AppUser,
        want_to_have::{
            MarketplaceStatsDto, PurchaseSourcesDto, WantToHaveItemDto, WantToHaveStatusDto,
        },
    },
    services::{
        collection_sync::CollectionSyncService, crypto_service::CryptoService, purchase_sources,
    },
};
use chrono::{DateTime, NaiveDateTime, Utc};
use futures_util::future::join_all;
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

        let token = Self::discogs_token(crypto, user)?;
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

    /// The user's decrypted Discogs token; 400 if none is configured.
    fn discogs_token(crypto: &CryptoService, user: &AppUser) -> Result<String, AppError> {
        let enc_token = user.discogs_token.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a configured Discogs token".to_string())
        })?;
        crypto
            .decrypt(enc_token)
            .ok_or_else(|| AppError::Internal("Failed to decrypt user Discogs token".to_string()))
    }

    /// Online sources (#319): all Vinyl versions of the record's master with the wanted one
    /// first, marketplace figures for the first few of them, and shop search links.
    pub async fn sources(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
    ) -> Result<PurchaseSourcesDto, AppError> {
        let item = Self::get(pool, user.id, id).await?;
        let token = Self::discogs_token(crypto, user)?;
        let release = discogs_client.get_release(item.discogs_id, &token).await?;

        let master_id = release.master();
        let master = match master_id {
            Some(master_id) => match discogs_client.get_master_versions(master_id, &token).await {
                Ok(versions) => Some(versions),
                Err(AppError::NotFound(_)) => {
                    tracing::warn!("Discogs master {master_id} not found, showing release only");
                    None
                }
                Err(err) => return Err(err),
            },
            None => None,
        };

        let (mut versions, total_versions, truncated) =
            purchase_sources::build_versions(&release, master.as_deref());

        // Marketplace figures for the first versions, without waiting for the rate limiter;
        // the rest is loaded on demand. A failure here only leaves the figures out.
        let eager = join_all(
            versions
                .iter()
                .take(purchase_sources::EAGER_STATS)
                .map(|v| {
                    discogs_client.try_get_marketplace_stats_nonblocking(v.release_id, &token)
                }),
        )
        .await;
        for (version, stats) in versions.iter_mut().zip(eager) {
            match stats {
                Ok(Some(stats)) => {
                    version.stats = Some(purchase_sources::stats_dto(version.release_id, &stats));
                }
                Ok(None) => {}
                Err(err) => tracing::warn!(
                    "Marketplace stats of release {} failed: {err}",
                    version.release_id
                ),
            }
        }

        let shop_links = purchase_sources::shop_links(
            &purchase_sources::release_artist(&release),
            &release.title,
            versions[0].catno.as_deref(),
            master_id,
            release.id,
        );
        Ok(PurchaseSourcesDto {
            discogs_id: item.discogs_id,
            master_id,
            currency: crate::clients::discogs::MARKETPLACE_CURRENCY.to_string(),
            versions,
            total_versions,
            truncated,
            shop_links,
        })
    }

    /// Marketplace figures of one version. Only the wanted release and the versions of its
    /// master are accepted (404 otherwise), so the endpoint cannot be used to query arbitrary
    /// releases against the shared Discogs limit.
    pub async fn version_stats(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
        release_id: i64,
    ) -> Result<MarketplaceStatsDto, AppError> {
        let item = Self::get(pool, user.id, id).await?;
        let token = Self::discogs_token(crypto, user)?;

        if release_id != item.discogs_id {
            let not_a_version = || {
                AppError::NotFound(format!(
                    "Release {release_id} is not a version of Want-to-Have item {id}"
                ))
            };
            let release = discogs_client.get_release(item.discogs_id, &token).await?;
            let master_id = release.master().ok_or_else(not_a_version)?;
            let versions = discogs_client
                .get_master_versions(master_id, &token)
                .await?;
            if !versions.versions.iter().any(|v| v.id == release_id) {
                return Err(not_a_version());
            }
        }

        let stats = discogs_client
            .get_marketplace_stats(release_id, &token)
            .await?;
        Ok(purchase_sources::stats_dto(release_id, &stats))
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
