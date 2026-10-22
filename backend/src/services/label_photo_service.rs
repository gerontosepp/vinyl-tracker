use crate::{
    error::AppError,
    models::label_photo::{LabelPhotoDto, LabelPhotoStatus, LabelPhotoUploadDto, LabelPhotosDto},
};
use chrono::NaiveDateTime;
use image::{DynamicImage, ImageDecoder, ImageReader, codecs::jpeg::JpegEncoder};
use sqlx::{PgPool, Row, postgres::PgRow};
use std::io::Cursor;

/// Longest edge of a stored label photo; enough for Claude to read small label print.
pub const MAX_EDGE_PX: u32 = 1568;
const JPEG_QUALITY: u8 = 85;
const STORED_MIME_TYPE: &str = "image/jpeg";

pub struct LabelPhotoService;

impl LabelPhotoService {
    /// Decodes an uploaded JPEG/PNG, applies its EXIF orientation, downscales it to
    /// [`MAX_EDGE_PX`] and re-encodes it as JPEG. Re-encoding drops all metadata (EXIF/GPS).
    pub fn normalize_image(bytes: &[u8]) -> Result<Vec<u8>, AppError> {
        let invalid = |e: image::ImageError| AppError::BadRequest(format!("Invalid image: {e}"));

        let mut decoder = ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .map_err(|e| AppError::BadRequest(format!("Invalid image: {e}")))?
            .into_decoder()
            .map_err(invalid)?;
        let orientation = decoder.orientation().map_err(invalid)?;
        let mut img = DynamicImage::from_decoder(decoder).map_err(invalid)?;
        img.apply_orientation(orientation);

        if img.width().max(img.height()) > MAX_EDGE_PX {
            img = img.resize(
                MAX_EDGE_PX,
                MAX_EDGE_PX,
                image::imageops::FilterType::Lanczos3,
            );
        }

        let mut out = Vec::new();
        JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY)
            .encode_image(&img.to_rgb8())
            .map_err(|e| AppError::Internal(format!("Failed to encode label photo: {e}")))?;
        Ok(out)
    }

    pub async fn create(
        pool: &PgPool,
        user_id: i64,
        bytes: &[u8],
    ) -> Result<LabelPhotoUploadDto, AppError> {
        let jpeg = Self::normalize_image(bytes)?;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO label_photo (user_id, image, mime_type) VALUES ($1, $2, $3) RETURNING id",
        )
        .bind(user_id)
        .bind(&jpeg)
        .bind(STORED_MIME_TYPE)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;

        Ok(LabelPhotoUploadDto {
            id,
            pending_count: Self::pending_count(pool, user_id).await?,
        })
    }

    pub async fn list(
        pool: &PgPool,
        user_id: i64,
        status: Option<LabelPhotoStatus>,
        limit: i64,
    ) -> Result<LabelPhotosDto, AppError> {
        let rows = sqlx::query(
            "SELECT id, status, discogs_id, created_at, processed_at
             FROM label_photo
             WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
             ORDER BY created_at, id
             LIMIT $3",
        )
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

    pub async fn update(
        pool: &PgPool,
        user_id: i64,
        id: i64,
        status: LabelPhotoStatus,
        discogs_id: Option<i64>,
    ) -> Result<LabelPhotoDto, AppError> {
        let row = sqlx::query(
            "UPDATE label_photo
             SET status = $3,
                 discogs_id = $4,
                 processed_at = CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() AT TIME ZONE 'UTC' END
             WHERE id = $1 AND user_id = $2
             RETURNING id, status, discogs_id, created_at, processed_at",
        )
        .bind(id)
        .bind(user_id)
        .bind(status.as_str())
        .bind(discogs_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| not_found(id))?;
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
        Ok(())
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
    Ok(LabelPhotoDto {
        id: row.get("id"),
        status: LabelPhotoStatus::parse(&status)
            .ok_or_else(|| AppError::Internal(format!("Unknown label photo status '{status}'")))?,
        discogs_id: row.get("discogs_id"),
        created_at: iso_utc(row.get("created_at")),
        processed_at: row
            .get::<Option<NaiveDateTime>, _>("processed_at")
            .map(iso_utc),
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
