use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        discogs::{DiscogsRelease, DiscogsSearchFilter, DiscogsSearchResult, determine_format},
        scan::{DiscogsMatchDto, ResetResultDto, ScanResultDto, TrackedRecordDto},
        user::AppUser,
    },
    services::crypto_service::CryptoService,
};
use chrono::Utc;
use sqlx::{PgPool, Row, postgres::PgRow};
use std::sync::Arc;

pub struct ScanService;

/// The scanned barcode plus its UPC-A / EAN-13 twin (leading zero added or removed).
pub fn barcode_variants(barcode: &str) -> Vec<String> {
    let mut variants = vec![barcode.to_string()];
    if barcode.len() == 12 {
        variants.push(format!("0{barcode}"));
    } else if barcode.len() == 13
        && let Some(upc) = barcode.strip_prefix('0')
    {
        variants.push(upc.to_string());
    }
    variants
}

impl ScanService {
    pub async fn process_scan(
        pool: &PgPool,
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
        raw_barcode: &str,
    ) -> Result<ScanResultDto, AppError> {
        let dec_token = user
            .discogs_token
            .as_deref()
            .and_then(|enc| crypto.decrypt(enc));

        let clean_barcode: String = raw_barcode.chars().filter(|c| !c.is_whitespace()).collect();
        let lower = clean_barcode.to_lowercase();

        // 1. Check if Custom QR Code
        let is_custom_qr = lower.starts_with("discogs-id:")
            || lower.starts_with("discogsßidö")
            || lower.starts_with("discogsßidÖ".to_lowercase().as_str())
            || lower.starts_with("vt:");

        let mut matched_release: Option<Arc<DiscogsRelease>> = None;
        let mut discogs_matches: Vec<DiscogsMatchDto> = Vec::new();

        if is_custom_qr {
            let id_str = clean_barcode
                .split_once(':')
                .or_else(|| clean_barcode.split_once('ö'))
                .or_else(|| clean_barcode.split_once('Ö'))
                .map(|(_, id)| id)
                .unwrap_or(&clean_barcode);

            // On a German keyboard layout, HID scanners type the '-' of manual records as 'ß'
            let release_id = id_str
                .trim()
                .replace('ß', "-")
                .parse::<i64>()
                .map_err(|_| AppError::BadRequest("Invalid custom barcode format".to_string()))?;

            // Negative IDs are manual records, which exist only locally
            if let Some(ref token) = dec_token
                && release_id > 0
            {
                matched_release = discogs_client.get_release(release_id, token).await.ok();
            }

            // Fallback to local DB if Discogs API call failed or no token
            if matched_release.is_none() {
                let local_rec = sqlx::query(
                    "SELECT id, discogs_id, title, artist, thumb_url
                     FROM record_cache rc
                     WHERE (discogs_id = $1 OR id = $1) AND (rc.source = 'discogs' OR rc.owner_id = $2)
                     LIMIT 1",
                )
                .bind(release_id)
                .bind(user.id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;

                if let Some(row) = local_rec {
                    return Self::log_local(pool, user.id, &row).await;
                }

                // A manual record taken over to Discogs keeps resolving via its old ID (#243)
                if release_id < 0 {
                    let alias_rec = sqlx::query(
                        "SELECT rc.id, rc.discogs_id, rc.title, rc.artist, rc.thumb_url
                         FROM manual_record_alias a
                         JOIN collection_item ci
                           ON ci.user_id = a.user_id AND ci.instance_id = a.instance_id
                         JOIN record_cache rc ON rc.id = ci.record_id
                         WHERE a.user_id = $1 AND a.old_id = $2",
                    )
                    .bind(user.id)
                    .bind(release_id)
                    .fetch_optional(pool)
                    .await
                    .map_err(AppError::Database)?;
                    if let Some(row) = alias_rec {
                        return Self::log_local(pool, user.id, &row).await;
                    }
                }
            }
        } else {
            // Manual records of the user carry their own barcode and are found without Discogs
            let local_rec = sqlx::query(
                "SELECT rc.id, rc.discogs_id, rc.title, rc.artist, rc.thumb_url
                 FROM record_cache rc
                 JOIN collection_item ci ON ci.record_id = rc.id
                 WHERE ci.user_id = $1 AND rc.source = 'manual' AND rc.barcode = ANY($2)
                 LIMIT 1",
            )
            .bind(user.id)
            .bind(barcode_variants(&clean_barcode))
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
            if let Some(row) = local_rec {
                return Self::log_local(pool, user.id, &row).await;
            }

            // Standard Barcode Lookup via Discogs API
            let token = dec_token.as_deref().ok_or_else(|| {
                AppError::BadRequest(
                    "User does not have a configured Discogs token for barcode scanning"
                        .to_string(),
                )
            })?;

            let mut results: Vec<DiscogsSearchResult> = Vec::new();

            // Try direct barcode
            if let Ok(res) = discogs_client
                .search_by_barcode(&clean_barcode, token)
                .await
            {
                results.extend(res.results);
            }

            // Fallback 1: 12 digits (UPC-A) -> try 13 digits with leading 0
            if results.is_empty() && clean_barcode.len() == 12 {
                let ean = format!("0{clean_barcode}");
                if let Ok(res) = discogs_client.search_by_barcode(&ean, token).await {
                    results.extend(res.results);
                }
            }

            // Fallback 2: 13 digits with leading 0 -> try 12 digits without leading 0
            if results.is_empty() && clean_barcode.len() == 13 && clean_barcode.starts_with('0') {
                let upc = &clean_barcode[1..];
                if let Ok(res) = discogs_client.search_by_barcode(upc, token).await {
                    results.extend(res.results);
                }
            }

            // Fallback 3: General query search (q=barcode)
            if results.is_empty() {
                let search_res = discogs_client
                    .search(
                        &DiscogsSearchFilter::query(clean_barcode.as_str()),
                        Some("release"),
                        1,
                        10,
                        token,
                    )
                    .await;
                if let Ok(res) = search_res {
                    results.extend(res.results);
                }
            }

            // Check if any result is in the user's collection
            for candidate in &results {
                let in_local = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(
                        SELECT 1 FROM collection_item ci
                        JOIN record_cache rc ON rc.id = ci.record_id
                        WHERE ci.user_id = $1 AND rc.discogs_id = $2
                    )",
                )
                .bind(user.id)
                .bind(candidate.id)
                .fetch_one(pool)
                .await
                .unwrap_or(false);

                let in_discogs = if !in_local && user.discogs_username.is_some() {
                    discogs_client
                        .is_release_in_collection(
                            user.discogs_username.as_deref().unwrap(),
                            candidate.id,
                            token,
                        )
                        .await
                        .unwrap_or(false)
                } else {
                    false
                };

                if in_local || in_discogs {
                    let rel_res = discogs_client.get_release(candidate.id, token).await;
                    if let Ok(rel) = rel_res {
                        matched_release = Some(rel);
                        break;
                    }
                }
            }

            if matched_release.is_none() && !results.is_empty() {
                for r in results {
                    discogs_matches.push(DiscogsMatchDto {
                        id: r.id,
                        title: r.title,
                        year: r.year,
                        thumb_url: r.thumb,
                        cover_image: r.cover_image,
                        format: r.format,
                        country: r.country,
                    });
                }
            }
        }

        let release = match matched_release {
            Some(rel) => rel,
            None => {
                if !discogs_matches.is_empty() {
                    return Ok(ScanResultDto {
                        success: false,
                        message: "Release not found in collection, but found on Discogs."
                            .to_string(),
                        record: None,
                        discogs_matches: Some(discogs_matches),
                    });
                }
                return Ok(ScanResultDto {
                    success: false,
                    message: "Release not found in collection or invalid barcode.".to_string(),
                    record: None,
                    discogs_matches: None,
                });
            }
        };

        // 2. Persist record in record_cache if missing
        let artist_name = release
            .artists
            .as_ref()
            .and_then(|a| a.first())
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let year_str = release.year.map(|y| y.to_string());
        let fmt = determine_format(release.formats.as_deref());

        let row = sqlx::query(
            "INSERT INTO record_cache (discogs_id, title, artist, release_year, thumb_url, format, lowest_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (discogs_id)
             DO UPDATE SET title = EXCLUDED.title,
                           artist = EXCLUDED.artist,
                           release_year = EXCLUDED.release_year,
                           thumb_url = COALESCE(EXCLUDED.thumb_url, record_cache.thumb_url),
                           format = EXCLUDED.format
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

        let record_id: i64 = row.get("id");

        if let Some(genres) = &release.genres {
            for g in genres {
                let _ = sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                    .bind(record_id)
                    .bind(g)
                    .execute(pool)
                    .await;
            }
        }

        // 3. Insert listen_event
        let now = Utc::now().naive_utc();
        sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, $3)")
            .bind(user.id)
            .bind(record_id)
            .bind(now)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        let title = release.title.clone();
        let thumb_url = release.thumb.clone();

        Ok(ScanResultDto {
            success: true,
            message: format!("Now playing: {title}"),
            record: Some(TrackedRecordDto {
                discogs_id: release.id,
                title,
                artist: artist_name,
                thumb_url,
            }),
            discogs_matches: None,
        })
    }

