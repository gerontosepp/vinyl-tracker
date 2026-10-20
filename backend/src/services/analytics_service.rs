use crate::{
    clients::discogs::DiscogsClient,
    error::AppError,
    models::{
        analytics::{
            CollectionValueResponse, GenreBreakdownItem, ListenEventDto, TopRecordDto,
            parse_value_data,
        },
        scan::TrackedRecordDto,
        user::AppUser,
    },
    services::crypto_service::CryptoService,
};
use sqlx::{PgPool, Row};

pub struct AnalyticsService;

impl AnalyticsService {
    pub async fn get_recent_listens(
        pool: &PgPool,
        user_id: i64,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<ListenEventDto>, AppError> {
        let from_dt = from
            .and_then(|f| chrono::NaiveDate::parse_from_str(f, "%Y-%m-%d").ok())
            .and_then(|d| d.and_hms_opt(0, 0, 0));
        let to_dt = to
            .and_then(|t| chrono::NaiveDate::parse_from_str(t, "%Y-%m-%d").ok())
            .and_then(|d| d.and_hms_micro_opt(23, 59, 59, 999_999));

        let rows = match (from_dt, to_dt) {
            (Some(start), Some(end)) => {
                sqlx::query(
                    r#"
                    SELECT le.id, le.timestamp, rc.discogs_id, rc.title, rc.artist, rc.thumb_url
                    FROM listen_event le
                    JOIN record_cache rc ON le.record_id = rc.id
                    WHERE le.user_id = $1 AND le.timestamp >= $2 AND le.timestamp <= $3
                    ORDER BY le.timestamp DESC
                    "#,
                )
                .bind(user_id)
                .bind(start)
                .bind(end)
                .fetch_all(pool)
                .await?
            }
            _ => {
                sqlx::query(
                    r#"
                    SELECT le.id, le.timestamp, rc.discogs_id, rc.title, rc.artist, rc.thumb_url
                    FROM listen_event le
                    JOIN record_cache rc ON le.record_id = rc.id
                    WHERE le.user_id = $1
                    ORDER BY le.timestamp DESC
                    "#,
                )
                .bind(user_id)
                .fetch_all(pool)
                .await?
            }
        };

        let events = rows
            .into_iter()
            .map(|row| {
                let id: i64 = row.get("id");
                let timestamp: chrono::NaiveDateTime = row.get("timestamp");
                let discogs_id: i64 = row.get("discogs_id");
                let title: String = row.get("title");
                let artist: String = row.get("artist");
                let thumb_url: Option<String> = row.get("thumb_url");

                ListenEventDto {
                    id,
                    record: Some(TrackedRecordDto {
                        discogs_id,
                        title,
                        artist,
                        thumb_url,
                    }),
                    timestamp: timestamp.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                }
            })
            .collect();

        Ok(events)
    }

    pub async fn get_top_records(
        pool: &PgPool,
        user_id: i64,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<TopRecordDto>, AppError> {
        let from_dt = from
            .and_then(|f| chrono::NaiveDate::parse_from_str(f, "%Y-%m-%d").ok())
            .and_then(|d| d.and_hms_opt(0, 0, 0));
        let to_dt = to
            .and_then(|t| chrono::NaiveDate::parse_from_str(t, "%Y-%m-%d").ok())
            .and_then(|d| d.and_hms_micro_opt(23, 59, 59, 999_999));

        let rows = match (from_dt, to_dt) {
            (Some(start), Some(end)) => {
                sqlx::query(
                    r#"
                    SELECT rc.discogs_id, rc.title, rc.artist, rc.thumb_url, COUNT(le.id) AS play_count
                    FROM listen_event le
                    JOIN record_cache rc ON le.record_id = rc.id
                    WHERE le.user_id = $1 AND le.timestamp >= $2 AND le.timestamp <= $3
                    GROUP BY rc.discogs_id, rc.title, rc.artist, rc.thumb_url
                    ORDER BY play_count DESC
                    LIMIT 10
                    "#,
                )
                .bind(user_id)
                .bind(start)
                .bind(end)
                .fetch_all(pool)
                .await?
            }
            _ => {
                sqlx::query(
                    r#"
                    SELECT rc.discogs_id, rc.title, rc.artist, rc.thumb_url, COUNT(le.id) AS play_count
                    FROM listen_event le
                    JOIN record_cache rc ON le.record_id = rc.id
                    WHERE le.user_id = $1
                    GROUP BY rc.discogs_id, rc.title, rc.artist, rc.thumb_url
                    ORDER BY play_count DESC
                    LIMIT 10
                    "#,
                )
                .bind(user_id)
                .fetch_all(pool)
                .await?
            }
        };

        let top = rows
            .into_iter()
            .map(|row| {
                let discogs_id: i64 = row.get("discogs_id");
                let title: String = row.get("title");
                let artist: String = row.get("artist");
                let thumb_url: Option<String> = row.get("thumb_url");
                let count: i64 = row.get("play_count");

                TopRecordDto {
                    discogs_id,
                    record_title: title.clone(),
                    title,
                    artist,
                    thumb_url,
                    count,
                }
            })
            .collect();

        Ok(top)
    }

    pub async fn get_collection_value(
        discogs_client: &DiscogsClient,
        crypto: &CryptoService,
        user: &AppUser,
    ) -> Result<CollectionValueResponse, AppError> {
        let encrypted_token =
            match &user.discogs_token {
                Some(t) if !t.trim().is_empty() => t,
                _ => return Err(AppError::BadRequest(
                    "Connect your Discogs account in settings before requesting collection value."
                        .to_string(),
                )),
            };

        let discogs_username =
            match &user.discogs_username {
                Some(u) if !u.trim().is_empty() => u,
                _ => return Err(AppError::BadRequest(
                    "Connect your Discogs account in settings before requesting collection value."
                        .to_string(),
                )),
            };

        let token = crypto
            .decrypt(encrypted_token)
            .ok_or_else(|| AppError::Internal("Failed to decrypt Discogs token".to_string()))?;
        let val_res = discogs_client
            .get_collection_value(discogs_username, &token)
            .await?;

        Ok(CollectionValueResponse {
            minimum: parse_value_data(val_res.minimum.as_deref()),
            median: parse_value_data(val_res.median.as_deref()),
            maximum: parse_value_data(val_res.maximum.as_deref()),
        })
    }

    pub async fn get_genre_breakdown(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<Vec<GenreBreakdownItem>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT COALESCE(rg.genre, 'Unknown') AS genre_name, COUNT(*) AS cnt
            FROM collection_item ci
            LEFT JOIN record_genres rg ON ci.record_id = rg.record_id
            WHERE ci.user_id = $1
            GROUP BY genre_name
            ORDER BY cnt DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|row| {
                let name: String = row.get("genre_name");
                let value: i64 = row.get("cnt");
                GenreBreakdownItem { name, value }
            })
            .collect();

        Ok(items)
    }
}
