use crate::{
    error::AppError,
    models::{
        collection::{BackupRelease, CollectionBackupRequest, ManualBackup, RestoreResultDto},
        record::ManualRecordRequest,
    },
    services::{
        export_service::BACKUP_FORMAT_VERSION,
        manual_record_service::{
            ManualRecordService, ValidatedManualRecord, normalize_cover, replace_genres,
            store_cover,
        },
        record_service::MAX_SORT_KEY_LEN,
        storage::{StorageService, backup::StorageBackupService},
    },
};
use base64::Engine;
use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::{PgPool, Postgres, Row, Transaction, types::Uuid};

/// Upper bound for releases per restore; keeps a single transaction reasonably small.
pub const MAX_RESTORE_RELEASES: usize = 20_000;

// Column limits from the schema (record_cache / collection_item)
const MAX_TEXT_LEN: usize = 255;
const MAX_CONDITION_LEN: usize = 50;
const MAX_FORMAT_LEN: usize = 100;
/// Covers are stored downscaled (800 px JPEG), so anything much larger is not ours.
const MAX_COVER_BYTES: usize = 2 * 1024 * 1024;

/// Data of a manual record from the backup, validated like a newly created one.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedManual {
    pub uid: Uuid,
    pub record: ValidatedManualRecord,
    /// Cover bytes as in the backup; re-encoded on restore
    pub cover: Option<Vec<u8>>,
}

/// A backup release after validation, ready to be written.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedRelease {
    pub discogs_id: i64,
    pub instance_id: i64,
    pub title: String,
    pub artist: Option<String>,
    pub release_year: Option<String>,
    pub thumb_url: Option<String>,
    pub format: String,
    pub genres: Vec<String>,
    pub lowest_price: Option<f64>,
    pub median_price: Option<f64>,
    pub added_at: NaiveDateTime,
    pub media_condition: Option<String>,
    pub sleeve_condition: Option<String>,
    pub sort_key: Option<String>,
    pub listens: Vec<NaiveDateTime>,
    /// Set for manual records; their IDs are replaced by local ones on restore
    pub manual: Option<ValidatedManual>,
}

pub struct CollectionRestoreService;

