use serde::{Deserialize, Serialize};

/// A record on the user's Want-to-Have list (#310): known from label recognition or search, not
/// owned. Details (tracklist, labels) come from `GET /api/records/{discogs_id}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WantToHaveItemDto {
    pub id: i64,
    #[serde(rename = "discogs_id")]
    pub discogs_id: i64,
    pub title: String,
    pub artist: String,
    pub year: Option<String>,
    #[serde(rename = "thumb_url")]
    pub thumb_url: Option<String>,
    pub format: Option<String>,
    pub genres: Vec<String>,
    /// UTC, ISO 8601
    #[serde(rename = "created_at")]
    pub created_at: String,
}

/// Adds a Discogs release to the Want-to-Have list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddWantToHaveRequestDto {
    #[serde(alias = "discogsId")]
    pub discogs_id: i64,
}

/// Which of the queried Discogs IDs are already owned or on the Want-to-Have list.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WantToHaveStatusDto {
    #[serde(rename = "in_collection")]
    pub in_collection: Vec<i64>,
    #[serde(rename = "in_want_to_have")]
    pub in_want_to_have: Vec<i64>,
}

/// Online sources for a Want-to-Have record (#319): all Vinyl versions of its Discogs master
/// with marketplace data, plus search links to shops.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseSourcesDto {
    /// Wanted release
    #[serde(rename = "discogs_id")]
    pub discogs_id: i64,
    #[serde(rename = "master_id")]
    pub master_id: Option<i64>,
    /// Currency of all prices
    pub currency: String,
    /// The wanted version first, then by release date
    pub versions: Vec<VinylVersionDto>,
    /// Number of Vinyl versions Discogs knows for the master
    #[serde(rename = "total_versions")]
    pub total_versions: u32,
    /// True if `versions` holds only a part of `total_versions`
    pub truncated: bool,
    #[serde(rename = "shop_links")]
    pub shop_links: Vec<ShopLinkDto>,
}

/// One pressing of the wanted record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VinylVersionDto {
    #[serde(rename = "release_id")]
    pub release_id: i64,
    pub title: String,
    pub label: Option<String>,
    pub catno: Option<String>,
    pub country: Option<String>,
    pub released: Option<String>,
    pub format: Option<String>,
    pub thumb: Option<String>,
    /// True for the release that is on the Want-to-Have list
    #[serde(rename = "is_wanted")]
    pub is_wanted: bool,
    #[serde(rename = "marketplace_url")]
    pub marketplace_url: String,
    /// `None` until loaded (see `GET /api/want-to-have/{id}/sources/{release_id}/stats`)
    pub stats: Option<MarketplaceStatsDto>,
}

/// Discogs marketplace figures of one release.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceStatsDto {
    #[serde(rename = "release_id")]
    pub release_id: i64,
    #[serde(rename = "lowest_price")]
    pub lowest_price: Option<f64>,
    pub currency: Option<String>,
    #[serde(rename = "num_for_sale")]
    pub num_for_sale: i32,
    #[serde(rename = "blocked_from_sale")]
    pub blocked_from_sale: bool,
}

/// Search link to an online shop.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopLinkDto {
    /// Stable key: `discogs`, `ebay`, `amazon`, `jpc`, `hhv`
    pub shop: String,
    pub name: String,
    pub url: String,
}
