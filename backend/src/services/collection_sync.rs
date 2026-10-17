use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        collection::{PriceRefreshResultDto, SyncResultDto},
        discogs::{DiscogsFolderReleaseItem, determine_format},
        user::AppUser,
    },
    services::crypto_service::CryptoService,
};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::collections::HashSet;

pub struct CollectionSyncService;

impl CollectionSyncService {
    pub async fn sync_collection(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
    ) -> Result<SyncResultDto, AppError> {
        let discogs_user = user.discogs_username.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a linked Discogs username".to_string())
        })?;

        let enc_token = user.discogs_token.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a configured Discogs token".to_string())
        })?;

        let token = crypto.decrypt(enc_token).ok_or_else(|| {
            AppError::Internal("Failed to decrypt user Discogs token".to_string())
        })?;

        tracing::info!("Starting Discogs collection sync for user: {discogs_user}");

        // 1. Fetch collection fields to discover condition field IDs
        let mut media_field_id = 1i64;
        let mut sleeve_field_id = 2i64;

        if let Ok(fields_res) = discogs_client
            .get_collection_fields(discogs_user, &token)
            .await
        {
            for f in fields_res.fields.unwrap_or_default() {
                if let Some(name) = f.name {
                    let name_lower = name.trim().to_lowercase();
                    if name_lower.contains("media") && name_lower.contains("condition") {
                        media_field_id = f.id;
                    } else if name_lower.contains("sleeve") && name_lower.contains("condition") {
                        sleeve_field_id = f.id;
                    }
                }
            }
        }

        // 2. Fetch paginated releases from Discogs folder 0
        let mut page = 1u32;
        let per_page = 100u32;
        let mut added_count = 0i32;
        let mut updated_count = 0i32;
        let mut remote_instance_ids = HashSet::new();

        loop {
            let folder_res = discogs_client
                .get_collection_releases(discogs_user, &token, page, per_page)
                .await?;

            for release_item in &folder_res.releases {
                remote_instance_ids.insert(release_item.instance_id);

                let is_new = Self::upsert_release_item(
                    pool,
                    user.id,
                    release_item,
                    media_field_id,
                    sleeve_field_id,
                )
                .await?;

                if is_new {
                    added_count += 1;
                } else {
                    updated_count += 1;
                }
            }

            if page >= folder_res.pagination.pages || folder_res.releases.is_empty() {
                break;
            }
            page += 1;
        }

        // 3. Remove items in collection_item that no longer exist remotely
        let remote_ids_vec: Vec<i64> = remote_instance_ids.into_iter().collect();
        let removed_count = if remote_ids_vec.is_empty() {
            let del_res = sqlx::query("DELETE FROM collection_item WHERE user_id = $1")
                .bind(user.id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
            del_res.rows_affected() as i32
        } else {
            let del_res = sqlx::query(
                "DELETE FROM collection_item WHERE user_id = $1 AND instance_id != ALL($2)",
            )
            .bind(user.id)
            .bind(&remote_ids_vec)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
            del_res.rows_affected() as i32
        };

        let total_synced = added_count + updated_count;

        tracing::info!(
            "Discogs collection sync complete for {discogs_user}: added={added_count}, updated={updated_count}, removed={removed_count}"
        );

        Ok(SyncResultDto {
            status: "SUCCESS".to_string(),
            added: added_count,
            updated: updated_count,
            removed: removed_count,
            total: total_synced,
        })
    }

    pub async fn add_release_and_sync(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        release_id: i64,
    ) -> Result<SyncResultDto, AppError> {
        let discogs_user = user.discogs_username.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a linked Discogs username".to_string())
        })?;

        let enc_token = user.discogs_token.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a configured Discogs token".to_string())
        })?;

        let token = crypto.decrypt(enc_token).ok_or_else(|| {
            AppError::Internal("Failed to decrypt user Discogs token".to_string())
        })?;

        // 1. Add to Discogs collection folder 0
        let add_res = discogs_client
            .add_release_to_folder(discogs_user, 0, release_id, &token)
            .await?;

        // 2. Fetch full release details
        let release = discogs_client.get_release(release_id, &token).await?;

        // 3. Upsert record_cache
        let format = determine_format(release.formats.as_deref());
        let artist = release
            .artists
            .as_ref()
            .and_then(|a| a.first())
            .map(|a| a.name.clone())
            .unwrap_or_default();
        let year_str = release.year.map(|y| y.to_string());

        let record_row = sqlx::query(
            "INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (discogs_id)
             DO UPDATE SET title = EXCLUDED.title,
                           artist = EXCLUDED.artist,
                           release_year = EXCLUDED.release_year,
                           thumb_url = COALESCE(EXCLUDED.thumb_url, record_cache.thumb_url),
                           format = EXCLUDED.format
             RETURNING id",
        )
        .bind(release_id)
        .bind(&release.title)
        .bind(&artist)
        .bind(&year_str)
        .bind(&release.thumb)
        .bind(&format)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;

        let record_id: i64 = record_row.get("id");

        // Upsert genres
        if let Some(genres) = &release.genres {
            sqlx::query("DELETE FROM record_genres WHERE record_id = $1")
                .bind(record_id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;

            for g in genres {
                sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, $2)")
                    .bind(record_id)
                    .bind(g)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
            }
        }

        // 4. Upsert collection_item
        let now = Utc::now().naive_utc();
        sqlx::query(
            "INSERT INTO collection_item (user_id, record_id, instance_id, added_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, instance_id)
             DO UPDATE SET record_id = EXCLUDED.record_id",
        )
        .bind(user.id)
        .bind(record_id)
        .bind(add_res.instance_id)
        .bind(now)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

        Ok(SyncResultDto {
            status: "SUCCESS".to_string(),
            added: 1,
            updated: 0,
            removed: 0,
            total: 1,
        })
    }

    pub async fn remove_release(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        release_id: i64,
        instance_id_opt: Option<i64>,
    ) -> Result<(), AppError> {
        // 1. Locate the collection item for the user
        let item_row = if let Some(inst_id) = instance_id_opt {
            sqlx::query(
                "SELECT ci.id, ci.instance_id, rc.discogs_id
                 FROM collection_item ci
                 JOIN record_cache rc ON rc.id = ci.record_id
                 WHERE ci.user_id = $1 AND ci.instance_id = $2
                 LIMIT 1",
            )
            .bind(user.id)
            .bind(inst_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
        } else {
            sqlx::query(
                "SELECT ci.id, ci.instance_id, rc.discogs_id
                 FROM collection_item ci
                 JOIN record_cache rc ON rc.id = ci.record_id
                 WHERE ci.user_id = $1 AND (rc.discogs_id = $2 OR rc.id = $2)
                 LIMIT 1",
            )
            .bind(user.id)
            .bind(release_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
        };

        let Some(row) = item_row else {
            return Err(AppError::NotFound(
                "Record not found in user collection".to_string(),
            ));
        };

        let item_id: i64 = row.get("id");
        let instance_id: i64 = row.get("instance_id");
        let discogs_id: i64 = row.get("discogs_id");

        // 2. Delete instance from remote Discogs collection if credentials exist
        let discogs_auth = user
            .discogs_username
            .as_deref()
            .zip(user.discogs_token.as_deref())
            .and_then(|(u, enc)| crypto.decrypt(enc).map(|token| (u, token)));

        if let Some((discogs_user, token)) = discogs_auth
            && let Err(e) = discogs_client
                .delete_release_instance(discogs_user, 0, discogs_id, instance_id, &token)
                .await
        {
            tracing::warn!(
                "Failed to delete instance {instance_id} for release {discogs_id} from Discogs folder 0: {e}"
            );
            return Err(e);
        }

        // 3. Delete from local collection_item
        sqlx::query("DELETE FROM collection_item WHERE id = $1")
            .bind(item_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        tracing::info!(
            "Successfully removed release {discogs_id} (instance {instance_id}) from collection for user {}",
            user.id
        );

        Ok(())
    }

    pub async fn refresh_collection_prices(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        only_missing: bool,
    ) -> Result<PriceRefreshResultDto, AppError> {
        let enc_token = user.discogs_token.as_deref().ok_or_else(|| {
            AppError::BadRequest("User does not have a configured Discogs token".to_string())
        })?;

        let token = crypto.decrypt(enc_token).ok_or_else(|| {
            AppError::Internal("Failed to decrypt user Discogs token".to_string())
        })?;

        let rows = sqlx::query(
            "SELECT DISTINCT rc.id, rc.discogs_id,
                    rc.lowest_price::float8 as lowest_price,
                    rc.median_price::float8 as median_price
             FROM record_cache rc
             JOIN collection_item ci ON ci.record_id = rc.id
             WHERE ci.user_id = $1",
        )
        .bind(user.id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;

        let mut updated = 0i32;
        let mut failed = 0i32;

        for r in rows {
            let id: i64 = r.get("id");
            let discogs_id: i64 = r.get("discogs_id");
            let lowest_price: Option<f64> = r.get("lowest_price");
            let median_price: Option<f64> = r.get("median_price");

            if only_missing && lowest_price.is_some() && median_price.is_some() {
                continue;
            }

            match discogs_client
                .get_price_suggestions(discogs_id, &token)
                .await
            {
                Ok(suggestions) => {
                    let vg_plus = suggestions.get("Very Good Plus (VG+)");
                    let good_plus = suggestions.get("Good Plus (G+)");
                    let near_mint = suggestions.get("Near Mint (NM or M-)");

                    let median = vg_plus.or(near_mint).or(good_plus).map(|p| p.value);
                    let lowest = good_plus.or(vg_plus).map(|p| p.value);

                    if median.is_some() || lowest.is_some() {
                        let _ = sqlx::query(
                            "UPDATE record_cache
                             SET median_price = COALESCE($1, median_price),
                                 lowest_price = COALESCE($2, lowest_price)
                             WHERE id = $3",
                        )
                        .bind(median)
                        .bind(lowest)
                        .bind(id)
                        .execute(pool)
                        .await;
                        updated += 1;
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed price suggestion for discogs_id {discogs_id}: {e}");
                    failed += 1;
                }
            }
        }

        Ok(PriceRefreshResultDto {
            updated_count: updated,
            failed_count: failed,
        })
    }

    async fn upsert_release_item(
        pool: &PgPool,
        user_id: i64,
        item: &DiscogsFolderReleaseItem,
        media_field_id: i64,
        sleeve_field_id: i64,
    ) -> Result<bool, AppError> {
        let discogs_id = item.basic_information.id;
        let title = &item.basic_information.title;
        let artist = item
            .basic_information
            .artists
            .as_ref()
            .and_then(|a| a.first())
            .map(|a| a.name.clone())
            .unwrap_or_default();
        let year_str = item.basic_information.year.map(|y| y.to_string());
        let format = determine_format(item.basic_information.formats.as_deref());
        let thumb_url = item.basic_information.thumb.as_deref();

        // 1. Upsert record_cache
        let record_row = sqlx::query(
            "INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (discogs_id)
             DO UPDATE SET title = EXCLUDED.title,
                           artist = EXCLUDED.artist,
                           release_year = EXCLUDED.release_year,
                           thumb_url = COALESCE(EXCLUDED.thumb_url, record_cache.thumb_url),
                           format = EXCLUDED.format
             RETURNING id",
        )
        .bind(discogs_id)
        .bind(title)
        .bind(&artist)
        .bind(&year_str)
        .bind(thumb_url)
        .bind(&format)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;

        let record_id: i64 = record_row.get("id");

        // 2. Genres
        if let Some(genres) = &item.basic_information.genres {
            sqlx::query("DELETE FROM record_genres WHERE record_id = $1")
                .bind(record_id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;

            for g in genres {
                sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, $2)")
                    .bind(record_id)
                    .bind(g)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
            }
        }

        // 3. Extract conditions from notes
        let mut media_condition = None;
        let mut sleeve_condition = None;
        if let Some(notes) = &item.notes {
            for note in notes {
                if note.field_id == Some(media_field_id) {
                    media_condition = note.value.clone();
                } else if note.field_id == Some(sleeve_field_id) {
                    sleeve_condition = note.value.clone();
                }
            }
        }

        // 4. Parse date_added
        let added_at = item
            .date_added
            .as_deref()
            .and_then(|s| {
                DateTime::parse_from_rfc3339(s)
                    .ok()
                    .map(|dt| dt.naive_utc())
            })
            .unwrap_or_else(|| Utc::now().naive_utc());

        // 5. Upsert collection_item
        let existing: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM collection_item WHERE user_id = $1 AND instance_id = $2",
        )
        .bind(user_id)
        .bind(item.instance_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;

        let is_new = existing.is_none();

        sqlx::query(
            "INSERT INTO collection_item (user_id, record_id, instance_id, added_at, media_condition, sleeve_condition)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, instance_id)
             DO UPDATE SET record_id = EXCLUDED.record_id,
                           media_condition = EXCLUDED.media_condition,
                           sleeve_condition = EXCLUDED.sleeve_condition"
        )
        .bind(user_id)
        .bind(record_id)
        .bind(item.instance_id)
        .bind(added_at)
        .bind(media_condition)
        .bind(sleeve_condition)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

        Ok(is_new)
    }
}