impl CollectionRestoreService {
    /// Parses and validates a JSON backup; every error is reported as 400 Problem Details.
    pub fn parse_backup(
        body: &[u8],
    ) -> Result<(CollectionBackupRequest, Vec<ValidatedRelease>), AppError> {
        let backup: CollectionBackupRequest = serde_json::from_slice(body)
            .map_err(|e| AppError::BadRequest(format!("Invalid backup file: {e}")))?;

        if let Some(version) = backup.format_version
            && version > BACKUP_FORMAT_VERSION
        {
            return Err(AppError::BadRequest(format!(
                "Unsupported backup format version {version} (supported: up to {BACKUP_FORMAT_VERSION})"
            )));
        }
        if backup.releases.len() > MAX_RESTORE_RELEASES {
            return Err(AppError::BadRequest(format!(
                "Backup contains {} releases; at most {MAX_RESTORE_RELEASES} can be restored at once",
                backup.releases.len()
            )));
        }

        if let Some(storage) = &backup.storage {
            StorageBackupService::validate(storage).map_err(|reason| {
                AppError::BadRequest(format!("Invalid backup storage: {reason}"))
            })?;
        }
        if let Some(alias) = backup
            .manual_aliases
            .iter()
            .find(|a| a.old_id >= 0 || a.instance_id <= 0)
        {
            return Err(AppError::BadRequest(format!(
                "Invalid manual alias {} -> {}: the old ID must be negative, the instance ID positive",
                alias.old_id, alias.instance_id
            )));
        }

        let now = Utc::now().naive_utc();
        let validated = backup
            .releases
            .iter()
            .enumerate()
            .map(|(idx, release)| {
                Self::validate_release(release, now).map_err(|reason| {
                    AppError::BadRequest(format!(
                        "Invalid backup entry #{} (Discogs ID {}): {reason}",
                        idx + 1,
                        release.id
                    ))
                })
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok((backup, validated))
    }

    fn validate_release(
        release: &BackupRelease,
        now: NaiveDateTime,
    ) -> Result<ValidatedRelease, String> {
        let manual = release
            .manual
            .as_ref()
            .map(|manual| validate_manual(release, manual))
            .transpose()?;
        if manual.is_none() {
            if release.id <= 0 {
                return Err("release ID must be positive".to_string());
            }
            if release.instance_id <= 0 {
                return Err("instance_id must be positive".to_string());
            }
        }

        let info = &release.basic_information;
        let title = info.title.trim();
        if title.is_empty() {
            return Err("title is empty".to_string());
        }
        if title.chars().count() > MAX_TEXT_LEN {
            return Err(format!("title exceeds {MAX_TEXT_LEN} characters"));
        }

        let artist = non_empty(info.artists.first().map(|a| a.name.as_str()));
        if artist
            .as_ref()
            .is_some_and(|a| a.chars().count() > MAX_TEXT_LEN)
        {
            return Err(format!("artist exceeds {MAX_TEXT_LEN} characters"));
        }

        let format = non_empty(info.format.as_deref()).unwrap_or_else(|| "LP".to_string());
        if format.chars().count() > MAX_FORMAT_LEN {
            return Err(format!("format exceeds {MAX_FORMAT_LEN} characters"));
        }

        let media_condition = non_empty(release.media_condition.as_deref());
        let sleeve_condition = non_empty(release.sleeve_condition.as_deref());
        if [&media_condition, &sleeve_condition].iter().any(|c| {
            c.as_ref()
                .is_some_and(|c| c.chars().count() > MAX_CONDITION_LEN)
        }) {
            return Err(format!("condition exceeds {MAX_CONDITION_LEN} characters"));
        }

        let sort_key = non_empty(release.sort_key.as_deref());
        if sort_key
            .as_ref()
            .is_some_and(|s| s.chars().count() > MAX_SORT_KEY_LEN)
        {
            return Err(format!("sort_key exceeds {MAX_SORT_KEY_LEN} characters"));
        }

        for price in [info.lowest_price, info.median_price].into_iter().flatten() {
            if !price.is_finite() || price < 0.0 {
                return Err(format!("invalid price {price}"));
            }
        }

        let added_at = match non_empty(release.date_added.as_deref()) {
            Some(value) => {
                parse_utc(&value).ok_or_else(|| format!("invalid date_added '{value}'"))?
            }
            None => now,
        };

        let listens = release
            .listen_history
            .iter()
            .flatten()
            .map(|value| {
                parse_utc(value).ok_or_else(|| format!("invalid listen timestamp '{value}'"))
            })
            .collect::<Result<Vec<_>, _>>()?;

        let mut genres: Vec<String> = info
            .genres
            .iter()
            .filter_map(|g| non_empty(Some(g)))
            .filter(|g| g.chars().count() <= MAX_TEXT_LEN)
            .collect();
        genres.sort();
        genres.dedup();

        Ok(ValidatedRelease {
            discogs_id: release.id,
            instance_id: release.instance_id,
            title: title.to_string(),
            artist,
            release_year: info.year.map(|y| y.to_string()),
            // Cosmetic only: an oversized URL is dropped instead of failing the restore
            thumb_url: non_empty(info.thumb_url.as_deref()).filter(|u| u.len() <= MAX_TEXT_LEN),
            format,
            genres,
            lowest_price: info.lowest_price,
            median_price: info.median_price,
            added_at,
            media_condition,
            sleeve_condition,
            sort_key,
            listens,
            manual,
        })
    }

    /// Merges the validated backup into the user's data in a single transaction.
    pub async fn restore(
        pool: &PgPool,
        user_id: i64,
        backup: &CollectionBackupRequest,
        releases: &[ValidatedRelease],
    ) -> Result<RestoreResultDto, AppError> {
        let listen_history_included = backup.releases.iter().any(|r| r.listen_history.is_some());
        let mut result = RestoreResultDto {
            format_version: backup.format_version.unwrap_or(1),
            records_total: releases.len(),
            records_added: 0,
            records_updated: 0,
            listens_added: 0,
            listens_skipped: 0,
            listen_history_included,
        };

        let mut tx = pool.begin().await.map_err(AppError::Database)?;

        Self::skip_backup_ids(&mut tx, backup, releases).await?;

        for alias in &backup.manual_aliases {
            sqlx::query(
                "INSERT INTO manual_record_alias (user_id, old_id, instance_id) VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, old_id) DO UPDATE SET instance_id = EXCLUDED.instance_id",
            )
            .bind(user_id)
            .bind(alias.old_id)
            .bind(alias.instance_id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        }

        for release in releases {
            let taken_over = match &release.manual {
                Some(manual) => {
                    Self::taken_over_copy(&mut tx, user_id, manual, release.instance_id).await?
                }
                None => None,
            };
            let (record_id, instance_id) = match (&release.manual, taken_over) {
                (_, Some(copy)) => copy,
                (Some(manual), None) => {
                    Self::upsert_manual_record(&mut tx, user_id, manual).await?
                }
                (None, None) => (
                    Self::upsert_record(&mut tx, release).await?,
                    release.instance_id,
                ),
            };

            // A taken-over copy keeps its current data; only listens are merged
            if taken_over.is_some() {
                result.records_updated += 1;
            } else if Self::upsert_collection_item(
                &mut tx,
                user_id,
                record_id,
                instance_id,
                release,
            )
            .await?
            {
                result.records_added += 1;
            } else {
                result.records_updated += 1;
            }

            for listened_at in &release.listens {
                let inserted = sqlx::query(
                    "INSERT INTO listen_event (user_id, record_id, timestamp)
                     SELECT $1, $2, $3
                     WHERE NOT EXISTS (
                         SELECT 1 FROM listen_event
                         WHERE user_id = $1 AND record_id = $2 AND timestamp = $3
                     )",
                )
                .bind(user_id)
                .bind(record_id)
                .bind(listened_at)
                .execute(&mut *tx)
                .await
                .map_err(AppError::Database)?
                .rows_affected();

                if inserted > 0 {
                    result.listens_added += 1;
                } else {
                    result.listens_skipped += 1;
                }
            }
        }

        if let Some(storage) = &backup.storage {
            StorageBackupService::restore(&mut tx, user_id, storage).await?;
        }

        tx.commit().await.map_err(AppError::Database)?;
        StorageService::commit_all(pool, user_id).await?;

        tracing::info!(
            "Collection restore for user {user_id}: added={}, updated={}, listens_added={}, listens_skipped={}",
            result.records_added,
            result.records_updated,
            result.listens_added,
            result.listens_skipped
        );

        Ok(result)
    }

    /// `record_cache` is shared by all users and kept fresh by Discogs, so a backup only fills gaps.
    async fn upsert_record(
        tx: &mut Transaction<'_, Postgres>,
        release: &ValidatedRelease,
    ) -> Result<i64, AppError> {
        let row = sqlx::query(
            "INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format, lowest_price, median_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (discogs_id)
             DO UPDATE SET title = COALESCE(record_cache.title, EXCLUDED.title),
                           artist = COALESCE(NULLIF(record_cache.artist, ''), EXCLUDED.artist),
                           release_year = COALESCE(record_cache.release_year, EXCLUDED.release_year),
                           thumb_url = COALESCE(record_cache.thumb_url, EXCLUDED.thumb_url),
                           format = COALESCE(record_cache.format, EXCLUDED.format),
                           lowest_price = COALESCE(record_cache.lowest_price, EXCLUDED.lowest_price),
                           median_price = COALESCE(record_cache.median_price, EXCLUDED.median_price)
             RETURNING id",
        )
        .bind(release.discogs_id)
        .bind(&release.title)
        .bind(&release.artist)
        .bind(&release.release_year)
        .bind(&release.thumb_url)
        .bind(&release.format)
        .bind(release.lowest_price)
        .bind(release.median_price)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;
        let record_id: i64 = row.get("id");

        if !release.genres.is_empty() {
            sqlx::query(
                "INSERT INTO record_genres (record_id, genre)
                 SELECT $1, genre FROM UNNEST($2::varchar[]) AS genre
                 WHERE NOT EXISTS (SELECT 1 FROM record_genres WHERE record_id = $1)",
            )
            .bind(record_id)
            .bind(&release.genres)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        }

        Ok(record_id)
    }

    /// A manual record is matched by its UUID among the user's own records, not by its ID
    /// (negative IDs are only unique per instance): an existing one is updated from the backup, a
    /// missing one gets a new local ID. A UUID that belongs to another user gets a new UUID, so a
    /// backup never touches someone else's record. Returns the record ID and its instance ID
    /// (the same negative ID).
    async fn upsert_manual_record(
        tx: &mut Transaction<'_, Postgres>,
        user_id: i64,
        manual: &ValidatedManual,
    ) -> Result<(i64, i64), AppError> {
        let record = &manual.record;
        let existing: Option<(i64, i64, i64)> = sqlx::query_as(
            "SELECT id, discogs_id, owner_id FROM record_cache WHERE manual_uid = $1",
        )
        .bind(manual.uid)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        let (record_id, local_id) = match existing {
            Some((id, local_id, owner_id)) if owner_id == user_id => {
                sqlx::query(
                    "UPDATE record_cache
                     SET title = $2, artist = $3, release_year = $4, format = $5, label = $6,
                         catno = $7, country = $8, barcode = $9, notes = $10, median_price = $11
                     WHERE id = $1",
                )
                .bind(id)
                .bind(&record.title)
                .bind(&record.artist)
                .bind(&record.year)
                .bind(&record.format)
                .bind(&record.label)
                .bind(&record.catno)
                .bind(&record.country)
                .bind(&record.barcode)
                .bind(&record.notes)
                .bind(record.value)
                .execute(&mut **tx)
                .await
                .map_err(AppError::Database)?;
                (id, local_id)
            }
            other => {
                let uid = other.is_none().then_some(manual.uid);
                let row: (i64, i64) = sqlx::query_as(
                    "INSERT INTO record_cache (discogs_id, source, manual_uid, owner_id, title, artist,
                                               release_year, format, label, catno, country, barcode,
                                               notes, median_price)
                     VALUES (nextval('manual_record_seq'), 'manual', COALESCE($1, gen_random_uuid()),
                             $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                     RETURNING id, discogs_id",
                )
                .bind(uid)
                .bind(user_id)
                .bind(&record.title)
                .bind(&record.artist)
                .bind(&record.year)
                .bind(&record.format)
                .bind(&record.label)
                .bind(&record.catno)
                .bind(&record.country)
                .bind(&record.barcode)
                .bind(&record.notes)
                .bind(record.value)
                .fetch_one(&mut **tx)
                .await
                .map_err(AppError::Database)?;
                row
            }
        };

        replace_genres(tx, record_id, &record.genres).await?;
        if let Some(cover) = &manual.cover {
            // Re-encoded like an upload: downscaled and without metadata, as it is served publicly
            let jpeg = normalize_cover(cover.clone().into()).await?;
            store_cover(tx, record_id, &jpeg, "image/jpeg").await?;
        }
        Ok((record_id, local_id))
    }

    /// Moves `manual_record_seq` below every negative ID in the backup, so manual records created
    /// by this restore never get the old ID of another record: an alias or a printed QR label
    /// would otherwise point to the wrong record.
    async fn skip_backup_ids(
        tx: &mut Transaction<'_, Postgres>,
        backup: &CollectionBackupRequest,
        releases: &[ValidatedRelease],
    ) -> Result<(), AppError> {
        let lowest = releases
            .iter()
            .filter(|r| r.manual.is_some())
            .map(|r| r.instance_id)
            .chain(backup.manual_aliases.iter().map(|a| a.old_id))
            .min();
        if let Some(lowest) = lowest.filter(|id| *id < 0) {
            // A decreasing sequence continues below `last_value` once it was called
            sqlx::query(
                "SELECT setval('manual_record_seq',
                               LEAST($1, CASE WHEN is_called THEN last_value ELSE last_value + 1 END),
                               true)
                 FROM manual_record_seq",
            )
            .bind(lowest)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        }
        Ok(())
    }

    /// The Discogs copy a manual record of an older backup became (#243): its UUID is gone and
    /// its old ID is an alias of an existing copy. Returns the record and instance ID.
    async fn taken_over_copy(
        tx: &mut Transaction<'_, Postgres>,
        user_id: i64,
        manual: &ValidatedManual,
        old_id: i64,
    ) -> Result<Option<(i64, i64)>, AppError> {
        let own: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM record_cache WHERE manual_uid = $1 AND owner_id = $2)",
        )
        .bind(manual.uid)
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;
        if own {
            return Ok(None);
        }
        sqlx::query_as(
            "SELECT ci.record_id, ci.instance_id
             FROM manual_record_alias a
             JOIN collection_item ci ON ci.user_id = a.user_id AND ci.instance_id = a.instance_id
             WHERE a.user_id = $1 AND a.old_id = $2",
        )
        .bind(user_id)
        .bind(old_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)
    }

