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
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct ScanService;

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

            let release_id = id_str
                .trim()
                .parse::<i64>()
                .map_err(|_| AppError::BadRequest("Invalid custom barcode format".to_string()))?;

            if let Some(ref token) = dec_token {
                matched_release = discogs_client.get_release(release_id, token).await.ok();
            }

            // Fallback to local DB if Discogs API call failed or no token
            if matched_release.is_none() {
                let local_rec = sqlx::query(
                    "SELECT id, discogs_id, title, artist, release_year, thumb_url, format
                     FROM record_cache
                     WHERE discogs_id = $1 OR id = $1
                     LIMIT 1",
                )
                .bind(release_id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;

                if let Some(row) = local_rec {
                    let rec_id: i64 = row.get("id");
                    let discogs_id: i64 = row.get("discogs_id");
                    let title: String = row.get("title");
                    let artist: Option<String> = row.get("artist");
                    let thumb_url: Option<String> = row.get("thumb_url");

                    // Insert listen_event
                    let now = Utc::now().naive_utc();
                    let _ = sqlx::query("INSERT INTO listen_event (user_id, record_id, timestamp) VALUES ($1, $2, $3)")
                        .bind(user.id)
                        .bind(rec_id)
                        .bind(now)
                        .execute(pool)
                        .await;

                    return Ok(ScanResultDto {
                        success: true,
                        message: format!("Now playing: {title}"),
                        record: Some(TrackedRecordDto {
                            discogs_id,
                            title: title.clone(),
                            artist: artist.unwrap_or_else(|| "Unknown".to_string()),
                            thumb_url,
                        }),
                        discogs_matches: None,
                    });
                }
            }
        } else {
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
