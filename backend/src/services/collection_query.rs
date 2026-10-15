use crate::{
    error::AppError,
    models::{
        collection::{
            BasicInformation, CollectionNote, CollectionRelease, CollectionResponse,
            ParsedCollectionFilter,
        },
        discogs::{DiscogsArtist, DiscogsPagination},
    },
};
use sqlx::{PgPool, Row};
use std::collections::HashMap;

pub struct CollectionQueryService;

impl CollectionQueryService {
    pub async fn get_collection(
        pool: &PgPool,
        user_id: i64,
        filter: ParsedCollectionFilter,
    ) -> Result<CollectionResponse, AppError> {
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

        // 2. Build ORDER BY clause
        let normalized_artist_asc =
            r#"REGEXP_REPLACE(LOWER(rc.artist), '^the\s+', '', 'i') COLLATE "C" ASC"#;
        let normalized_artist_desc =
            r#"REGEXP_REPLACE(LOWER(rc.artist), '^the\s+', '', 'i') COLLATE "C" DESC"#;

        let order_by = match filter.sort.as_str() {
            "year" => {
                let dir = if filter.sort_order == "desc" {
                    "DESC"
                } else {
                    "ASC"
                };
                format!(
                    "rc.release_year {dir} NULLS LAST, {normalized_artist_asc} NULLS LAST, rc.title ASC"
                )
            }
            "format" => {
                let dir = if filter.sort_order == "desc" {
                    "DESC"
                } else {
                    "ASC"
                };
                format!(
                    "rc.format {dir} NULLS LAST, {normalized_artist_asc} NULLS LAST, rc.release_year ASC NULLS LAST, rc.title ASC"
                )
            }
            "listens" => {
                let dir = if filter.sort_order == "desc" {
                    "DESC"
                } else {
                    "ASC"
                };
                format!(
                    "COALESCE(le.listen_count, 0) {dir}, {normalized_artist_asc} NULLS LAST, rc.release_year ASC NULLS LAST"
                )
            }
            "artist" => {
                let dir = if filter.sort_order == "desc" {
                    normalized_artist_desc
                } else {
                    normalized_artist_asc
                };
                format!("{dir} NULLS LAST, rc.release_year ASC NULLS LAST, rc.title ASC")
            }
            _ => {
                let dir = if filter.sort_order == "desc" {
                    "DESC"
                } else {
                    "ASC"
                };
                format!("ci.added_at {dir}")
            }
        };

        // 3. Fetch paged results with lowest_price and median_price cast to float8
        let offset = ((filter.page - 1) * filter.per_page) as i64;
        let limit = filter.per_page as i64;

        let select_sql = format!(
            "SELECT ci.id as item_id, ci.instance_id, ci.added_at, ci.media_condition, ci.sleeve_condition,
                    rc.id as record_id, rc.discogs_id, rc.title, rc.artist, rc.release_year, rc.thumb_url, rc.format,
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
             ) le ON le.record_id = ci.record_id
             WHERE {where_clause}
             ORDER BY {order_by}
             LIMIT {limit} OFFSET {offset}"
        );

        let mut select_query = sqlx::query(&select_sql).bind(user_id);
        select_query = Self::bind_filter_params(select_query, &filter);
        let rows = select_query
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;

        // 4. Batch fetch genres
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

