use crate::{
    error::AppError,
    models::{
        collection::{
            BasicInformation, CollectionNote, CollectionRelease, CollectionResponse,
            ParsedCollectionFilter,
        },
        discogs::{DiscogsArtist, DiscogsPagination},
        record::RecordSource,
    },
    services::storage::StorageService,
};
use sqlx::{PgPool, Row, postgres::PgRow};
use std::collections::HashMap;

pub struct CollectionQueryService;

/// Columns and joins of a collection release, mapped by [`map_release`]; `$1` is the user ID.
const RELEASE_SELECT_SQL: &str = "SELECT ci.id as item_id, ci.instance_id, ci.added_at, ci.media_condition, ci.sleeve_condition, ci.sort_key,
                    rc.id as record_id, rc.discogs_id, rc.title, rc.artist, rc.release_year, rc.thumb_url, rc.format, rc.source,
                    rc.lowest_price::float8 as lowest_price,
                    rc.median_price::float8 as median_price,
                    COALESCE(le.listen_count, 0) as play_count,
                    le.last_played_at
             FROM collection_item ci
             JOIN record_cache rc ON rc.id = ci.record_id
             LEFT JOIN (
                 SELECT record_id, user_id, COUNT(*) as listen_count, MAX(timestamp) as last_played_at
                 FROM listen_event
                 WHERE user_id = $1
                 GROUP BY record_id, user_id
             ) le ON le.record_id = ci.record_id";

/// Automatic artist sort key: artist without a leading article, lowercase.
/// Ignored articles: The, A, An, Der, Die, Das, Le, La, Les ("Die Sterne" sorts under S).
pub const DEFAULT_ARTIST_KEY_SQL: &str =
    r#"REGEXP_REPLACE(LOWER(rc.artist), '^(the|an?|der|die|das|les?|la)\s+', '', 'i')"#;
/// Shelf sort key columns (custom sort string or automatic artist key, year, title). The
/// storage layout compares the selected values byte-wise, which matches `COLLATE "C"` in
/// [`shelf_order_sql`].
pub const SHELF_ARTIST_KEY_SQL: &str = r#"COALESCE(LOWER(ci.sort_key), REGEXP_REPLACE(LOWER(rc.artist), '^(the|an?|der|die|das|les?|la)\s+', '', 'i'))"#;
pub const SHELF_TITLE_KEY_SQL: &str = "COALESCE(LOWER(rc.title), '')";
/// Shelf order of the collection view ("artist", ascending) and of the storage layout.
pub fn shelf_order_sql() -> String {
    format!(
        r#"{SHELF_ARTIST_KEY_SQL} COLLATE "C" ASC NULLS LAST, rc.release_year COLLATE "C" ASC NULLS LAST, {SHELF_TITLE_KEY_SQL} COLLATE "C" ASC, ci.instance_id ASC"#
    )
}

impl CollectionQueryService {
    /// Resolves the storage filter into the instance IDs the query is restricted to.
    async fn resolve_storage_filter(
        pool: &PgPool,
        user_id: i64,
        filter: &mut ParsedCollectionFilter,
    ) -> Result<(), AppError> {
        if let Some(storage) = filter.storage {
            filter.instance_ids =
                Some(StorageService::filter_instances(pool, user_id, storage).await?);
        }
        Ok(())
    }

    pub async fn get_collection(
        pool: &PgPool,
        user_id: i64,
        mut filter: ParsedCollectionFilter,
    ) -> Result<CollectionResponse, AppError> {
        Self::resolve_storage_filter(pool, user_id, &mut filter).await?;
        let where_clause = Self::build_where_clause(&filter);

        // 1. Count total matching items
        let count_sql = format!(
            "SELECT COUNT(*) as total
             FROM collection_item ci
             JOIN record_cache rc ON rc.id = ci.record_id
             LEFT JOIN (
                 SELECT record_id, user_id, COUNT(*) as listen_count, MAX(timestamp) as last_played_at
                 FROM listen_event
                 WHERE user_id = $1
                 GROUP BY record_id, user_id
             ) le ON le.record_id = ci.record_id
             WHERE {where_clause}"
        );

        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql).bind(user_id);
        count_query = Self::bind_filter_params_scalar(count_query, &filter);
        let total_items = count_query
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;

        if total_items == 0 {
            return Ok(CollectionResponse {
                releases: Vec::new(),
                pagination: DiscogsPagination {
                    page: filter.page,
                    pages: 0,
                    per_page: filter.per_page,
                    items: 0,
                },
            });
        }

