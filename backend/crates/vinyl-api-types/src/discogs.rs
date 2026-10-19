use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsArtist {
    pub id: Option<i64>,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsTrack {
    pub position: Option<String>,
    pub title: String,
    pub duration: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsFormat {
    pub name: Option<String>,
    pub qty: Option<String>,
    pub descriptions: Option<Vec<String>>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsLabel {
    pub id: Option<i64>,
    pub name: String,
    pub catno: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsPagination {
    pub page: u32,
    pub pages: u32,
    pub per_page: u32,
    pub items: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsSearchResult {
    pub id: i64,
    pub title: String,
    pub thumb: Option<String>,
    pub cover_image: Option<String>,
    pub year: Option<String>,
    pub format: Option<Vec<String>>,
    pub genre: Option<Vec<String>>,
    pub style: Option<Vec<String>>,
    pub barcode: Option<Vec<String>>,
    pub catno: Option<String>,
    pub country: Option<String>,
    #[serde(rename = "type")]
    pub type_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscogsSearchResponse {
    pub pagination: DiscogsPagination,
    pub results: Vec<DiscogsSearchResult>,
}
