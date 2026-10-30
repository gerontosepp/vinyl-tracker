use serde::{Deserialize, Serialize};
pub use vinyl_api_types::discogs::{
    DiscogsArtist, DiscogsFormat, DiscogsIdentifier, DiscogsLabel, DiscogsPagination,
    DiscogsSearchResponse, DiscogsSearchResult, DiscogsTrack,
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
    pub identifiers: Option<Vec<DiscogsIdentifier>>,
    pub genres: Option<Vec<String>>,
    pub styles: Option<Vec<String>>,
    pub lowest_price: Option<f64>,
    pub median_price: Option<f64>,
    pub num_for_sale: Option<i32>,
    pub notes: Option<String>,
    pub country: Option<String>,
    pub released: Option<String>,
    /// Full-size images of the release; the primary one is the cover.
    #[serde(default)]
    pub images: Option<Vec<DiscogsImage>>,
}

impl DiscogsRelease {
    /// Full-resolution cover: the primary image, else the first one.
    pub fn cover_url(&self) -> Option<String> {
        let images = self.images.as_deref()?;
        images
            .iter()
            .find(|i| i.kind.as_deref() == Some("primary"))
            .or_else(|| images.first())
            .and_then(|i| i.uri.clone())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsImage {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub uri: Option<String>,
}

/// Criteria for `GET /database/search`: free text and/or structured fields.
///
/// Older pressings without barcode are found most reliably by catalog number plus label.
#[derive(Debug, Clone, Default)]
pub struct DiscogsSearchFilter {
    pub query: Option<String>,
    pub catno: Option<String>,
    pub label: Option<String>,
    pub artist: Option<String>,
    pub release_title: Option<String>,
    pub year: Option<String>,
    pub country: Option<String>,
    pub format: Option<String>,
}

impl DiscogsSearchFilter {
    pub fn query(query: impl Into<String>) -> Self {
        Self {
            query: Some(query.into()),
            ..Self::default()
        }
    }

    /// Discogs query parameters of all non-blank criteria (free text maps to `q`).
    pub fn query_pairs(&self) -> Vec<(&'static str, &str)> {
        [
            ("q", &self.query),
            ("catno", &self.catno),
            ("label", &self.label),
            ("artist", &self.artist),
            ("release_title", &self.release_title),
            ("year", &self.year),
            ("country", &self.country),
            ("format", &self.format),
        ]
        .into_iter()
        .filter_map(|(key, value)| {
            value
                .as_deref()
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(|v| (key, v))
        })
        .collect()
    }

    pub fn is_empty(&self) -> bool {
        self.query_pairs().is_empty()
    }
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

/// Media classification of a single Discogs format entry.
struct FormatEntry {
    is_cd: bool,
    is_vinyl: bool,
    qty: i32,
    double_cd_hint: bool,
    /// Also set for gatefold sleeves (legacy heuristic of `determine_format`).
    double_lp_hint: bool,
    explicit_double_lp: bool,
}

fn classify_format(f: &DiscogsFormat) -> FormatEntry {
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

    let double_cd_hint = descs
        .iter()
        .any(|d| d.contains("2xcd") || d.contains("2 x cd") || d.contains("double cd"));

    let explicit_double_lp = descs
        .iter()
        .any(|d| d.contains("2xlp") || d.contains("2 x lp") || d.contains("double lp"));
    let double_lp_hint = explicit_double_lp || descs.iter().any(|d| d.contains("gatefold"));

    FormatEntry {
        is_cd,
        is_vinyl,
        qty,
        double_cd_hint,
        double_lp_hint,
        explicit_double_lp,
    }
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

    for entry in formats.iter().map(classify_format) {
        if entry.is_cd {
            has_cd = true;
            cd_qty += entry.qty;
            if entry.qty >= 2 || entry.double_cd_hint {
                has_double_cd = true;
            }
        }

        if entry.is_vinyl {
            has_vinyl = true;
            vinyl_qty += entry.qty;
            if entry.qty >= 2 || entry.double_lp_hint {
                has_double_lp = true;
            }
        }
    }

    // Vinyl wins: a CD in a release with vinyl is a bonus inside the LP sleeve
    if has_vinyl {
        let double = has_double_lp || vinyl_qty >= 2;
        return if double { "Double LP" } else { "LP" }.to_string();
    }
    if has_double_cd || cd_qty >= 2 {
        return "Double CD".to_string();
    }
    if has_cd {
        return "CD".to_string();
    }

    "LP".to_string()
}

/// Number of discs a release occupies on the shelf: the summed `qty` of the formats of its
/// medium (CD if [`determine_format`] classifies it as CD, otherwise vinyl). `None` when the
/// formats are unknown, so callers fall back to the format label.
pub fn disc_count(formats: Option<&[DiscogsFormat]>) -> Option<i16> {
    let formats = formats.filter(|f| !f.is_empty())?;
    let is_cd = determine_format(Some(formats)).contains("CD");

    let (mut discs, mut double_hint) = (0i32, false);
    for entry in formats.iter().map(classify_format) {
        let matches = if is_cd { entry.is_cd } else { entry.is_vinyl };
        if matches {
            discs += entry.qty.max(1);
            double_hint |= if is_cd {
                entry.double_cd_hint
            } else {
                entry.explicit_double_lp
            };
        }
    }
    if discs == 0 {
        return None;
    }
    if discs == 1 && double_hint {
        discs = 2;
    }
    Some(discs.clamp(1, i16::MAX as i32) as i16)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_filter_query_pairs_skip_blank_values() {
        let filter = DiscogsSearchFilter {
            query: Some("  ".into()),
            catno: Some(" SHVL 804 ".into()),
            label: Some("Harvest".into()),
            country: Some(String::new()),
            ..DiscogsSearchFilter::default()
        };
        assert_eq!(
            filter.query_pairs(),
            vec![("catno", "SHVL 804"), ("label", "Harvest")]
        );
        assert!(!filter.is_empty());
    }

    #[test]
    fn test_search_filter_free_text_maps_to_q() {
        let filter = DiscogsSearchFilter::query("Abbey Road");
        assert_eq!(filter.query_pairs(), vec![("q", "Abbey Road")]);
        assert!(DiscogsSearchFilter::default().is_empty());
    }

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

    fn format(name: &str, qty: Option<&str>, descriptions: &[&str]) -> DiscogsFormat {
        DiscogsFormat {
            name: Some(name.to_string()),
            qty: qty.map(str::to_string),
            descriptions: Some(descriptions.iter().map(|d| d.to_string()).collect()),
            text: None,
        }
    }

    #[test]
    fn test_disc_count_single_and_double_lp() {
        assert_eq!(
            disc_count(Some(&[format("Vinyl", Some("1"), &["LP"])])),
            Some(1)
        );
        assert_eq!(
            disc_count(Some(&[format("Vinyl", Some("2"), &["LP"])])),
            Some(2)
        );
        assert_eq!(
            disc_count(Some(&[format("Vinyl", Some("1"), &["2xLP", "Album"])])),
            Some(2),
            "description hint without qty"
        );
        assert_eq!(
            disc_count(Some(&[format("Vinyl", Some("1"), &["LP", "Gatefold"])])),
            Some(1),
            "a gatefold sleeve is not a second disc"
        );
    }

    #[test]
    fn test_disc_count_box_set_sums_vinyl_entries() {
        let formats = [
            format("Box Set", Some("1"), &["Compilation"]),
            format("Vinyl", Some("5"), &["LP"]),
        ];
        assert_eq!(disc_count(Some(&formats)), Some(5));
    }

    #[test]
    fn test_disc_count_cd_ignores_bonus_media_of_other_kind() {
        let formats = [
            format("CD", Some("2"), &["Album"]),
            format("DVD", Some("1"), &["NTSC"]),
        ];
        assert_eq!(disc_count(Some(&formats)), Some(2));

        let mixed = [
            format("Vinyl", Some("2"), &["LP"]),
            format("CD", Some("1"), &[]),
        ];
        assert_eq!(determine_format(Some(&mixed)), "Double LP");
        assert_eq!(
            disc_count(Some(&mixed)),
            Some(2),
            "vinyl release counts LPs only"
        );
    }

    #[test]
    fn test_determine_format_vinyl_with_bonus_cd_is_lp() {
        // The Flaming Lips – With A Little Help From My Fwends (Discogs 6246137)
        let lp_with_cd = [
            format("Vinyl", Some("1"), &["LP", "Album", "Limited Edition"]),
            format("CD", Some("1"), &["Album"]),
            format("All Media", Some("1"), &[]),
        ];
        assert_eq!(determine_format(Some(&lp_with_cd)), "LP");
        assert_eq!(disc_count(Some(&lp_with_cd)), Some(1));

        let lp_with_double_cd = [
            format("Vinyl", Some("1"), &["LP"]),
            format("CD", Some("2"), &["Album"]),
        ];
        assert_eq!(determine_format(Some(&lp_with_double_cd)), "LP");

        let cd_with_dvd = [
            format("CD", Some("1"), &["Album"]),
            format("DVD", Some("1"), &[]),
        ];
        assert_eq!(determine_format(Some(&cd_with_dvd)), "CD");
    }

    #[test]
    fn test_disc_count_missing_qty_or_formats() {
        assert_eq!(disc_count(Some(&[format("Vinyl", None, &["LP"])])), Some(1));
        assert_eq!(disc_count(None), None);
        assert_eq!(disc_count(Some(&[])), None);
        assert_eq!(
            disc_count(Some(&[format("Cassette", Some("1"), &[])])),
            None,
            "no entry of the classified medium"
        );
    }
}

#[cfg(test)]
mod cover_url_tests {
    use super::DiscogsRelease;
    use serde_json::json;

    fn release(images: serde_json::Value) -> DiscogsRelease {
        serde_json::from_value(json!({ "id": 1, "title": "T", "images": images })).unwrap()
    }

    #[test]
    fn cover_url_should_prefer_the_primary_image() {
        let r = release(json!([
            {"type": "secondary", "uri": "https://i.discogs.com/b.jpg"},
            {"type": "primary", "uri": "https://i.discogs.com/a.jpg"}
        ]));
        assert_eq!(
            r.cover_url().as_deref(),
            Some("https://i.discogs.com/a.jpg")
        );
    }

    #[test]
    fn cover_url_should_fall_back_to_the_first_image() {
        let r = release(json!([{"type": "secondary", "uri": "https://i.discogs.com/b.jpg"}]));
        assert_eq!(
            r.cover_url().as_deref(),
            Some("https://i.discogs.com/b.jpg")
        );
    }

    #[test]
    fn cover_url_should_be_none_without_images() {
        let r: DiscogsRelease = serde_json::from_value(json!({ "id": 1, "title": "T" })).unwrap();
        assert_eq!(r.cover_url(), None);
    }
}