        let offset = ((filter.page - 1) * filter.per_page) as i64;
        let limit = filter.per_page as i64;
        let limit_clause = format!("LIMIT {limit} OFFSET {offset}");

        let mut releases =
            Self::fetch_and_map_releases(pool, user_id, &filter, Some(&limit_clause)).await?;
        let slots = StorageService::slots(pool, user_id).await?;
        if !slots.is_empty() {
            for release in &mut releases {
                release.storage = slots.get(&release.instance_id).cloned();
            }
        }

        let total_pages = ((total_items as f64) / (filter.per_page as f64)).ceil() as u32;

        Ok(CollectionResponse {
            releases,
            pagination: DiscogsPagination {
                page: filter.page,
                pages: total_pages,
                per_page: filter.per_page,
                items: total_items as u32,
            },
        })
    }

    pub async fn get_collection_for_export(
        pool: &PgPool,
        user_id: i64,
        mut filter: ParsedCollectionFilter,
    ) -> Result<Vec<CollectionRelease>, AppError> {
        Self::resolve_storage_filter(pool, user_id, &mut filter).await?;
        Self::fetch_and_map_releases(pool, user_id, &filter, None).await
    }

    /// Listen timestamps of the user per Discogs release ID (RFC 3339 UTC with microseconds,
    /// ascending) for the JSON backup.
    pub async fn get_listen_history(
        pool: &PgPool,
        user_id: i64,
        discogs_ids: &[i64],
    ) -> Result<HashMap<i64, Vec<String>>, AppError> {
        let rows = sqlx::query(
            "SELECT rc.discogs_id, le.timestamp
             FROM listen_event le
             JOIN record_cache rc ON rc.id = le.record_id
             WHERE le.user_id = $1 AND rc.discogs_id = ANY($2)
             ORDER BY le.timestamp ASC, le.id ASC",
        )
        .bind(user_id)
        .bind(discogs_ids)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;

        let mut history: HashMap<i64, Vec<String>> = HashMap::new();
        for row in rows {
            let discogs_id: i64 = row.get("discogs_id");
            let timestamp: chrono::NaiveDateTime = row.get("timestamp");
            history.entry(discogs_id).or_default().push(
                timestamp
                    .and_utc()
                    .to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
            );
        }
        Ok(history)
    }

    fn build_order_by(sort: &str, sort_order: &str) -> String {
        let normalized_artist_asc = format!(r#"{SHELF_ARTIST_KEY_SQL} COLLATE "C" ASC"#);
        let normalized_artist_desc = format!(r#"{SHELF_ARTIST_KEY_SQL} COLLATE "C" DESC"#);

        match sort {
            "year" => {
                let dir = if sort_order == "desc" { "DESC" } else { "ASC" };
                format!(
                    "rc.release_year {dir} NULLS LAST, {normalized_artist_asc} NULLS LAST, rc.title ASC"
                )
            }
            "format" => {
                let dir = if sort_order == "desc" { "DESC" } else { "ASC" };
                format!(
                    "rc.format {dir} NULLS LAST, {normalized_artist_asc} NULLS LAST, rc.release_year ASC NULLS LAST, rc.title ASC"
                )
            }
            "listens" => {
                let dir = if sort_order == "desc" { "DESC" } else { "ASC" };
                format!(
                    "COALESCE(le.listen_count, 0) {dir}, {normalized_artist_asc} NULLS LAST, rc.release_year ASC NULLS LAST"
                )
            }
            "artist" if sort_order == "desc" => {
                format!(
                    "{normalized_artist_desc} NULLS LAST, rc.release_year ASC NULLS LAST, rc.title ASC"
                )
            }
            "artist" => shelf_order_sql(),
            _ => {
                let dir = if sort_order == "desc" { "DESC" } else { "ASC" };
                format!("ci.added_at {dir}")
            }
        }
    }

    async fn fetch_and_map_releases(
        pool: &PgPool,
        user_id: i64,
        filter: &ParsedCollectionFilter,
        limit_clause: Option<&str>,
    ) -> Result<Vec<CollectionRelease>, AppError> {
        let where_clause = Self::build_where_clause(filter);
        let order_by = Self::build_order_by(&filter.sort, &filter.sort_order);
        let limit_str = limit_clause.unwrap_or("");

        let select_sql = format!(
            "{RELEASE_SELECT_SQL}
             WHERE {where_clause}
             ORDER BY {order_by}
             {limit_str}"
        );

        let mut select_query = sqlx::query(&select_sql).bind(user_id);
        select_query = Self::bind_filter_params(select_query, filter);
        let rows = select_query
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;

        let record_ids: Vec<i64> = rows.iter().map(|r| r.get::<i64, _>("record_id")).collect();
        let mut genres_map: HashMap<i64, Vec<String>> = HashMap::new();

        if !record_ids.is_empty() {
            let genre_rows =
                sqlx::query("SELECT record_id, genre FROM record_genres WHERE record_id = ANY($1)")
                    .bind(&record_ids)
                    .fetch_all(pool)
                    .await
                    .map_err(AppError::Database)?;

            for grow in genre_rows {
                let rid: i64 = grow.get("record_id");
                let genre: String = grow.get("genre");
                genres_map.entry(rid).or_default().push(genre);
            }
        }

        let releases = rows
            .iter()
            .map(|row| {
                let genres = genres_map
                    .remove(&row.get::<i64, _>("record_id"))
                    .unwrap_or_default();
                map_release(row, genres)
            })
            .collect();

        Ok(releases)
    }

    pub async fn get_random_record(
        pool: &PgPool,
        user_id: i64,
        genre: Option<&str>,
        unplayed_only: bool,
    ) -> Result<Option<CollectionRelease>, AppError> {
        let filter = ParsedCollectionFilter {
            page: 1,
            per_page: 1,
            sort: "artist".into(),
            sort_order: "asc".into(),
            category: "all".into(),
            search: None,
            genres: genre.map(|g| vec![g.to_string()]).unwrap_or_default(),
            years: Vec::new(),
            not_played_since: None,
            unplayed_only,
            min_plays: None,
            storage: None,
            instance_ids: None,
            source: None,
        };

        let where_clause = Self::build_where_clause(&filter);

        let sql = format!(
            "{RELEASE_SELECT_SQL}
             WHERE {where_clause}
             ORDER BY RANDOM()
             LIMIT 1"
        );

        let mut query = sqlx::query(&sql).bind(user_id);
        query = Self::bind_filter_params(query, &filter);
        let row_opt = query
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;

        let row = match row_opt {
            Some(r) => r,
            None => return Ok(None),
        };

        let genre_rows = sqlx::query("SELECT genre FROM record_genres WHERE record_id = $1")
            .bind(row.get::<i64, _>("record_id"))
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
        let genres: Vec<String> = genre_rows.iter().map(|r| r.get("genre")).collect();

        Ok(Some(map_release(&row, genres)))
    }

    pub async fn get_unplayed_collection(
        pool: &PgPool,
        user_id: i64,
        page: u32,
        per_page: u32,
    ) -> Result<CollectionResponse, AppError> {
        let filter = ParsedCollectionFilter {
            page,
            per_page,
            sort: "artist".into(),
            sort_order: "asc".into(),
            category: "all".into(),
            search: None,
            genres: Vec::new(),
            years: Vec::new(),
            not_played_since: None,
            unplayed_only: true,
            min_plays: None,
            storage: None,
            instance_ids: None,
            source: None,
        };
        Self::get_collection(pool, user_id, filter).await
    }

    fn build_where_clause(filter: &ParsedCollectionFilter) -> String {
        let mut clauses = vec!["ci.user_id = $1".to_string()];
        let mut param_idx = 2;

        if filter.category == "vinyl" {
            clauses.push("(rc.format IS NULL OR UPPER(rc.format) NOT LIKE '%CD%')".to_string());
        } else if filter.category == "cd" {
            clauses.push("UPPER(rc.format) LIKE '%CD%'".to_string());
        }

        if filter.search.is_some() {
            clauses.push(format!(
                "(LOWER(rc.artist) LIKE ${param_idx} OR LOWER(rc.title) LIKE ${param_idx})"
            ));
            param_idx += 1;
        }

        if !filter.genres.is_empty() {
            clauses.push(format!(
                "EXISTS (SELECT 1 FROM record_genres rg WHERE rg.record_id = rc.id AND LOWER(rg.genre) = ANY(${param_idx}))"
            ));
            param_idx += 1;
        }

        if !filter.years.is_empty() {
            clauses.push(format!("rc.release_year = ANY(${param_idx})"));
            param_idx += 1;
        }

        if filter.not_played_since.is_some() {
            clauses.push(format!(
                "(le.last_played_at IS NULL OR le.last_played_at <= ${param_idx})"
            ));
            param_idx += 1;
        }

        if filter.unplayed_only {
            clauses.push("COALESCE(le.listen_count, 0) = 0".to_string());
        }

        if filter.min_plays.is_some() {
            clauses.push(format!("COALESCE(le.listen_count, 0) >= ${param_idx}"));
            param_idx += 1;
        }

        if filter.instance_ids.is_some() {
            clauses.push(format!("ci.instance_id = ANY(${param_idx})"));
        }

        // Fixed value from an enum, no bind parameter needed
        if let Some(source) = filter.source {
            clauses.push(format!("rc.source = '{}'", source.as_str()));
        }

        clauses.join(" AND ")
    }

    fn bind_filter_params<'q>(
        mut query: sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments>,
        filter: &'q ParsedCollectionFilter,
    ) -> sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments> {
        if let Some(s) = &filter.search {
            query = query.bind(format!("%{}%", s.to_lowercase()));
        }

        if !filter.genres.is_empty() {
            let lower_genres: Vec<String> =
                filter.genres.iter().map(|g| g.to_lowercase()).collect();
            query = query.bind(lower_genres);
        }

        if !filter.years.is_empty() {
            query = query.bind(filter.years.clone());
        }

        if let Some(dt) = filter.not_played_since {
            query = query.bind(dt.naive_utc());
        }

        if let Some(p) = filter.min_plays {
            query = query.bind(p as i64);
        }

        if let Some(ids) = &filter.instance_ids {
            query = query.bind(ids.clone());
        }

        query
    }

    fn bind_filter_params_scalar<'q, T>(
        mut query: sqlx::query::QueryScalar<'q, sqlx::Postgres, T, sqlx::postgres::PgArguments>,
        filter: &'q ParsedCollectionFilter,
    ) -> sqlx::query::QueryScalar<'q, sqlx::Postgres, T, sqlx::postgres::PgArguments> {
        if let Some(s) = &filter.search {
            query = query.bind(format!("%{}%", s.to_lowercase()));
        }

        if !filter.genres.is_empty() {
            let lower_genres: Vec<String> =
                filter.genres.iter().map(|g| g.to_lowercase()).collect();
            query = query.bind(lower_genres);
        }

        if !filter.years.is_empty() {
            query = query.bind(filter.years.clone());
        }

        if let Some(dt) = filter.not_played_since {
            query = query.bind(dt.naive_utc());
        }

        if let Some(p) = filter.min_plays {
            query = query.bind(p as i64);
        }

        if let Some(ids) = &filter.instance_ids {
            query = query.bind(ids.clone());
        }

        query
    }
}

