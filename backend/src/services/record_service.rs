use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        discogs::{
            DiscogsFormat, DiscogsIdentifier, DiscogsLabel, DiscogsRelease, DiscogsTrack,
            determine_format,
        },
        record::{
            RecordDetailDto, RecordSource, UpdateConditionRequestDto, UpdateSortKeyRequestDto,
        },
        user::AppUser,
    },
    services::{
        crypto_service::CryptoService,
        marketplace::{extract_suggested_price, validate_goldmine_condition},
        record_genres::add_genres,
        shelf_order::DEFAULT_ARTIST_KEY_SQL,
        storage::StorageService,
    },
};
use chrono::Utc;
use sqlx::{PgPool, Row};
use std::sync::Arc;

/// Discogs releases are shared; a manual record is only visible to its owner (`$2` = user ID).
pub const OWN_RECORD_SQL: &str = "(rc.source = 'discogs' OR rc.owner_id = $2)";

/// Maximum length of a custom sort string (`collection_item.sort_key`).
pub const MAX_SORT_KEY_LEN: usize = 200;

pub struct RecordService;

impl RecordService {
    /// Details of a record and its first copy in the user's collection.
    pub async fn get_record_details(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id_param: i64,
    ) -> Result<RecordDetailDto, AppError> {
        Self::get_copy_details(pool, discogs_client, crypto, user, id_param, None).await
    }

