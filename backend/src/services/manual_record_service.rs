//! Manual records without a Discogs entry (#242, ADR-0023).
//!
//! They live in `record_cache` with `source = 'manual'` and a negative ID from
//! `manual_record_seq`, used as both `discogs_id` and `instance_id`. That keeps collection,
//! shelves, statistics, print and MCP working unchanged, while every Discogs call skips them.

use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        collection::ManualBackup,
        record::{ManualRecordCreatedDto, ManualRecordRequest, RecordDetailDto},
        user::AppUser,
    },
    services::{
        crypto_service::CryptoService, label_photo_service::LabelPhotoService,
        marketplace::validate_goldmine_condition, record_genres::replace_genres,
        record_service::RecordService, storage::StorageService,
    },
};
use base64::Engine;
use bytes::Bytes;
use chrono::Utc;
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::collections::HashMap;

/// Formats a manual record can have; the same labels Discogs releases are mapped to.
pub const MANUAL_FORMATS: [&str; 4] = ["LP", "Double LP", "CD", "Double CD"];
/// Longest edge of a stored cover; enough for the detail view and the PDF catalog.
pub const COVER_MAX_EDGE_PX: u32 = 800;
pub const MAX_GENRES: usize = 10;
const MAX_TEXT_LEN: usize = 255;
const MAX_SHORT_TEXT_LEN: usize = 100;
const MAX_BARCODE_LEN: usize = 50;
const MAX_NOTES_LEN: usize = 2000;
const MAX_VALUE: f64 = 100_000.0;
/// Public cover path; the UUID is not guessable, so `<img>` tags work without the auth cookie.
pub const COVER_PATH: &str = "/api/covers/";
const COVER_MIME_TYPE: &str = "image/jpeg";

/// A manual record request after validation and normalization.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedManualRecord {
    pub artist: String,
    pub title: String,
    pub format: String,
    pub year: Option<String>,
    pub label: Option<String>,
    pub catno: Option<String>,
    pub country: Option<String>,
    pub barcode: Option<String>,
    pub genres: Vec<String>,
    pub media_condition: Option<String>,
    pub sleeve_condition: Option<String>,
    pub notes: Option<String>,
    pub value: Option<f64>,
}

pub struct ManualRecordService;

impl ManualRecordService {
    pub fn validate(req: &ManualRecordRequest) -> Result<ValidatedManualRecord, AppError> {
        let bad = |m: String| AppError::BadRequest(m);
        let required = |value: &str, field: &str| {
            let value = value.trim();
            if value.is_empty() {
                return Err(bad(format!("{field} is required")));
            }
            check_len(Some(value.to_string()), field, MAX_TEXT_LEN).map(|v| v.unwrap_or_default())
        };

        let format = MANUAL_FORMATS
            .iter()
            .find(|f| f.eq_ignore_ascii_case(req.format.trim()))
            .ok_or_else(|| {
                bad(format!(
                    "Invalid format '{}'. Allowed: {}",
                    req.format,
                    MANUAL_FORMATS.join(", ")
                ))
            })?;

        let year = optional(req.year.as_deref());
        if let Some(y) = &year
            && !(y.len() == 4 && y.chars().all(|c| c.is_ascii_digit()))
        {
            return Err(bad(format!("Invalid year '{y}'")));
        }

        // Scanners deliver the barcode without spaces, so it is stored that way
        let barcode = optional(req.barcode.as_deref())
            .map(|b| b.chars().filter(|c| !c.is_whitespace()).collect::<String>());

        let condition = |value: Option<&str>| -> Result<Option<String>, AppError> {
            optional(value)
                .map(|c| validate_goldmine_condition(&c).map(str::to_string))
                .transpose()
        };

        if let Some(v) = req.value
            && (!v.is_finite() || !(0.0..=MAX_VALUE).contains(&v))
        {
            return Err(bad(format!("Invalid value {v}")));
        }

        let mut genres: Vec<String> = req
            .genres
            .iter()
            .filter_map(|g| optional(Some(g)))
            .collect();
        genres.sort();
        genres.dedup();
        if genres.len() > MAX_GENRES {
            return Err(bad(format!("At most {MAX_GENRES} genres are allowed")));
        }
        if genres.iter().any(|g| g.chars().count() > MAX_TEXT_LEN) {
            return Err(bad(format!("genre exceeds {MAX_TEXT_LEN} characters")));
        }

        Ok(ValidatedManualRecord {
            artist: required(&req.artist, "artist")?,
            title: required(&req.title, "title")?,
            format: format.to_string(),
            year,
            label: check_len(optional(req.label.as_deref()), "label", MAX_TEXT_LEN)?,
            catno: check_len(optional(req.catno.as_deref()), "catno", MAX_SHORT_TEXT_LEN)?,
            country: check_len(
                optional(req.country.as_deref()),
                "country",
                MAX_SHORT_TEXT_LEN,
            )?,
            barcode: check_len(barcode, "barcode", MAX_BARCODE_LEN)?,
            genres,
            media_condition: condition(req.media_condition.as_deref())?,
            sleeve_condition: condition(req.sleeve_condition.as_deref())?,
            notes: check_len(optional(req.notes.as_deref()), "notes", MAX_NOTES_LEN)?,
            value: req.value,
        })
    }

