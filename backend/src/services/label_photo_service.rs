use crate::{
    error::AppError,
    models::label_photo::{
        LabelIdentifyState, LabelPhotoDeleteDto, LabelPhotoDto, LabelPhotoStatus,
        LabelPhotoUploadDto, LabelPhotosDto, LabelReading, LabelSuggestion,
    },
};
use bytes::Bytes;
use chrono::NaiveDateTime;
use image::{DynamicImage, ImageDecoder, ImageReader, codecs::jpeg::JpegEncoder};
use sqlx::types::Json;
use sqlx::{PgPool, Row, postgres::PgRow};
use std::io::Cursor;

/// Longest edge of a stored label photo; enough for Claude to read small label print.
pub const MAX_EDGE_PX: u32 = 1568;
const JPEG_QUALITY: u8 = 85;
const STORED_MIME_TYPE: &str = "image/jpeg";
/// Columns of [`to_dto`].
const DTO_COLUMNS: &str = "id, status, discogs_id, created_at, processed_at, identify_state, \
                           suggestion, identify_error, identify_model, label_reading";

/// Result of a finished identification run: a suggestion, or none with the model's hint
/// (no Discogs release matched). The label reading is kept in both cases.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct IdentifyOutcome {
    pub suggestion: Option<LabelSuggestion>,
    pub reading: Option<LabelReading>,
    pub no_match_hint: Option<String>,
}

pub struct LabelPhotoService;

impl LabelPhotoService {
    /// Decodes an uploaded JPEG/PNG, applies its EXIF orientation, downscales it to
    /// [`MAX_EDGE_PX`] and re-encodes it as JPEG. Re-encoding drops all metadata (EXIF/GPS).
    pub fn normalize_image(bytes: &[u8]) -> Result<Vec<u8>, AppError> {
        Self::normalize_image_to(bytes, MAX_EDGE_PX)
    }