    /// Logs a listen for a record found locally (QR fallback, manual record barcode).
    async fn log_local(
        pool: &PgPool,
        user_id: i64,
        row: &PgRow,
    ) -> Result<ScanResultDto, AppError> {
        let title: String = row.get("title");
        sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(row.get::<i64, _>("id"))
            .bind(Utc::now().naive_utc())
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        Ok(ScanResultDto {
            success: true,
            message: format!("Now playing: {title}"),
            record: Some(TrackedRecordDto {
                discogs_id: row.get("discogs_id"),
                title,
                artist: row
                    .get::<Option<String>, _>("artist")
                    .unwrap_or_else(|| "Unknown".to_string()),
                thumb_url: row.get("thumb_url"),
            }),
            discogs_matches: None,
        })
    }

    pub async fn delete_scan(pool: &PgPool, user_id: i64, event_id: i64) -> Result<(), AppError> {
        let res = sqlx::query("DELETE FROM listen_event WHERE id = $1 AND user_id = $2")
            .bind(event_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        if res.rows_affected() == 0 {
            return Err(AppError::NotFound("Scan not found".to_string()));
        }

        Ok(())
    }

    pub async fn reset_all_listens(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<ResetResultDto, AppError> {
        let res = sqlx::query("DELETE FROM listen_event WHERE user_id = $1")
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;

        Ok(ResetResultDto {
            success: true,
            message: "All listens have been reset".to_string(),
            deleted_count: res.rows_affected() as i64,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn barcode_variants_add_the_upc_ean_twin() {
        assert_eq!(
            barcode_variants("075678164125"),
            ["075678164125", "0075678164125"]
        );
        assert_eq!(
            barcode_variants("0075678164125"),
            ["0075678164125", "075678164125"]
        );
        assert_eq!(barcode_variants("4006381333931"), ["4006381333931"]);
        assert_eq!(barcode_variants("ABC"), ["ABC"]);
    }
}