fn format_ts(ts: chrono::NaiveDateTime) -> String {
    ts.format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

/// Maps a row of [`RELEASE_SELECT_SQL`] to the Discogs-like collection release.
fn map_release(row: &PgRow, genres: Vec<String>) -> CollectionRelease {
    let discogs_id: i64 = row.get("discogs_id");
    let media_condition: Option<String> = row.get("media_condition");
    let sleeve_condition: Option<String> = row.get("sleeve_condition");
    let release_year: Option<String> = row.get("release_year");
    let source: String = row.get("source");

    let artists = row
        .get::<Option<String>, _>("artist")
        .filter(|a| !a.is_empty())
        .map(|name| vec![DiscogsArtist { name, id: None }])
        .unwrap_or_default();

    let notes = [(1, &media_condition), (2, &sleeve_condition)]
        .into_iter()
        .filter_map(|(field_id, value)| {
            value.as_ref().map(|v| CollectionNote {
                field_id: Some(field_id),
                value: Some(v.clone()),
            })
        })
        .collect();

    CollectionRelease {
        id: discogs_id,
        instance_id: row.get("instance_id"),
        listen_count: row.get("play_count"),
        date_added: format_ts(row.get("added_at")),
        rating: None,
        media_condition,
        sleeve_condition,
        sort_key: row.get("sort_key"),
        last_played_at: row
            .get::<Option<chrono::NaiveDateTime>, _>("last_played_at")
            .map(format_ts),
        notes: Some(notes),
        storage: None,
        source: RecordSource::parse(&source).unwrap_or_default(),
        basic_information: BasicInformation {
            id: discogs_id,
            title: row.get("title"),
            artists,
            year: release_year.as_deref().and_then(|y| y.parse::<i32>().ok()),
            thumb_url: row.get("thumb_url"),
            cover_image: None,
            tracklist: None,
            formats: None,
            labels: None,
            genres,
            styles: Vec::new(),
            format: row
                .get::<Option<String>, _>("format")
                .unwrap_or_else(|| "LP".to_string()),
            lowest_price: row.get("lowest_price"),
            median_price: row.get("median_price"),
        },
    }
}