    /// Like [`Self::normalize_image`] with a custom longest edge (e.g. record covers).
    pub fn normalize_image_to(bytes: &[u8], max_edge: u32) -> Result<Vec<u8>, AppError> {
        let invalid = |e: image::ImageError| AppError::BadRequest(format!("Invalid image: {e}"));

        let mut decoder = ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .map_err(|e| AppError::BadRequest(format!("Invalid image: {e}")))?
            .into_decoder()
            .map_err(invalid)?;
        let orientation = decoder.orientation().map_err(invalid)?;
        let mut img = DynamicImage::from_decoder(decoder).map_err(invalid)?;
        img.apply_orientation(orientation);

        if img.width().max(img.height()) > max_edge {
            img = img.resize(max_edge, max_edge, image::imageops::FilterType::Lanczos3);
        }

        let mut out = Vec::new();
        JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY)
            .encode_image(&img.to_rgb8())
            .map_err(|e| AppError::Internal(format!("Failed to encode image: {e}")))?;
        Ok(out)
    }

    /// Stores the photo; with `identify` it is queued for the automatic identification.
    pub async fn create(
        pool: &PgPool,
        user_id: i64,
        upload: Bytes,
        identify: bool,
    ) -> Result<LabelPhotoUploadDto, AppError> {
        // Decoding and Lanczos resizing of a phone photo takes long enough to stall other
        // requests on the async worker
        let jpeg = tokio::task::spawn_blocking(move || Self::normalize_image(&upload))
            .await
            .map_err(|e| AppError::Internal(format!("Label photo processing failed: {e}")))??;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO label_photo (user_id, image, mime_type, identify_state)
             VALUES ($1, $2, $3, $4) RETURNING id",
        )
        .bind(user_id)
        .bind(&jpeg)
        .bind(STORED_MIME_TYPE)
        .bind(identify.then_some(LabelIdentifyState::Queued.as_str()))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        tracing::info!(
            "Stored label photo {id} of user {user_id} ({} bytes, identification queued: {identify})",
            jpeg.len()
        );

        Ok(LabelPhotoUploadDto {
            id,
            pending_count: Self::pending_count(pool, user_id).await?,
            identifying: identify,
        })
    }

    pub async fn list(
        pool: &PgPool,
        user_id: i64,
        status: Option<LabelPhotoStatus>,
        limit: i64,
    ) -> Result<LabelPhotosDto, AppError> {
        let rows = sqlx::query(&format!(
            "SELECT {DTO_COLUMNS}
             FROM label_photo
             WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
             ORDER BY created_at, id
             LIMIT $3"
        ))
        .bind(user_id)
        .bind(status.map(LabelPhotoStatus::as_str))
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;

        Ok(LabelPhotosDto {
            photos: rows.iter().map(to_dto).collect::<Result<_, _>>()?,
            pending_count: Self::pending_count(pool, user_id).await?,
        })
    }

    /// Returns the stored image bytes and their MIME type.
    pub async fn image(
        pool: &PgPool,
        user_id: i64,
        id: i64,
    ) -> Result<(Vec<u8>, String), AppError> {
        let row =
            sqlx::query("SELECT image, mime_type FROM label_photo WHERE id = $1 AND user_id = $2")
                .bind(id)
                .bind(user_id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?
                .ok_or_else(|| not_found(id))?;
        Ok((row.get("image"), row.get("mime_type")))
    }

    /// Like [`Self::image`], but photos whose longest edge exceeds `max_edge` are downscaled
    /// (aspect ratio kept, re-encoded as JPEG). Smaller photos are returned unchanged.
    pub async fn image_scaled(
        pool: &PgPool,
        user_id: i64,
        id: i64,
        max_edge: u32,
    ) -> Result<(Vec<u8>, String), AppError> {
        let (bytes, mime_type) = Self::image(pool, user_id, id).await?;
        tokio::task::spawn_blocking(move || Self::downscale(bytes, mime_type, max_edge))
            .await
            .map_err(|e| AppError::Internal(format!("Image task failed: {e}")))?
    }

    /// Downscales to `max_edge` unless the image already fits (never upscales).
    fn downscale(
        bytes: Vec<u8>,
        mime_type: String,
        max_edge: u32,
    ) -> Result<(Vec<u8>, String), AppError> {
        let (width, height) = ImageReader::new(Cursor::new(&bytes))
            .with_guessed_format()
            .map_err(|e| AppError::Internal(format!("Invalid stored image: {e}")))?
            .into_dimensions()
            .map_err(|e| AppError::Internal(format!("Invalid stored image: {e}")))?;
        if width.max(height) <= max_edge {
            return Ok((bytes, mime_type));
        }
        // a stored photo that cannot be decoded is a server-side fault, not a bad request
        let scaled = Self::normalize_image_to(&bytes, max_edge).map_err(|e| match e {
            AppError::BadRequest(msg) => AppError::Internal(format!("Stored image: {msg}")),
            other => other,
        })?;
        Ok((scaled, STORED_MIME_TYPE.to_string()))
    }

    pub async fn update(
        pool: &PgPool,
        user_id: i64,
        id: i64,
        status: LabelPhotoStatus,
        discogs_id: Option<i64>,
    ) -> Result<LabelPhotoDto, AppError> {
        let row = sqlx::query(&format!(
            "UPDATE label_photo
             SET status = $3,
                 discogs_id = $4,
                 processed_at = CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() AT TIME ZONE 'UTC' END
             WHERE id = $1 AND user_id = $2
             RETURNING {DTO_COLUMNS}"
        ))
        .bind(id)
        .bind(user_id)
        .bind(status.as_str())
        .bind(discogs_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| not_found(id))?;
        tracing::info!(
            "Label photo {id} of user {user_id} marked as {}",
            status.as_str()
        );
        to_dto(&row)
    }

    pub async fn delete(pool: &PgPool, user_id: i64, id: i64) -> Result<(), AppError> {
        let result = sqlx::query("DELETE FROM label_photo WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        if result.rows_affected() == 0 {
            return Err(not_found(id));
        }
        tracing::info!("User {user_id} deleted label photo {id}");
        Ok(())
    }

    /// Deletes all photos of the user, or only those with the given status.
    pub async fn delete_all(
        pool: &PgPool,
        user_id: i64,
        status: Option<LabelPhotoStatus>,
    ) -> Result<LabelPhotoDeleteDto, AppError> {
        let result = sqlx::query(
            "DELETE FROM label_photo WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)",
        )
        .bind(user_id)
        .bind(status.map(LabelPhotoStatus::as_str))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        tracing::info!(
            "User {user_id} deleted {} label photo(s) (status filter: {})",
            result.rows_affected(),
            status.map_or("all", LabelPhotoStatus::as_str)
        );
        Ok(LabelPhotoDeleteDto {
            deleted: i64::try_from(result.rows_affected()).unwrap_or(i64::MAX),
            pending_count: Self::pending_count(pool, user_id).await?,
        })
    }

    /// Queues an open photo again for the automatic identification (e.g. after an error). A photo
    /// that is still queued or running is not queued twice, which would pay for two runs.
    pub async fn queue_identification(
        pool: &PgPool,
        user_id: i64,
        id: i64,
    ) -> Result<LabelPhotoDto, AppError> {
        let current: Option<(String, Option<String>)> = sqlx::query_as(
            "SELECT status, identify_state FROM label_photo WHERE id = $1 AND user_id = $2",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
        match current {
            None => return Err(not_found(id)),
            Some((status, _)) if status != LabelPhotoStatus::Pending.as_str() => {
                return Err(AppError::Conflict(format!(
                    "Label photo {id} is already completed"
                )));
            }
            Some((_, Some(state))) if state == "queued" || state == "running" => {
                return Err(AppError::Conflict(format!(
                    "Label photo {id} is already being identified"
                )));
            }
            Some(_) => {}
        }
        let row = sqlx::query(&format!(
            "UPDATE label_photo
             SET identify_state = 'queued', identify_error = NULL
             WHERE id = $1 AND user_id = $2 AND status = 'pending'
               AND (identify_state IS NULL OR identify_state IN ('done', 'error'))
             RETURNING {DTO_COLUMNS}"
        ))
        .bind(id)
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| not_found(id))?;
        tracing::info!("Label photo {id} of user {user_id} queued for identification");
        to_dto(&row)
    }

    /// Marks a queued photo as running; `false` if it is no longer queued (deleted, resolved).
    pub async fn start_identification(pool: &PgPool, id: i64) -> Result<bool, AppError> {
        let result = sqlx::query(
            "UPDATE label_photo SET identify_state = 'running'
             WHERE id = $1 AND identify_state = 'queued' AND status = 'pending'",
        )
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(result.rows_affected() == 1)
    }

    pub async fn finish_identification(
        pool: &PgPool,
        id: i64,
        model: &str,
        outcome: Result<&IdentifyOutcome, &str>,
    ) -> Result<(), AppError> {
        let (state, suggestion, reading, error) = match outcome {
            Ok(o) => (
                LabelIdentifyState::Done,
                o.suggestion.as_ref().map(Json),
                o.reading.as_ref().map(Json),
                o.no_match_hint.as_deref(),
            ),
            Err(message) => (LabelIdentifyState::Error, None, None, Some(message)),
        };
        // A finished run replaces suggestion and reading (also with "no match"); an error keeps
        // those of an earlier run
        sqlx::query(
            "UPDATE label_photo
             SET identify_state = $2,
                 suggestion = CASE WHEN $2 = 'done' THEN $3 ELSE suggestion END,
                 label_reading = CASE WHEN $2 = 'done' THEN $6 ELSE label_reading END,
                 identify_error = $4,
                 identify_model = $5, identified_at = NOW() AT TIME ZONE 'UTC'
             WHERE id = $1 AND identify_state = 'running'",
        )
        .bind(id)
        .bind(state.as_str())
        .bind(suggestion)
        .bind(error)
        .bind(model)
        .bind(reading)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        tracing::debug!(
            "Label photo {id} identification finished as '{}' (model '{model}')",
            state.as_str()
        );
        Ok(())
    }

    /// Ends a queued or running identification that failed outside the normal flow (database
    /// error, panic), so the photo does not stay "running".
    pub async fn abort_identification(
        pool: &PgPool,
        id: i64,
        message: &str,
    ) -> Result<(), AppError> {
        let result = sqlx::query(
            "UPDATE label_photo SET identify_state = 'error', identify_error = $2
             WHERE id = $1 AND identify_state IN ('queued', 'running')",
        )
        .bind(id)
        .bind(message)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        if result.rows_affected() > 0 {
            tracing::warn!("Aborted identification of label photo {id}: {message}");
        }
        Ok(())
    }

    /// Identifications cut off by a restart cannot resume; they become errors to retry.
    pub async fn fail_interrupted_identifications(pool: &PgPool) -> Result<u64, AppError> {
        let result = sqlx::query(
            "UPDATE label_photo
             SET identify_state = 'error', identify_error = 'Interrupted by a server restart'
             WHERE identify_state IN ('queued', 'running')",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        Ok(result.rows_affected())
    }

    async fn pending_count(pool: &PgPool, user_id: i64) -> Result<i64, AppError> {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM label_photo WHERE user_id = $1 AND status = 'pending'",
        )
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)
    }
}

