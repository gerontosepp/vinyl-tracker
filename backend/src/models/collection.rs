use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::models::discogs::{DiscogsArtist, DiscogsFormat, DiscogsLabel, DiscogsPagination, DiscogsTrack};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionNote {
    #[serde(rename = "field_id")]
    pub field_id: Option<i64>,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicInformation {
    pub id: i64,
    pub title: String,
    pub artists: Vec<DiscogsArtist>,
    pub year: Option<i32>,
    #[serde(rename = "thumb")]
    pub thumb_url: Option<String>,
    #[serde(rename = "cover_image")]
    pub cover_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tracklist: Option<Vec<DiscogsTrack>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formats: Option<Vec<DiscogsFormat>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<DiscogsLabel>>,
    pub genres: Vec<String>,
    pub styles: Vec<String>,
    pub format: String,
    #[serde(rename = "lowest_price")]
    pub lowest_price: Option<f64>,
    #[serde(rename = "median_price")]
    pub median_price: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionRelease {
    pub id: i64,
    #[serde(rename = "instance_id")]
    pub instance_id: i64,
    #[serde(rename = "listen_count")]
    pub listen_count: i64,
    #[serde(rename = "date_added")]
    pub date_added: String,
    pub rating: Option<i32>,
    #[serde(rename = "basic_information")]
    pub basic_information: BasicInformation,
    #[serde(rename = "media_condition")]
    pub media_condition: Option<String>,
    #[serde(rename = "sleeve_condition")]
    pub sleeve_condition: Option<String>,
    #[serde(rename = "last_played_at")]
    pub last_played_at: Option<String>,
    pub notes: Option<Vec<CollectionNote>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionResponse {
    pub releases: Vec<CollectionRelease>,
    pub pagination: DiscogsPagination,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResultDto {
    pub status: String,
    pub added: i32,
    pub updated: i32,
    pub removed: i32,
    pub total: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceRefreshResultDto {
    pub updated_count: i32,
    pub failed_count: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CollectionQueryParams {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    pub sort: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub genres: Option<String>,
    pub years: Option<String>,
    pub not_played_since: Option<String>,
    pub unplayed_only: Option<bool>,
    pub min_plays: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct ParsedCollectionFilter {
    pub page: u32,
    pub per_page: u32,
    pub sort: String,
    pub sort_order: String,
    pub category: String,
    pub search: Option<String>,
    pub genres: Vec<String>,
    pub years: Vec<String>,
    pub not_played_since: Option<DateTime<Utc>>,
    pub unplayed_only: bool,
    pub min_plays: Option<i32>,
}

impl From<CollectionQueryParams> for ParsedCollectionFilter {
    fn from(params: CollectionQueryParams) -> Self {
        let page = params.page.unwrap_or(1).max(1);
        let per_page = params.per_page.unwrap_or(50).clamp(1, 100);
        let sort = params
            .sort
            .or(params.sort_by)
            .unwrap_or_else(|| "artist".to_string())
            .to_lowercase();
        let sort_order = params.sort_order.unwrap_or_else(|| "asc".to_string()).to_lowercase();
        
        let category = match params.category.as_deref() {
            Some(c) if c.eq_ignore_ascii_case("vinyl") => "vinyl".to_string(),
            Some(c) if c.eq_ignore_ascii_case("cd") => "cd".to_string(),
            _ => "all".to_string(),
        };

        let search = params.search.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

        let genres = params
            .genres
            .map(|g| {
                g.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        let years = params
            .years
            .map(|y| parse_years_filter(&y))
            .unwrap_or_default();

        let not_played_since = params
            .not_played_since
            .as_deref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok().map(|dt| dt.with_timezone(&Utc)));

        let unplayed_only = params.unplayed_only.unwrap_or(false);
        let min_plays = params.min_plays.filter(|p| *p > 0);

        Self {
            page,
            per_page,
            sort,
            sort_order,
            category,
            search,
            genres,
            years,
            not_played_since,
            unplayed_only,
            min_plays,
        }
    }
}

/// Parses year filter expressions such as "1970-1979", "1980s", "1975,1976" into individual years.
pub fn parse_years_filter(input: &str) -> Vec<String> {
    let mut years = Vec::new();
    for part in input.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }

        // Check decade range e.g. "1970-1979"
        let range = part.split_once('-').and_then(|(s1, s2)| {
            match (s1.trim().parse::<i32>(), s2.trim().parse::<i32>()) {
                (Ok(start), Ok(end)) if start <= end && (end - start) <= 50 => Some((start, end)),
                _ => None,
            }
        });
        if let Some((start, end)) = range {
            for y in start..=end {
                years.push(y.to_string());
            }
            continue;
        }

        // Check decade notation e.g. "1980s"
        let decade = part
            .strip_suffix(['s', 'S'])
            .and_then(|d| d.trim().parse::<i32>().ok());
        if let Some(start) = decade {
            for y in start..=(start + 9) {
                years.push(y.to_string());
            }
            continue;
        }

        // Direct single year e.g. "1977"
        if part.parse::<i32>().is_ok() {
            years.push(part.to_string());
        }
    }

    years.sort();
    years.dedup();
    years
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_years_filter() {
        assert_eq!(
            parse_years_filter("1970-1972,1980"),
            vec!["1970", "1971", "1972", "1980"]
        );
        assert_eq!(
            parse_years_filter("1990s"),
            vec!["1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999"]
        );
    }
}