        // 5. Map to CollectionRelease DTOs
        let mut releases = Vec::with_capacity(rows.len());
        for row in rows {
            let record_id: i64 = row.get("record_id");
            let discogs_id: i64 = row.get("discogs_id");
            let instance_id: i64 = row.get("instance_id");
            let added_at: chrono::NaiveDateTime = row.get("added_at");
            let media_cond: Option<String> = row.get("media_condition");
            let sleeve_cond: Option<String> = row.get("sleeve_condition");
            let title: String = row.get("title");
            let artist_name: Option<String> = row.get("artist");
            let release_year: Option<String> = row.get("release_year");
            let thumb_url: Option<String> = row.get("thumb_url");
            let format_str: Option<String> = row.get("format");
            let lowest_price: Option<f64> = row.get("lowest_price");
            let median_price: Option<f64> = row.get("median_price");
            let play_count: i64 = row.get("play_count");
            let last_played_at: Option<chrono::NaiveDateTime> = row.get("last_played_at");

            let year_i32 = release_year.as_deref().and_then(|y| y.parse::<i32>().ok());
            let genres = genres_map.remove(&record_id).unwrap_or_default();

            let artist = artist_name.unwrap_or_default();
            let artists = if artist.is_empty() {
                Vec::new()
            } else {
                vec![DiscogsArtist {
                    name: artist,
                    id: None,
                }]
            };

            let mut notes = Vec::new();
            if let Some(mc) = &media_cond {
                notes.push(CollectionNote {
                    field_id: Some(1),
                    value: Some(mc.clone()),
                });
            }
            if let Some(sc) = &sleeve_cond {
                notes.push(CollectionNote {
                    field_id: Some(2),
                    value: Some(sc.clone()),
                });
            }

            releases.push(CollectionRelease {
                id: discogs_id,
                instance_id,
                listen_count: play_count,
                date_added: added_at.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                rating: None,
                media_condition: media_cond,
                sleeve_condition: sleeve_cond,
                last_played_at: last_played_at
                    .map(|lp| lp.format("%Y-%m-%dT%H:%M:%SZ").to_string()),
                notes: Some(notes),
                basic_information: BasicInformation {
                    id: discogs_id,
                    title,
                    artists,
                    year: year_i32,
                    thumb_url,
                    cover_image: None,
                    tracklist: None,
                    formats: None,
                    labels: None,
                    genres,
                    styles: Vec::new(),
                    format: format_str.unwrap_or_else(|| "LP".to_string()),
                    lowest_price,
                    median_price,
                },
            });
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
        };

        let where_clause = Self::build_where_clause(&filter);

        let sql = format!(
            "SELECT ci.id as item_id, ci.instance_id, ci.added_at, ci.media_condition, ci.sleeve_condition,
                    rc.id as record_id, rc.discogs_id, rc.title, rc.artist, rc.release_year, rc.thumb_url, rc.format,
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
             ) le ON le.record_id = ci.record_id
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

        let record_id: i64 = row.get("record_id");
        let discogs_id: i64 = row.get("discogs_id");
        let instance_id: i64 = row.get("instance_id");
        let added_at: chrono::NaiveDateTime = row.get("added_at");
        let media_cond: Option<String> = row.get("media_condition");
        let sleeve_cond: Option<String> = row.get("sleeve_condition");
        let title: String = row.get("title");
        let artist_name: Option<String> = row.get("artist");
        let release_year: Option<String> = row.get("release_year");
        let thumb_url: Option<String> = row.get("thumb_url");
        let format_str: Option<String> = row.get("format");
        let lowest_price: Option<f64> = row.get("lowest_price");
        let median_price: Option<f64> = row.get("median_price");
        let play_count: i64 = row.get("play_count");
        let last_played_at: Option<chrono::NaiveDateTime> = row.get("last_played_at");

        let year_i32 = release_year.as_deref().and_then(|y| y.parse::<i32>().ok());
        let genre_rows = sqlx::query("SELECT genre FROM record_genres WHERE record_id = $1")
            .bind(record_id)
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
        let genres: Vec<String> = genre_rows.iter().map(|r| r.get("genre")).collect();

        let artist = artist_name.unwrap_or_default();
        let artists = if artist.is_empty() {
            Vec::new()
        } else {
            vec![DiscogsArtist {
                name: artist,
                id: None,
            }]
        };

        let mut notes = Vec::new();
        if let Some(mc) = &media_cond {
            notes.push(CollectionNote {
                field_id: Some(1),
                value: Some(mc.clone()),
            });
        }
        if let Some(sc) = &sleeve_cond {
            notes.push(CollectionNote {
                field_id: Some(2),
                value: Some(sc.clone()),
            });
        }

        Ok(Some(CollectionRelease {
            id: discogs_id,
            instance_id,
            listen_count: play_count,
            date_added: added_at.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            rating: None,
            media_condition: media_cond,
            sleeve_condition: sleeve_cond,
            last_played_at: last_played_at.map(|lp| lp.format("%Y-%m-%dT%H:%M:%SZ").to_string()),
            notes: Some(notes),
            basic_information: BasicInformation {
                id: discogs_id,
                title,
                artists,
                year: year_i32,
                thumb_url,
                cover_image: None,
                tracklist: None,
                formats: None,
                labels: None,
                genres,
                styles: Vec::new(),
                format: format_str.unwrap_or_else(|| "LP".to_string()),
                lowest_price,
                median_price,
            },
        }))
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

        query
    }
}