fn not_found(id: i64) -> AppError {
    AppError::NotFound(format!("Label photo {id} not found"))
}

fn iso_utc(ts: NaiveDateTime) -> String {
    ts.and_utc()
        .to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn to_dto(row: &PgRow) -> Result<LabelPhotoDto, AppError> {
    let status: String = row.get("status");
    let identify_state: Option<String> = row.get("identify_state");
    Ok(LabelPhotoDto {
        id: row.get("id"),
        status: LabelPhotoStatus::parse(&status)
            .ok_or_else(|| AppError::Internal(format!("Unknown label photo status '{status}'")))?,
        discogs_id: row.get("discogs_id"),
        created_at: iso_utc(row.get("created_at")),
        processed_at: row
            .get::<Option<NaiveDateTime>, _>("processed_at")
            .map(iso_utc),
        identify_state: identify_state
            .as_deref()
            .and_then(LabelIdentifyState::parse),
        suggestion: row
            .get::<Option<Json<LabelSuggestion>>, _>("suggestion")
            .map(|Json(suggestion)| suggestion),
        identify_error: row.get("identify_error"),
        identify_model: row.get("identify_model"),
        label_reading: row
            .get::<Option<Json<LabelReading>>, _>("label_reading")
            .map(|Json(reading)| reading),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, RgbImage};

    fn encode(width: u32, height: u32, format: ImageFormat) -> Vec<u8> {
        let mut buf = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(RgbImage::new(width, height))
            .write_to(&mut buf, format)
            .unwrap();
        buf.into_inner()
    }

    #[test]
    fn test_normalize_downscales_large_photo_to_jpeg() {
        let out =
            LabelPhotoService::normalize_image(&encode(2000, 1500, ImageFormat::Png)).unwrap();
        let img = image::load_from_memory_with_format(&out, ImageFormat::Jpeg).unwrap();
        assert_eq!((img.width(), img.height()), (1568, 1176));
    }

    #[test]
    fn test_normalize_keeps_small_photo_size() {
        let out = LabelPhotoService::normalize_image(&encode(800, 600, ImageFormat::Jpeg)).unwrap();
        let img = image::load_from_memory(&out).unwrap();
        assert_eq!((img.width(), img.height()), (800, 600));
    }

    #[test]
    fn test_normalize_strips_exif() {
        // JPEG with an APP1/EXIF segment inserted right after SOI
        let jpeg = encode(10, 10, ImageFormat::Jpeg);
        let exif: &[u8] = &[
            0xFF, 0xE1, 0x00, 0x10, b'E', b'x', b'i', b'f', 0, 0, b'M', b'M', 0, 0x2A, 0, 0, 0, 8,
        ];
        let with_exif = [&jpeg[..2], exif, &jpeg[2..]].concat();
        assert!(with_exif.windows(4).any(|w| w == b"Exif"));

        let out = LabelPhotoService::normalize_image(&with_exif).unwrap();
        assert!(!out.windows(4).any(|w| w == b"Exif"));
    }

    #[test]
    fn test_downscale_shrinks_large_photo_keeping_aspect_ratio() {
        let (out, mime) = LabelPhotoService::downscale(
            encode(1568, 1176, ImageFormat::Jpeg),
            "image/jpeg".to_string(),
            1024,
        )
        .unwrap();
        let img = image::load_from_memory(&out).unwrap();
        assert_eq!((img.width(), img.height()), (1024, 768));
        assert_eq!(mime, "image/jpeg");
    }

    #[test]
    fn test_downscale_never_upscales_and_keeps_bytes() {
        let original = encode(800, 600, ImageFormat::Jpeg);
        let (out, _) =
            LabelPhotoService::downscale(original.clone(), "image/jpeg".to_string(), 1024).unwrap();
        assert_eq!(out, original);
    }

    #[test]
    fn test_downscale_corrupt_stored_image_is_internal_error() {
        // PNG signature + IHDR (dimensions readable), but no pixel data
        let mut corrupt = encode(2000, 1500, ImageFormat::Png);
        corrupt.truncate(33);
        let err = LabelPhotoService::downscale(corrupt, "image/jpeg".to_string(), 1024);
        assert!(matches!(err, Err(AppError::Internal(_))), "{err:?}");
    }

    #[test]
    fn test_normalize_rejects_non_image() {
        let err = LabelPhotoService::normalize_image(b"not an image").unwrap_err();
        assert!(matches!(err, AppError::BadRequest(_)));
    }

    #[test]
    fn test_iso_utc_format() {
        let ts = chrono::NaiveDate::from_ymd_opt(2026, 10, 22)
            .unwrap()
            .and_hms_opt(9, 5, 0)
            .unwrap();
        assert_eq!(iso_utc(ts), "2026-10-22T09:05:00Z");
    }
}
