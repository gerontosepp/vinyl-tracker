use serde::{Deserialize, Serialize};
pub use vinyl_api_types::discogs::{
    DiscogsArtist, DiscogsFormat, DiscogsLabel, DiscogsPagination, DiscogsSearchResponse,
    DiscogsSearchResult, DiscogsTrack,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsRelease {
    pub id: i64,
    pub title: String,
    pub artists: Option<Vec<DiscogsArtist>>,
    pub year: Option<i32>,
    #[serde(alias = "thumb_url")]
    pub thumb: Option<String>,
    #[serde(alias = "cover_url")]
    pub cover_image: Option<String>,
    pub tracklist: Option<Vec<DiscogsTrack>>,
    pub formats: Option<Vec<DiscogsFormat>>,
    pub labels: Option<Vec<DiscogsLabel>>,
    pub genres: Option<Vec<String>>,
    pub styles: Option<Vec<String>>,
    pub lowest_price: Option<f64>,
    pub median_price: Option<f64>,
    pub num_for_sale: Option<i32>,
    pub notes: Option<String>,
    pub country: Option<String>,
    pub released: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsPriceSuggestion {
    pub value: f64,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsValueResponse {
    pub minimum: Option<String>,
    pub median: Option<String>,
    pub maximum: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsCollectionFieldsResponse {
    pub fields: Option<Vec<DiscogsCollectionField>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsCollectionField {
    pub id: i64,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub field_type: Option<String>,
    pub options: Option<Vec<String>>,
    pub position: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsFolderBasicInfo {
    pub id: i64,
    pub title: String,
    pub year: Option<i32>,
    pub thumb: Option<String>,
    pub cover_image: Option<String>,
    pub formats: Option<Vec<DiscogsFormat>>,
    pub labels: Option<Vec<DiscogsLabel>>,
    pub artists: Option<Vec<DiscogsArtist>>,
    pub genres: Option<Vec<String>>,
    pub styles: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsFolderReleaseItem {
    pub id: i64,
    pub instance_id: i64,
    pub date_added: Option<String>,
    pub rating: Option<i32>,
    pub basic_information: DiscogsFolderBasicInfo,
    pub notes: Option<Vec<crate::models::collection::CollectionNote>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsCollectionFolderResponse {
    pub pagination: DiscogsPagination,
    pub releases: Vec<DiscogsFolderReleaseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsAddReleaseResponse {
    pub instance_id: i64,
    pub resource_url: Option<String>,
}

/// Determines the canonical format label from Discogs format descriptions.
/// Matches the Java logic in `DiscogsDto.determineFormat`.
pub fn determine_format(formats: Option<&[DiscogsFormat]>) -> String {
    let formats = match formats {
        Some(f) if !f.is_empty() => f,
        _ => return "LP".to_string(),
    };

    let mut cd_qty = 0;
    let mut vinyl_qty = 0;
    let mut has_cd = false;
    let mut has_double_cd = false;
    let mut has_vinyl = false;
    let mut has_double_lp = false;

    for f in formats {
        let name = f.name.as_deref().unwrap_or("").trim().to_lowercase();
        let qty: i32 = f
            .qty
            .as_deref()
            .and_then(|q| q.trim().parse().ok())
            .unwrap_or(1);

        let descs: Vec<String> = f
            .descriptions
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .map(|d| d.to_lowercase())
            .collect();

        let is_cd = name.contains("cd")
            || descs.iter().any(|d| {
                d == "cd"
                    || d == "cdr"
                    || d == "cd-r"
                    || d.contains("compact disc")
                    || d.contains("2xcd")
                    || d.contains("2 x cd")
                    || d.contains("double cd")
            });

        let is_vinyl = name.contains("vinyl")
            || descs.iter().any(|d| {
                d.contains("lp")
                    || d.contains("vinyl")
                    || d.contains("12\"")
                    || d.contains("7\"")
                    || d.contains("10\"")
            });

        let desc_has_2x_cd = descs
            .iter()
            .any(|d| d.contains("2xcd") || d.contains("2 x cd") || d.contains("double cd"));

        let desc_has_2x_lp = descs.iter().any(|d| {
            d.contains("2xlp")
                || d.contains("2 x lp")
                || d.contains("double lp")
                || d.contains("gatefold")
        });

        if is_cd {
            has_cd = true;
            cd_qty += qty;
            if qty >= 2 || desc_has_2x_cd {
                has_double_cd = true;
            }
        }

        if is_vinyl {
            has_vinyl = true;
            vinyl_qty += qty;
            if qty >= 2 || desc_has_2x_lp {
                has_double_lp = true;
            }
        }
    }

    if has_double_cd || cd_qty >= 2 {
        return "Double CD".to_string();
    }
    if has_double_lp || vinyl_qty >= 2 {
        return "Double LP".to_string();
    }
    if has_cd {
        return "CD".to_string();
    }
    if has_vinyl {
        return "LP".to_string();
    }

    "LP".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_format_double_lp() {
        let f = vec![DiscogsFormat {
            name: Some("Vinyl".to_string()),
            qty: Some("2".to_string()),
            descriptions: Some(vec!["LP".to_string(), "Album".to_string()]),
            text: None,
        }];
        assert_eq!(determine_format(Some(&f)), "Double LP");
    }

    #[test]
    fn test_determine_format_double_cd() {
        let f = vec![DiscogsFormat {
            name: Some("CD".to_string()),
            qty: Some("1".to_string()),
            descriptions: Some(vec!["2xCD".to_string()]),
            text: None,
        }];
        assert_eq!(determine_format(Some(&f)), "Double CD");
    }

    #[test]
    fn test_determine_format_standard_lp() {
        let f = vec![DiscogsFormat {
            name: Some("Vinyl".to_string()),
            qty: Some("1".to_string()),
            descriptions: Some(vec!["LP".to_string()]),
            text: None,
        }];
        assert_eq!(determine_format(Some(&f)), "LP");
    }
}