    /// Details of a record with the copy-specific data (conditions, sort string, shelf slot) of
    /// the copy `instance_id`; `None` takes the first copy.
    pub async fn get_copy_details(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id_param: i64,
        instance_id: Option<i64>,
    ) -> Result<RecordDetailDto, AppError> {
        let dec_token = user
            .discogs_token
            .as_deref()
            .and_then(|enc| crypto.decrypt(enc));

        // 1. Look up existing local record (incl. the automatic sort key of its stored artist)
        let record_row = sqlx::query(&format!(
            "SELECT id, discogs_id, title, artist, release_year, thumb_url, format, source,
                    label, catno, country, barcode, notes,
                    lowest_price::float8 as lowest_price,
                    median_price::float8 as median_price,
                    {DEFAULT_ARTIST_KEY_SQL} AS default_sort_key
             FROM record_cache rc
             WHERE (id = $1 OR discogs_id = $1) AND {OWN_RECORD_SQL}
             LIMIT 1"
        ))
        .bind(id_param)
        .bind(user.id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;

        let local_record_id: Option<i64> = record_row.as_ref().map(|r| r.get("id"));
        let discogs_id: i64 = record_row
            .as_ref()
            .map(|r| r.get("discogs_id"))
            .unwrap_or(id_param);

        // Manual records (negative IDs) have no Discogs release and never call Discogs
        let source = record_row
            .as_ref()
            .and_then(|r| RecordSource::parse(r.get("source")))
            .unwrap_or_default();
        let dec_token = dec_token.filter(|_| source == RecordSource::Discogs && discogs_id > 0);

        // 2. Fetch Discogs release details if token is available
        let discogs_release: Option<Arc<DiscogsRelease>> = if let Some(ref token) = dec_token {
            discogs_client.get_release(discogs_id, token).await.ok()
        } else {
            None
        };

        if record_row.is_none() && discogs_release.is_none() {
            return Err(AppError::NotFound(format!(
                "Record not found with ID: {id_param}"
            )));
        }

        // 3. Look up collection_item
        let collection_row = if let Some(rec_id) = local_record_id {
            sqlx::query(
                "SELECT id, instance_id, added_at, media_condition, sleeve_condition, sort_key
                 FROM collection_item
                 WHERE user_id = $1 AND record_id = $2
                   AND ($3::BIGINT IS NULL OR instance_id = $3)
                 ORDER BY instance_id
                 LIMIT 1",
            )
            .bind(user.id)
            .bind(rec_id)
            .bind(instance_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
        } else {
            sqlx::query(
                "SELECT ci.id, ci.instance_id, ci.added_at, ci.media_condition, ci.sleeve_condition, ci.sort_key
                 FROM collection_item ci
                 JOIN record_cache rc ON rc.id = ci.record_id
                 WHERE ci.user_id = $1 AND rc.discogs_id = $2
                   AND ($3::BIGINT IS NULL OR ci.instance_id = $3)
                 ORDER BY ci.instance_id
                 LIMIT 1",
            )
            .bind(user.id)
            .bind(discogs_id)
            .bind(instance_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
        };

        let in_collection = collection_row.is_some();
        let instance_id: Option<i64> = collection_row.as_ref().map(|r| r.get("instance_id"));
        let added_at: Option<String> = collection_row
            .as_ref()
            .map(|r| r.get::<chrono::NaiveDateTime, _>("added_at").to_string());
        let media_condition: Option<String> = collection_row
            .as_ref()
            .and_then(|r| r.get("media_condition"));
        let sleeve_condition: Option<String> = collection_row
            .as_ref()
            .and_then(|r| r.get("sleeve_condition"));
        let sort_key: Option<String> = collection_row.as_ref().and_then(|r| r.get("sort_key"));

        // 4. Look up listen history & counts
        let mut listen_count = 0i64;
        let mut last_listened_at: Option<String> = None;
        let mut listen_history: Vec<String> = Vec::new();

        if let Some(rec_id) = local_record_id {
            let stats_row = sqlx::query(
                "SELECT COUNT(*) as listen_count, MAX(timestamp) as last_listened_at
                 FROM listen_event
                 WHERE user_id = $1 AND record_id = $2",
            )
            .bind(user.id)
            .bind(rec_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;

            listen_count = stats_row.get("listen_count");
            let last_ts: Option<chrono::NaiveDateTime> = stats_row.get("last_listened_at");
            last_listened_at = last_ts.map(|t| t.to_string());

            let history_rows = sqlx::query(
                "SELECT timestamp FROM listen_event
                 WHERE user_id = $1 AND record_id = $2
                 ORDER BY timestamp DESC",
            )
            .bind(user.id)
            .bind(rec_id)
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;

            for hr in history_rows {
                let ts: chrono::NaiveDateTime = hr.get("timestamp");
                listen_history.push(ts.to_string());
            }
        }

        // 5. Lowest & Median Prices
        let lowest_price: Option<f64> = discogs_release
            .as_ref()
            .and_then(|r| r.lowest_price)
            .or_else(|| record_row.as_ref().and_then(|r| r.get("lowest_price")));

        let mut median_price: Option<f64> = record_row.as_ref().and_then(|r| r.get("median_price"));

        // Price Suggestions if median price is missing
        if median_price.is_none() && dec_token.is_some() {
            let token = dec_token.as_deref().unwrap();
            let suggestions = discogs_client
                .get_price_suggestions(discogs_id, token)
                .await
                .unwrap_or_default();
            if let Some(sug) = extract_suggested_price(&suggestions, media_condition.as_deref()) {
                median_price = Some(sug);
                if let Some(rec_id) = local_record_id {
                    let _ = sqlx::query("UPDATE record_cache SET median_price = $1 WHERE id = $2")
                        .bind(sug)
                        .bind(rec_id)
                        .execute(pool)
                        .await;
                }
            }
        }

        // Update lowest_price in DB if newly available
        if let (Some(l_price), Some(rec_id)) = (lowest_price, local_record_id) {
            let current_db_lowest: Option<f64> =
                record_row.as_ref().and_then(|r| r.get("lowest_price"));
            if current_db_lowest != Some(l_price) {
                let _ = sqlx::query("UPDATE record_cache SET lowest_price = $1 WHERE id = $2")
                    .bind(l_price)
                    .bind(rec_id)
                    .execute(pool)
                    .await;
            }
        }

        // 6. Metadata resolution
        let title: Option<String> = discogs_release
            .as_ref()
            .map(|r| r.title.clone())
            .or_else(|| record_row.as_ref().and_then(|r| r.get("title")));

        let artist: Option<String> = discogs_release
            .as_ref()
            .and_then(|r| {
                r.artists
                    .as_ref()
                    .and_then(|a| a.first())
                    .map(|a| a.name.clone())
            })
            .or_else(|| record_row.as_ref().and_then(|r| r.get("artist")));

        let year: Option<String> = discogs_release
            .as_ref()
            .and_then(|r| r.year.map(|y| y.to_string()))
            .or_else(|| record_row.as_ref().and_then(|r| r.get("release_year")));

        let thumb_url: Option<String> = discogs_release
            .as_ref()
            .and_then(|r| r.thumb.clone())
            .or_else(|| record_row.as_ref().and_then(|r| r.get("thumb_url")));

        // Fetch genres from DB or Discogs
        let mut genres: Vec<String> = Vec::new();
        if let Some(rec_id) = local_record_id {
            let genre_rows = sqlx::query(
                "SELECT genre FROM record_genres WHERE record_id = $1 ORDER BY genre COLLATE \"C\"",
            )
            .bind(rec_id)
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;

            for gr in genre_rows {
                let g: String = gr.get("genre");
                genres.push(g);
            }
        }
        if genres.is_empty() {
            genres = discogs_release
                .as_ref()
                .and_then(|r| r.genres.clone())
                .unwrap_or_default();
            // Same order as the stored genres
            genres.sort();
        }

        let mut format = record_row
            .as_ref()
            .and_then(|r| r.get::<Option<String>, _>("format"))
            .unwrap_or_else(|| {
                discogs_release
                    .as_ref()
                    .map(|r| determine_format(r.formats.as_deref()))
                    .unwrap_or_else(|| "LP".to_string())
            });

        if format.is_empty() {
            format = "LP".to_string();
        }

        let num_for_sale: Option<i32> = discogs_release.as_ref().and_then(|r| r.num_for_sale);
        let tracklist: Vec<DiscogsTrack> = discogs_release
            .as_ref()
            .and_then(|r| r.tracklist.clone())
            .unwrap_or_default();
        let formats: Vec<DiscogsFormat> = discogs_release
            .as_ref()
            .and_then(|r| r.formats.clone())
            .unwrap_or_default();
        let local_text =
            |column: &str| -> Option<String> { record_row.as_ref().and_then(|r| r.get(column)) };
        let labels: Vec<DiscogsLabel> = discogs_release
            .as_ref()
            .and_then(|r| r.labels.clone())
            .or_else(|| {
                let (name, catno) = (local_text("label"), local_text("catno"));
                (name.is_some() || catno.is_some()).then(|| {
                    vec![DiscogsLabel {
                        id: None,
                        name: name.unwrap_or_default(),
                        catno,
                    }]
                })
            })
            .unwrap_or_default();
        let identifiers: Vec<DiscogsIdentifier> = discogs_release
            .as_ref()
            .and_then(|r| r.identifiers.clone())
            .unwrap_or_default();
        let notes: Option<String> = discogs_release
            .as_ref()
            .and_then(|r| r.notes.clone())
            .or_else(|| local_text("notes"));
        let country: Option<String> = discogs_release
            .as_ref()
            .and_then(|r| r.country.clone())
            .or_else(|| local_text("country"));
        let barcode = local_text("barcode");
        let released: Option<String> = discogs_release.as_ref().and_then(|r| r.released.clone());

        // Only cached records can be in the collection and thus on a shelf
        let default_sort_key: Option<String> =
            record_row.as_ref().and_then(|r| r.get("default_sort_key"));

        let placement = if in_collection {
            StorageService::placement_for_copy(pool, user.id, discogs_id, instance_id).await?
        } else {
            None
        };
        let (storage, storage_neighbors) = match placement {
            Some(p) => (Some(p.slot), Some(p.neighbors)),
            None => (None, None),
        };

        Ok(RecordDetailDto {
            id: local_record_id,
            discogs_id,
            title,
            artist,
            year,
            thumb_url,
            genres,
            in_collection,
            instance_id,
            listen_count,
            last_listened_at,
            added_at,
            media_condition,
            sleeve_condition,
            sort_key,
            default_sort_key,
            lowest_price,
            median_price,
            num_for_sale,
            listen_history,
            tracklist,
            format,
            formats,
            labels,
            identifiers,
            notes,
            country,
            released,
            storage,
            storage_neighbors,
            source,
            barcode,
        })
    }

    pub async fn log_listen(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id_param: i64,
    ) -> Result<RecordDetailDto, AppError> {
        let dec_token = user
            .discogs_token
            .as_deref()
            .and_then(|enc| crypto.decrypt(enc));

        // 1. Find or create record in record_cache
        let record_row = sqlx::query(&format!(
            "SELECT id, discogs_id FROM record_cache rc
             WHERE (id = $1 OR discogs_id = $1) AND {OWN_RECORD_SQL} LIMIT 1"
        ))
        .bind(id_param)
        .bind(user.id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;

        let record_id = match record_row {
            Some(row) => row.get::<i64, _>("id"),
            // Negative IDs are manual records, which exist only locally
            None if id_param < 0 => {
                return Err(AppError::NotFound(format!(
                    "Record not found with ID: {id_param}"
                )));
            }
            None => {
                // Must fetch from Discogs
                let token = dec_token.as_deref().ok_or_else(|| {
                    AppError::BadRequest(
                        "User has no Discogs token configured to fetch release details".to_string(),
                    )
                })?;

                let release = discogs_client.get_release(id_param, token).await?;
                let artist_name = release
                    .artists
                    .as_ref()
                    .and_then(|a| a.first())
                    .map(|a| a.name.clone())
                    .unwrap_or_else(|| "Unknown".to_string());

                let year_str = release.year.map(|y| y.to_string());
                let fmt = determine_format(release.formats.as_deref());

                let inserted = sqlx::query(
                    "INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format, lowest_price)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (discogs_id)
                     DO UPDATE SET title = EXCLUDED.title
                     RETURNING id"
                )
                .bind(release.id)
                .bind(&release.title)
                .bind(&artist_name)
                .bind(&year_str)
                .bind(&release.thumb)
                .bind(&fmt)
                .bind(release.lowest_price)
                .fetch_one(pool)
                .await
                .map_err(AppError::Database)?;

                let rec_id: i64 = inserted.get("id");

                if let Some(genres) = &release.genres
                    && let Err(e) = add_genres(pool, rec_id, genres).await
                {
                    tracing::warn!("Could not store the genres of record {rec_id}: {e}");
                }

                rec_id
            }
        };

        // 2. Insert listen_event
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, $3)")
            .bind(user.id)
            .bind(record_id)
            .bind(now)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        // 3. Return updated details
        Self::get_record_details(pool, discogs_client, crypto, user, record_id).await
    }

    pub async fn update_condition(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id_param: i64,
        req: UpdateConditionRequestDto,
    ) -> Result<RecordDetailDto, AppError> {
        let dec_token = user
            .discogs_token
            .as_deref()
            .and_then(|enc| crypto.decrypt(enc));

        // 1. Locate record
        let record_row = sqlx::query(&format!(
            "SELECT id, discogs_id, source, median_price::float8 as median_price
             FROM record_cache rc
             WHERE (id = $1 OR discogs_id = $1) AND {OWN_RECORD_SQL}
             LIMIT 1"
        ))
        .bind(id_param)
        .bind(user.id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;

        let record_row = record_row
            .ok_or_else(|| AppError::NotFound(format!("Record not found with ID: {id_param}")))?;

        let record_id: i64 = record_row.get("id");
        let discogs_id: i64 = record_row.get("discogs_id");
        // A manual record keeps its own value and has no Discogs copy to update
        let manual = record_row.get::<&str, _>("source") == RecordSource::Manual.as_str();
        let dec_token = dec_token.filter(|_| !manual);

        // 2. Locate collection_item
        let ci_row = sqlx::query(
            "SELECT id, instance_id, media_condition, sleeve_condition
             FROM collection_item
             WHERE user_id = $1 AND record_id = $2
             LIMIT 1",
        )
        .bind(user.id)
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;

        let ci_row = ci_row.ok_or_else(|| {
            AppError::NotFound(format!("Record is not in your collection (ID: {id_param})"))
        })?;

        let instance_id: Option<i64> = ci_row.get("instance_id");
        let old_media: Option<String> = ci_row.get("media_condition");
        let old_sleeve: Option<String> = ci_row.get("sleeve_condition");

        let has_media_req = req.media_condition.is_some();
        let has_sleeve_req = req.sleeve_condition.is_some();

        let new_media = match req.media_condition.filter(|s| !s.trim().is_empty()) {
            Some(ref raw) => Some(validate_goldmine_condition(raw)?.to_string()),
            None => None,
        };
        let new_sleeve = match req.sleeve_condition.filter(|s| !s.trim().is_empty()) {
            Some(ref raw) => Some(validate_goldmine_condition(raw)?.to_string()),
            None => None,
        };

        let media_changed = has_media_req && new_media != old_media;
        let sleeve_changed = has_sleeve_req && new_sleeve != old_sleeve;

        // 3. Update collection_item
        let updated_media = if has_media_req {
            new_media.clone()
        } else {
            old_media
        };
        let updated_sleeve = if has_sleeve_req {
            new_sleeve.clone()
        } else {
            old_sleeve
        };

        sqlx::query(
            "UPDATE collection_item SET media_condition = $1, sleeve_condition = $2 WHERE user_id = $3 AND record_id = $4"
        )
        .bind(&updated_media)
        .bind(&updated_sleeve)
        .bind(user.id)
        .bind(record_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

        // 4. Recalculate price suggestion if media condition changed or median price missing
        let current_median: Option<f64> = record_row.get("median_price");
        if (media_changed || current_median.is_none()) && dec_token.is_some() {
            let token = dec_token.as_deref().unwrap();
            let suggestions = discogs_client
                .get_price_suggestions(discogs_id, token)
                .await
                .unwrap_or_default();
            if let Some(sug) = extract_suggested_price(&suggestions, updated_media.as_deref()) {
                let _ = sqlx::query("UPDATE record_cache SET median_price = $1 WHERE id = $2")
                    .bind(sug)
                    .bind(record_id)
                    .execute(pool)
                    .await;
            }
        }

        // 5. Sync condition to Discogs if user has token and instance_id exists
        if let (true, Some(token), Some(inst_id), Some(discogs_user)) = (
            media_changed || sleeve_changed,
            dec_token.as_deref(),
            instance_id,
            user.discogs_username.as_deref(),
        ) {
            push_conditions(
                discogs_client,
                discogs_user,
                token,
                discogs_id,
                inst_id,
                updated_media.as_deref().filter(|_| media_changed),
                updated_sleeve.as_deref().filter(|_| sleeve_changed),
            )
            .await;
        }

        // Return updated record details
        Self::get_record_details(pool, discogs_client, crypto, user, record_id).await
    }

    /// Sets the custom sort string for all copies of a record in the user's collection; a
    /// missing or blank value resets it to the automatic artist sort key.
    pub async fn update_sort_key(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id_param: i64,
        req: UpdateSortKeyRequestDto,
    ) -> Result<RecordDetailDto, AppError> {
        let sort_key = req
            .sort_key
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        if sort_key
            .as_ref()
            .is_some_and(|s| s.chars().count() > MAX_SORT_KEY_LEN)
        {
            return Err(AppError::BadRequest(format!(
                "Sort key exceeds {MAX_SORT_KEY_LEN} characters"
            )));
        }

        let record_id: i64 = sqlx::query_scalar(
            "UPDATE collection_item ci SET sort_key = $1
             FROM record_cache rc
             WHERE rc.id = ci.record_id AND ci.user_id = $2 AND (rc.id = $3 OR rc.discogs_id = $3)
             RETURNING rc.id",
        )
        .bind(&sort_key)
        .bind(user.id)
        .bind(id_param)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| {
            AppError::NotFound(format!("Record is not in your collection (ID: {id_param})"))
        })?;

        Self::get_record_details(pool, discogs_client, crypto, user, record_id).await
    }
}

/// Writes the media and sleeve condition of a copy to its Discogs custom fields. Best effort:
/// failures are ignored, the local conditions stay authoritative.
pub async fn push_conditions(
    discogs_client: &DiscogsClient,
    discogs_user: &str,
    token: &str,
    discogs_id: i64,
    instance_id: i64,
    media: Option<&str>,
    sleeve: Option<&str>,
) {
    if media.is_none() && sleeve.is_none() {
        return;
    }
    let mut media_field_id = 1i64;
    let mut sleeve_field_id = 2i64;

    if let Ok(fields_res) = discogs_client
        .get_collection_fields(discogs_user, token)
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

    for (field_id, value) in [(media_field_id, media), (sleeve_field_id, sleeve)] {
        if let Some(val) = value {
            let _ = discogs_client
                .update_instance_field(discogs_user, discogs_id, instance_id, field_id, val, token)
                .await;
        }
    }
}