    /// Creates a manual record in the user's collection and places it on the shelf. With
    /// `label_photo_id` the label photo becomes the cover and the photo is completed.
    pub async fn create(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        req: ManualRecordRequest,
    ) -> Result<ManualRecordCreatedDto, AppError> {
        let record = Self::validate(&req)?;
        let photo = match req.label_photo_id {
            Some(photo_id) => {
                let image = pending_label_photo(pool, user.id, photo_id).await?;
                Some((photo_id, normalize_cover(image.into()).await?))
            }
            None => None,
        };

        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        let row = sqlx::query(
            "INSERT INTO record_cache (discogs_id, source, manual_uid, owner_id, title, artist,
                                       release_year, format, label, catno, country, barcode, notes,
                                       median_price)
             VALUES (nextval('manual_record_seq'), 'manual', gen_random_uuid(), $11,
                     $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, discogs_id",
        )
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
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        let record_id: i64 = row.get("id");
        let discogs_id: i64 = row.get("discogs_id");

        replace_genres(&mut *tx, record_id, &record.genres).await?;
        sqlx::query(
            "INSERT INTO collection_item (user_id, record_id, instance_id, added_at, media_condition, sleeve_condition)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(user.id)
        .bind(record_id)
        .bind(discogs_id)
        .bind(Utc::now().naive_utc())
        .bind(&record.media_condition)
        .bind(&record.sleeve_condition)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        if let Some((photo_id, cover)) = &photo {
            store_cover(&mut tx, record_id, cover, COVER_MIME_TYPE).await?;
            sqlx::query(
                "UPDATE label_photo
                 SET status = 'identified', discogs_id = $3, record_id = $4,
                     processed_at = NOW() AT TIME ZONE 'UTC'
                 WHERE id = $1 AND user_id = $2",
            )
            .bind(photo_id)
            .bind(user.id)
            .bind(discogs_id)
            .bind(record_id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        }
        tx.commit().await.map_err(AppError::Database)?;

        tracing::info!(
            "Created manual record {discogs_id} for user {}: {} - {}",
            user.id,
            record.artist,
            record.title
        );

        let placement =
            StorageService::place_new_copy(pool, user.id, discogs_id, discogs_id).await?;
        let record =
            RecordService::get_record_details(pool, discogs_client, crypto, user, discogs_id)
                .await?;
        Ok(ManualRecordCreatedDto { record, placement })
    }

    /// Updates a manual record of the user; Discogs releases cannot be edited.
    pub async fn update(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
        req: ManualRecordRequest,
    ) -> Result<RecordDetailDto, AppError> {
        let record = Self::validate(&req)?;
        let (record_id, local_id) = Self::owned_record(pool, user.id, id).await?;
        // Only artist, year, title and format move a record on the shelf
        let shelf_key: (
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ) = sqlx::query_as(
            "SELECT artist, release_year, title, format FROM record_cache WHERE id = $1",
        )
        .bind(record_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        let moves = shelf_key
            != (
                Some(record.artist.clone()),
                record.year.clone(),
                Some(record.title.clone()),
                Some(record.format.clone()),
            );

        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        sqlx::query(
            "UPDATE record_cache
             SET title = $2, artist = $3, release_year = $4, format = $5, label = $6, catno = $7,
                 country = $8, barcode = $9, notes = $10, median_price = $11
             WHERE id = $1",
        )
        .bind(record_id)
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
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        replace_genres(&mut *tx, record_id, &record.genres).await?;
        sqlx::query(
            "UPDATE collection_item SET media_condition = $3, sleeve_condition = $4
             WHERE user_id = $1 AND record_id = $2",
        )
        .bind(user.id)
        .bind(record_id)
        .bind(&record.media_condition)
        .bind(&record.sleeve_condition)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        tx.commit().await.map_err(AppError::Database)?;

        if moves {
            StorageService::commit_all(pool, user.id).await?;
        }
        RecordService::get_record_details(pool, discogs_client, crypto, user, local_id).await
    }

    /// Replaces the cover of a manual record with an uploaded JPEG/PNG (downscaled, no EXIF).
    pub async fn set_cover(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        id: i64,
        upload: Bytes,
    ) -> Result<RecordDetailDto, AppError> {
        let (record_id, local_id) = Self::owned_record(pool, user.id, id).await?;
        let jpeg = normalize_cover(upload).await?;

        let mut tx = pool.begin().await.map_err(AppError::Database)?;
        store_cover(&mut tx, record_id, &jpeg, COVER_MIME_TYPE).await?;
        tx.commit().await.map_err(AppError::Database)?;
        RecordService::get_record_details(pool, discogs_client, crypto, user, local_id).await
    }

    /// The cover image of a manual record by its public UUID.
    pub async fn cover(pool: &PgPool, uid: &str) -> Result<(Vec<u8>, String), AppError> {
        let not_found = || AppError::NotFound("Cover not found".to_string());
        // Anything that is not a UUID cannot match and must not reach the cast
        let uid = uid.parse::<sqlx::types::Uuid>().map_err(|_| not_found())?;
        let row = sqlx::query(
            "SELECT c.image, c.mime_type FROM record_cover c
             JOIN record_cache rc ON rc.id = c.record_id
             WHERE rc.manual_uid = $1",
        )
        .bind(uid)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(not_found)?;
        Ok((row.get("image"), row.get("mime_type")))
    }

    /// Backup data of the user's manual records by their (negative) ID, covers as Base64.
    pub async fn backup_data(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<HashMap<i64, ManualBackup>, AppError> {
        let rows = sqlx::query(
            "SELECT rc.discogs_id, rc.manual_uid::text AS manual_uid, rc.label, rc.catno,
                    rc.country, rc.barcode, rc.notes, c.image, c.mime_type
             FROM record_cache rc
             JOIN collection_item ci ON ci.record_id = rc.id
             LEFT JOIN record_cover c ON c.record_id = rc.id
             WHERE ci.user_id = $1 AND rc.source = 'manual'",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;

        Ok(rows
            .into_iter()
            .map(|row| {
                let image: Option<Vec<u8>> = row.get("image");
                let backup = ManualBackup {
                    manual_uid: row.get("manual_uid"),
                    label: row.get("label"),
                    catno: row.get("catno"),
                    country: row.get("country"),
                    barcode: row.get("barcode"),
                    notes: row.get("notes"),
                    cover: image
                        .map(|bytes| base64::engine::general_purpose::STANDARD.encode(bytes)),
                    cover_mime_type: row.get("mime_type"),
                };
                (row.get("discogs_id"), backup)
            })
            .collect())
    }

    /// Covers of the user's manual records by their (negative) ID, e.g. for the PDF catalog.
    pub async fn covers(pool: &PgPool, user_id: i64) -> Result<HashMap<i64, Vec<u8>>, AppError> {
        let rows: Vec<(i64, Vec<u8>)> = sqlx::query_as(
            "SELECT rc.discogs_id, c.image
             FROM record_cover c
             JOIN record_cache rc ON rc.id = c.record_id
             JOIN collection_item ci ON ci.record_id = rc.id
             WHERE ci.user_id = $1",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(rows.into_iter().collect())
    }

    /// Row ID and negative ID of a manual record of the user (by negative ID).
    async fn owned_record(pool: &PgPool, user_id: i64, id: i64) -> Result<(i64, i64), AppError> {
        sqlx::query_as(
            "SELECT id, discogs_id FROM record_cache
             WHERE owner_id = $1 AND discogs_id = $2 AND source = 'manual'",
        )
        .bind(user_id)
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| {
            AppError::NotFound(format!("Manual record {id} not found in your collection"))
        })
    }
}

/// Stores the cover and points `thumb_url` at its public URL. The version parameter changes
/// with every upload, so browsers and the service worker never show a stale cover.
pub async fn store_cover(
    tx: &mut Transaction<'_, Postgres>,
    record_id: i64,
    image: &[u8],
    mime_type: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO record_cover (record_id, image, mime_type) VALUES ($1, $2, $3)
         ON CONFLICT (record_id) DO UPDATE SET image = EXCLUDED.image, mime_type = EXCLUDED.mime_type",
    )
    .bind(record_id)
    .bind(image)
    .bind(mime_type)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "UPDATE record_cache SET thumb_url = $2 || manual_uid::text || '?v=' || $3 WHERE id = $1",
    )
    .bind(record_id)
    .bind(COVER_PATH)
    .bind(Utc::now().timestamp_millis().to_string())
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// The image of a label photo that is still open; a completed photo must not become the cover
/// of a second record.
async fn pending_label_photo(
    pool: &PgPool,
    user_id: i64,
    photo_id: i64,
) -> Result<Vec<u8>, AppError> {
    let row: Option<(Vec<u8>, String)> =
        sqlx::query_as("SELECT image, status FROM label_photo WHERE id = $1 AND user_id = $2")
            .bind(photo_id)
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    match row {
        None => Err(AppError::NotFound(format!(
            "Label photo {photo_id} not found"
        ))),
        Some((_, status)) if status != "pending" => Err(AppError::Conflict(format!(
            "Label photo {photo_id} is already completed"
        ))),
        Some((image, _)) => Ok(image),
    }
}

/// Downscales a cover off the async workers (decoding a phone photo takes a while).
pub async fn normalize_cover(upload: Bytes) -> Result<Vec<u8>, AppError> {
    tokio::task::spawn_blocking(move || {
        LabelPhotoService::normalize_image_to(&upload, COVER_MAX_EDGE_PX)
    })
    .await
    .map_err(|e| AppError::Internal(format!("Cover processing failed: {e}")))?
}

fn optional(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

fn check_len(value: Option<String>, field: &str, max: usize) -> Result<Option<String>, AppError> {
    if value.as_ref().is_some_and(|v| v.chars().count() > max) {
        return Err(AppError::BadRequest(format!(
            "{field} exceeds {max} characters"
        )));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> ManualRecordRequest {
        ManualRecordRequest {
            artist: " Die Sterne ".to_string(),
            title: "Posen".to_string(),
            format: "lp".to_string(),
            year: Some("1996".to_string()),
            barcode: Some(" 4 006381 333931 ".to_string()),
            genres: vec!["Rock".into(), " ".into(), "Pop".into(), "Rock".into()],
            media_condition: Some("vg+".to_string()),
            sleeve_condition: Some("  ".to_string()),
            value: Some(25.0),
            ..Default::default()
        }
    }

    fn bad_request(req: ManualRecordRequest) -> String {
        match ManualRecordService::validate(&req) {
            Err(AppError::BadRequest(detail)) => detail,
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[test]
    fn validate_normalizes_the_request() {
        let record = ManualRecordService::validate(&request()).unwrap();
        assert_eq!(record.artist, "Die Sterne");
        assert_eq!(record.format, "LP");
        assert_eq!(record.barcode.as_deref(), Some("4006381333931"));
        assert_eq!(record.genres, ["Pop", "Rock"]);
        assert_eq!(
            record.media_condition.as_deref(),
            Some("Very Good Plus (VG+)")
        );
        assert_eq!(record.sleeve_condition, None);
        assert_eq!(record.value, Some(25.0));
    }

    #[test]
    fn validate_rejects_invalid_fields() {
        type Mutation = fn(&mut ManualRecordRequest);
        let cases: Vec<(Mutation, &str)> = vec![
            (|r| r.artist = "  ".into(), "artist is required"),
            (|r| r.title = String::new(), "title is required"),
            (|r| r.title = "x".repeat(256), "title exceeds 255"),
            (|r| r.format = "Cassette".into(), "Invalid format"),
            (|r| r.year = Some("96".into()), "Invalid year"),
            (|r| r.value = Some(-1.0), "Invalid value"),
            (|r| r.value = Some(f64::NAN), "Invalid value"),
            (
                |r| r.media_condition = Some("great".into()),
                "Invalid Goldmine",
            ),
            (|r| r.barcode = Some("1".repeat(51)), "barcode exceeds"),
            (
                |r| r.genres = (0..11).map(|i| format!("g{i}")).collect(),
                "At most 10 genres",
            ),
        ];
        for (mutate, expected) in cases {
            let mut req = request();
            mutate(&mut req);
            let detail = bad_request(req);
            assert!(
                detail.contains(expected),
                "expected '{expected}' in '{detail}'"
            );
        }
    }
}