    /// Returns `true` if the item was newly added. Conditions and the sort string from the
    /// backup win, missing ones keep the stored value; `added_at` of existing items is preserved.
    async fn upsert_collection_item(
        tx: &mut Transaction<'_, Postgres>,
        user_id: i64,
        record_id: i64,
        instance_id: i64,
        release: &ValidatedRelease,
    ) -> Result<bool, AppError> {
        let row = sqlx::query(
            "INSERT INTO collection_item (user_id, record_id, instance_id, added_at, media_condition, sleeve_condition, sort_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, instance_id)
             DO UPDATE SET media_condition = COALESCE(EXCLUDED.media_condition, collection_item.media_condition),
                           sleeve_condition = COALESCE(EXCLUDED.sleeve_condition, collection_item.sleeve_condition),
                           sort_key = COALESCE(EXCLUDED.sort_key, collection_item.sort_key)
             RETURNING (xmax = 0) AS inserted",
        )
        .bind(user_id)
        .bind(record_id)
        .bind(instance_id)
        .bind(release.added_at)
        .bind(&release.media_condition)
        .bind(&release.sleeve_condition)
        .bind(&release.sort_key)
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(row.get("inserted"))
    }
}

/// Applies the rules of a newly created manual record (formats, year, genres, lengths).
fn validate_manual(
    release: &BackupRelease,
    manual: &ManualBackup,
) -> Result<ValidatedManual, String> {
    let uid = manual
        .manual_uid
        .trim()
        .parse::<Uuid>()
        .map_err(|_| format!("invalid manualUid '{}'", manual.manual_uid))?;
    let info = &release.basic_information;
    let request = ManualRecordRequest {
        artist: info
            .artists
            .first()
            .map(|a| a.name.clone())
            .unwrap_or_default(),
        title: info.title.clone(),
        format: info.format.clone().unwrap_or_else(|| "LP".to_string()),
        year: info.year.map(|y| y.to_string()),
        label: manual.label.clone(),
        catno: manual.catno.clone(),
        country: manual.country.clone(),
        barcode: manual.barcode.clone(),
        genres: info.genres.clone(),
        media_condition: release.media_condition.clone(),
        sleeve_condition: release.sleeve_condition.clone(),
        notes: manual.notes.clone(),
        value: info.median_price,
        label_photo_id: None,
    };
    let record = ManualRecordService::validate(&request).map_err(|e| match e {
        AppError::BadRequest(m) => m,
        other => other.to_string(),
    })?;
    let cover = match &manual.cover {
        Some(encoded) => {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(encoded.trim())
                .map_err(|e| format!("invalid cover: {e}"))?;
            if bytes.len() > MAX_COVER_BYTES {
                return Err(format!("cover exceeds {MAX_COVER_BYTES} bytes"));
            }
            Some(bytes)
        }
        None => None,
    };
    Ok(ValidatedManual { uid, record, cover })
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

fn parse_utc(value: &str) -> Option<NaiveDateTime> {
    DateTime::parse_from_rfc3339(value.trim())
        .ok()
        .map(|dt| dt.with_timezone(&Utc).naive_utc())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    type ParseResult = Result<(CollectionBackupRequest, Vec<ValidatedRelease>), AppError>;

    fn backup_release() -> Value {
        json!({
            "id": 249504,
            "instance_id": 1001,
            "listen_count": 2,
            "date_added": "2026-04-10T12:00:00Z",
            "rating": null,
            "media_condition": "Near Mint (NM or M-)",
            "sleeve_condition": " ",
            "sort_key": " Mac, Fleetwood ",
            "last_played_at": "2026-04-12T15:30:00Z",
            "notes": [],
            "basic_information": {
                "id": 249504,
                "title": " Rumours ",
                "artists": [{ "name": "Fleetwood Mac", "id": null }],
                "year": 1977,
                "thumb": "https://i.discogs.com/thumb.jpg",
                "cover_image": null,
                "genres": ["Rock", "Pop", "Rock", ""],
                "styles": [],
                "format": "LP",
                "lowest_price": 20.0,
                "median_price": null
            },
            "listen_history": ["2026-04-01T20:00:00.000000Z", "2026-04-12T17:30:00.123456+02:00"]
        })
    }

    fn parse(releases: Value) -> ParseResult {
        let body = json!({ "format_version": 2, "username": "u", "releases": releases });
        CollectionRestoreService::parse_backup(&serde_json::to_vec(&body).unwrap())
    }

    fn bad_request_detail(result: ParseResult) -> String {
        match result {
            Err(AppError::BadRequest(detail)) => detail,
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_backup_normalizes_release() {
        let (backup, releases) = parse(json!([backup_release()])).expect("valid backup");
        assert_eq!(backup.format_version, Some(2));

        let r = &releases[0];
        assert_eq!(r.discogs_id, 249504);
        assert_eq!(r.instance_id, 1001);
        assert_eq!(r.title, "Rumours");
        assert_eq!(r.artist.as_deref(), Some("Fleetwood Mac"));
        assert_eq!(r.release_year.as_deref(), Some("1977"));
        assert_eq!(r.format, "LP");
        assert_eq!(r.genres, vec!["Pop", "Rock"]);
        assert_eq!(r.media_condition.as_deref(), Some("Near Mint (NM or M-)"));
        assert_eq!(
            r.sleeve_condition, None,
            "blank conditions are treated as missing"
        );
        assert_eq!(r.sort_key.as_deref(), Some("Mac, Fleetwood"));
        assert_eq!(r.added_at.to_string(), "2026-04-10 12:00:00");
        // Offsets are normalized to UTC, microseconds are kept
        assert_eq!(r.listens[0].to_string(), "2026-04-01 20:00:00");
        assert_eq!(r.listens[1].to_string(), "2026-04-12 15:30:00.123456");
    }

    #[test]
    fn test_parse_backup_accepts_version_1_without_history() {
        let mut release = backup_release();
        release.as_object_mut().unwrap().remove("listen_history");
        release["date_added"] = Value::Null;
        release["basic_information"]["format"] = Value::Null;
        let body = json!({ "exported_at": "2026-04-10T12:00:00Z", "releases": [release] });

        let (backup, releases) =
            CollectionRestoreService::parse_backup(&serde_json::to_vec(&body).unwrap())
                .expect("version 1 backup");
        assert_eq!(backup.format_version, None);
        assert!(backup.releases[0].listen_history.is_none());
        assert!(releases[0].listens.is_empty());
        assert_eq!(releases[0].format, "LP", "missing format falls back to LP");
    }

    #[test]
    fn test_parse_backup_rejects_invalid_json_and_newer_versions() {
        let detail = bad_request_detail(CollectionRestoreService::parse_backup(b"not json"));
        assert!(detail.starts_with("Invalid backup file"), "{detail}");

        let detail = bad_request_detail(CollectionRestoreService::parse_backup(
            br#"{"username":"u"}"#,
        ));
        assert!(detail.contains("releases"), "{detail}");

        let body = json!({ "format_version": 6, "releases": [] });
        let detail = bad_request_detail(CollectionRestoreService::parse_backup(
            &serde_json::to_vec(&body).unwrap(),
        ));
        assert!(
            detail.contains("Unsupported backup format version 6"),
            "{detail}"
        );
    }

    #[test]
    fn test_parse_backup_rejects_invalid_entries() {
        type Mutation = fn(&mut Value);
        let cases: Vec<(Mutation, &str)> = vec![
            (|r| r["id"] = json!(0), "release ID must be positive"),
            (
                |r| r["instance_id"] = json!(-1),
                "instance_id must be positive",
            ),
            (
                |r| r["basic_information"]["title"] = json!("  "),
                "title is empty",
            ),
            (
                |r| r["basic_information"]["title"] = json!("x".repeat(256)),
                "title exceeds",
            ),
            (
                |r| r["media_condition"] = json!("x".repeat(51)),
                "condition exceeds",
            ),
            (
                |r| r["sort_key"] = json!("x".repeat(201)),
                "sort_key exceeds",
            ),
            (
                |r| r["basic_information"]["lowest_price"] = json!(-1.0),
                "invalid price",
            ),
            (
                |r| r["date_added"] = json!("yesterday"),
                "invalid date_added",
            ),
            (
                |r| r["listen_history"] = json!(["2026-13-01T00:00:00Z"]),
                "invalid listen timestamp",
            ),
        ];

        for (mutate, expected) in cases {
            let mut release = backup_release();
            mutate(&mut release);
            let detail = bad_request_detail(parse(json!([backup_release(), release])));
            assert!(detail.contains("Invalid backup entry #2"), "{detail}");
            assert!(
                detail.contains(expected),
                "expected '{expected}' in '{detail}'"
            );
        }
    }

    #[test]
    fn test_parse_backup_drops_oversized_thumb_url() {
        let mut release = backup_release();
        release["basic_information"]["thumb"] = json!(format!("https://x/{}", "a".repeat(300)));
        let (_, releases) = parse(json!([release])).expect("valid backup");
        assert_eq!(releases[0].thumb_url, None);
    }

    fn manual_release() -> Value {
        let mut release = backup_release();
        release["id"] = json!(-3);
        release["instance_id"] = json!(-3);
        release["media_condition"] = json!("NM");
        release["manual"] = json!({
            "manualUid": "6f1c2b0e-8a8e-4c55-9d43-1f5d2a7e9b10",
            "catno": " SB 001 ",
            "notes": "",
            "cover": "/9j/4AAQ",
            "coverMimeType": "image/jpeg"
        });
        release
    }

    #[test]
    fn test_parse_backup_accepts_manual_records_with_negative_ids() {
        let (_, releases) = parse(json!([manual_release()])).expect("valid manual record");
        let manual = releases[0].manual.as_ref().unwrap();
        assert_eq!(
            manual.uid.to_string(),
            "6f1c2b0e-8a8e-4c55-9d43-1f5d2a7e9b10"
        );
        assert_eq!(manual.record.catno.as_deref(), Some("SB 001"));
        assert_eq!(manual.record.notes, None);
        assert_eq!(manual.record.artist, "Fleetwood Mac");
        assert_eq!(
            manual.record.media_condition.as_deref(),
            Some("Near Mint (NM or M-)")
        );
        assert_eq!(manual.cover, Some(vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]));
    }

    #[test]
    fn test_parse_backup_rejects_invalid_manual_records() {
        type Mutation = fn(&mut Value);
        let cases: Vec<(Mutation, &str)> = vec![
            (
                |r| r["manual"]["manualUid"] = json!("abc"),
                "invalid manualUid",
            ),
            (|r| r["manual"]["cover"] = json!("***"), "invalid cover"),
            (
                |r| r["manual"]["barcode"] = json!("1".repeat(51)),
                "barcode exceeds",
            ),
            // The rules of newly created manual records apply
            (
                |r| r["basic_information"]["format"] = json!("Cassette"),
                "Invalid format",
            ),
            (
                |r| {
                    r["basic_information"]["genres"] =
                        json!((0..11).map(|i| format!("g{i}")).collect::<Vec<_>>())
                },
                "At most 10 genres",
            ),
        ];
        for (mutate, expected) in cases {
            let mut release = manual_release();
            mutate(&mut release);
            let detail = bad_request_detail(parse(json!([release])));
            assert!(
                detail.contains(expected),
                "expected '{expected}' in '{detail}'"
            );
        }
    }

    #[test]
    fn test_parse_backup_limits_release_count() {
        let releases = vec![backup_release(); MAX_RESTORE_RELEASES + 1];
        let detail = bad_request_detail(parse(Value::Array(releases)));
        assert!(detail.contains("at most 20000"), "{detail}");
    }
}
