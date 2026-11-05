//! Online sources for Want-to-Have records (#319): pure helpers that turn Discogs data into the
//! `PurchaseSourcesDto` (versions, marketplace links, shop search links). Fetching lives in
//! `DiscogsClient` and `WantToHaveService`.

use crate::models::{
    discogs::{DiscogsMarketplaceStats, DiscogsMasterVersions, DiscogsRelease},
    want_to_have::{MarketplaceStatsDto, ShopLinkDto, VinylVersionDto},
};
use url::Url;

/// Versions (wanted one first) whose marketplace figures are loaded together with the list.
pub const EAGER_STATS: usize = 5;

/// Shops with a search URL (`key`, `name`, `search URL`, `add "vinyl"`). The search terms are
/// appended URL-encoded. Record shops (JPC, HHV) get artist and title only: every extra word
/// narrows their search. General marketplaces (eBay, Amazon) need "vinyl", or they find CDs and
/// merchandise too. The catalog number is left out everywhere – it belongs to one pressing, the
/// link is for the record.
const SHOPS: [(&str, &str, &str, bool); 4] = [
    ("ebay", "eBay", "https://www.ebay.de/sch/i.html?_nkw=", true),
    ("amazon", "Amazon", "https://www.amazon.de/s?k=", true),
    ("jpc", "JPC", "https://www.jpc.de/s/", false),
    ("hhv", "HHV", "https://www.hhv.de/shop/de/suche?q=", false),
];

pub fn marketplace_url(release_id: i64) -> String {
    format!("https://www.discogs.com/sell/release/{release_id}")
}

/// Discogs disambiguates artists with a numeric suffix (`Prince (2)`) and marks name variations
/// with `*`; both would spoil a shop search.
pub fn clean_artist(name: &str) -> String {
    let name = name.trim().trim_end_matches('*').trim_end();
    if let Some(open) = name.rfind(" (")
        && let Some(inner) = name[open + 2..].strip_suffix(')')
        && !inner.is_empty()
        && inner.chars().all(|c| c.is_ascii_digit())
    {
        return name[..open].to_string();
    }
    name.to_string()
}

/// Catalog numbers Discogs fills in when a label has none.
pub fn real_catno(catno: Option<&str>) -> Option<String> {
    catno
        .map(str::trim)
        .filter(|c| !c.is_empty() && !c.eq_ignore_ascii_case("none"))
        .map(str::to_string)
}

/// Artists of a release, cleaned and joined by spaces.
pub fn release_artist(release: &DiscogsRelease) -> String {
    release
        .artists
        .iter()
        .flatten()
        .map(|a| clean_artist(&a.name))
        // A compilation's "Various" would only spoil the search
        .filter(|name| !name.eq_ignore_ascii_case("various"))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Search links for the record: Discogs marketplace plus the shops in [`SHOPS`].
pub fn shop_links(
    artist: &str,
    title: &str,
    master_id: Option<i64>,
    release_id: i64,
) -> Vec<ShopLinkDto> {
    let discogs_url = match master_id {
        Some(master) => {
            format!("https://www.discogs.com/sell/list?master_id={master}&format=Vinyl")
        }
        None => marketplace_url(release_id),
    };
    let mut links = vec![ShopLinkDto {
        shop: "discogs".to_string(),
        name: "Discogs".to_string(),
        url: discogs_url,
    }];

    for (shop, name, base, add_vinyl) in SHOPS {
        let terms = [artist, title, if add_vinyl { "vinyl" } else { "" }]
            .iter()
            .map(|t| t.trim())
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        if let Some(url) = search_url(base, &terms) {
            links.push(ShopLinkDto {
                shop: shop.to_string(),
                name: name.to_string(),
                url,
            });
        }
    }
    links
}

/// Appends `terms` to `base`: as the last path segment if `base` ends with `/`, else as the
/// value of the trailing query parameter (`...?q=`).
fn search_url(base: &str, terms: &str) -> Option<String> {
    if let Some(path_base) = base.strip_suffix('/') {
        let mut url = Url::parse(path_base).ok()?;
        url.path_segments_mut().ok()?.push(terms);
        return Some(url.to_string());
    }
    let (page, key) = base.rsplit_once('?')?;
    let key = key.strip_suffix('=')?;
    Url::parse_with_params(page, [(key, terms)])
        .ok()
        .map(Into::into)
}

pub fn stats_dto(release_id: i64, stats: &DiscogsMarketplaceStats) -> MarketplaceStatsDto {
    MarketplaceStatsDto {
        release_id,
        lowest_price: stats.lowest_price.as_ref().map(|m| m.value),
        currency: stats.lowest_price.as_ref().map(|m| m.currency.clone()),
        num_for_sale: stats.num_for_sale.unwrap_or(0),
        blocked_from_sale: stats.blocked_from_sale.unwrap_or(false),
    }
}

/// The wanted release as a version row, built from its own Discogs data.
fn wanted_version(release: &DiscogsRelease) -> VinylVersionDto {
    let label = release.labels.iter().flatten().next();
    VinylVersionDto {
        release_id: release.id,
        title: release.title.clone(),
        label: label.map(|l| l.name.clone()),
        catno: real_catno(label.and_then(|l| l.catno.as_deref())),
        country: release.country.clone(),
        released: release
            .released
            .clone()
            .or_else(|| release.year.map(|y| y.to_string())),
        format: release
            .formats
            .iter()
            .flatten()
            .next()
            .and_then(|f| f.name.clone()),
        thumb: release.thumb.clone(),
        is_wanted: true,
        marketplace_url: marketplace_url(release.id),
        stats: None,
    }
}

/// Versions to show: all Vinyl versions of the master with the wanted one first. The master's
/// own entry is used for the wanted version when it is listed (same wording as the other rows);
/// a release without master, or one missing from the list (not Vinyl, beyond the page limit), is
/// built from its release data and shown on top. Returns `(versions, total, truncated)`.
pub fn build_versions(
    wanted: &DiscogsRelease,
    master: Option<&DiscogsMasterVersions>,
) -> (Vec<VinylVersionDto>, u32, bool) {
    let Some(master) = master else {
        return (vec![wanted_version(wanted)], 1, false);
    };

    let (mut versions, listed): (Vec<_>, Vec<_>) = master
        .versions
        .iter()
        .map(|v| VinylVersionDto {
            release_id: v.id,
            title: v.title.clone(),
            label: v.label.clone(),
            catno: real_catno(v.catno.as_deref()),
            country: v.country.clone(),
            released: v.released.clone(),
            format: v.format.clone(),
            thumb: v.thumb.clone(),
            is_wanted: v.id == wanted.id,
            marketplace_url: marketplace_url(v.id),
            stats: None,
        })
        .partition(|v| v.is_wanted);
    // `partition` keeps the order, so `versions` now holds the wanted entry (if listed) only
    let wanted_listed = !versions.is_empty();
    if !wanted_listed {
        versions.push(wanted_version(wanted));
    }
    versions.extend(listed);

    // An unlisted wanted release counts as one more, unless the list is cut off: then it is
    // most likely one of the versions beyond the cut and already part of Discogs' total.
    let total = master.total + u32::from(!wanted_listed && !master.truncated);
    (versions, total, master.truncated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::discogs::{DiscogsMasterVersion, DiscogsMoney};
    use vinyl_api_types::discogs::{DiscogsArtist, DiscogsLabel};

    fn release(id: i64) -> DiscogsRelease {
        DiscogsRelease {
            id,
            title: "Wanted".to_string(),
            artists: Some(vec![DiscogsArtist {
                id: None,
                name: "Prince (2)".to_string(),
            }]),
            year: Some(1984),
            thumb: None,
            cover_image: None,
            tracklist: None,
            formats: None,
            labels: Some(vec![DiscogsLabel {
                id: None,
                name: "Warner".to_string(),
                catno: Some("none".to_string()),
            }]),
            identifiers: None,
            genres: None,
            styles: None,
            lowest_price: None,
            median_price: None,
            num_for_sale: None,
            notes: None,
            country: Some("US".to_string()),
            released: None,
            images: None,
            master_id: Some(7),
        }
    }

    fn version(id: i64) -> DiscogsMasterVersion {
        DiscogsMasterVersion {
            id,
            title: format!("v{id}"),
            format: Some("LP".to_string()),
            label: None,
            catno: Some("ABC 1".to_string()),
            country: None,
            released: Some("1985".to_string()),
            thumb: None,
        }
    }

    fn master(ids: &[i64], total: u32, truncated: bool) -> DiscogsMasterVersions {
        DiscogsMasterVersions {
            versions: ids.iter().map(|id| version(*id)).collect(),
            total,
            truncated,
        }
    }

    #[test]
    fn clean_artist_should_strip_discogs_suffixes() {
        assert_eq!(clean_artist("Prince (2)"), "Prince");
        assert_eq!(clean_artist("Madonna*"), "Madonna");
        assert_eq!(clean_artist("Portishead"), "Portishead");
    }

    #[test]
    fn clean_artist_should_keep_parentheses_that_are_part_of_the_name() {
        assert_eq!(clean_artist("Is (This) It"), "Is (This) It");
    }

    #[test]
    fn real_catno_should_drop_none_and_blank() {
        assert_eq!(real_catno(Some("None")), None);
        assert_eq!(real_catno(Some("  ")), None);
        assert_eq!(real_catno(None), None);
        assert_eq!(real_catno(Some(" XY 1 ")), Some("XY 1".to_string()));
    }

    #[test]
    fn shop_links_should_encode_umlauts_and_ampersands() {
        let links = shop_links("Sigur Rós & Co", "Ágætis byrjun", None, 5);
        let ebay = links.iter().find(|l| l.shop == "ebay").unwrap();
        assert!(ebay.url.starts_with("https://www.ebay.de/sch/i.html?_nkw="));
        assert!(ebay.url.contains("%C3%B3"), "umlaut encoded: {}", ebay.url);
        assert!(ebay.url.contains("%26"), "ampersand encoded: {}", ebay.url);
        assert!(!ebay.url.contains(" "));
    }

    #[test]
    fn shop_links_should_search_record_shops_for_artist_and_title_only() {
        // JPC finds nothing for "C'mon Tigre Lumina CT 004LP vinyl", but the plain terms work
        let links = shop_links("C'mon Tigre", "Lumina", None, 5);
        let url = |shop: &str| links.iter().find(|l| l.shop == shop).unwrap().url.clone();
        assert_eq!(url("jpc"), "https://www.jpc.de/s/C'mon%20Tigre%20Lumina");
        assert!(
            url("hhv").ends_with("q=C%27mon+Tigre+Lumina"),
            "{}",
            url("hhv")
        );
    }

    #[test]
    fn shop_links_should_add_vinyl_for_the_general_marketplaces() {
        let links = shop_links("A", "B", None, 5);
        for shop in ["ebay", "amazon"] {
            let url = &links.iter().find(|l| l.shop == shop).unwrap().url;
            assert!(url.to_lowercase().contains("vinyl"), "{shop}: {url}");
        }
    }

    #[test]
    fn shop_links_should_not_put_a_catalog_number_into_any_search() {
        let links = shop_links("A", "B", None, 5);
        assert!(links.iter().skip(1).all(|l| !l.url.contains("XY")));
    }

    #[test]
    fn shop_links_should_link_discogs_to_the_master_listing_when_there_is_a_master() {
        let links = shop_links("A", "B", Some(7), 5);
        assert_eq!(
            links[0].url,
            "https://www.discogs.com/sell/list?master_id=7&format=Vinyl"
        );
    }

    #[test]
    fn shop_links_should_link_discogs_to_the_release_without_master() {
        let links = shop_links("A", "B", None, 5);
        assert_eq!(links[0].url, "https://www.discogs.com/sell/release/5");
    }

    #[test]
    fn build_versions_should_put_the_wanted_version_first() {
        let (versions, total, truncated) =
            build_versions(&release(3), Some(&master(&[1, 2, 3, 4], 4, false)));
        let ids: Vec<i64> = versions.iter().map(|v| v.release_id).collect();
        assert_eq!(ids, vec![3, 1, 2, 4]);
        assert!(versions[0].is_wanted);
        assert!(versions[1..].iter().all(|v| !v.is_wanted));
        assert_eq!((total, truncated), (4, false));
    }

    #[test]
    fn build_versions_should_add_a_wanted_release_missing_from_the_list() {
        let (versions, total, _) = build_versions(&release(9), Some(&master(&[1, 2], 2, false)));
        assert_eq!(versions[0].release_id, 9);
        assert_eq!(versions.len(), 3);
        assert_eq!(total, 3);
    }

    #[test]
    fn build_versions_should_pass_truncation_on() {
        let (_, total, truncated) = build_versions(&release(1), Some(&master(&[1], 450, true)));
        assert_eq!((total, truncated), (450, true));
    }

    #[test]
    fn build_versions_should_not_count_an_unlisted_wanted_release_twice_when_truncated() {
        // 450 versions known, the oldest 300 fetched, the wanted one is among the rest
        let (versions, total, _) = build_versions(&release(900), Some(&master(&[1, 2], 450, true)));
        assert_eq!(versions[0].release_id, 900);
        assert_eq!(total, 450);
    }

    #[test]
    fn build_versions_should_describe_the_wanted_version_like_the_others_when_listed() {
        let (versions, _, _) = build_versions(&release(3), Some(&master(&[1, 3], 2, false)));
        assert_eq!(versions[0].release_id, 3);
        assert_eq!(
            versions[0].format.as_deref(),
            Some("LP"),
            "from the master entry"
        );
        assert_eq!(versions.len(), 2, "listed once");
    }

    #[test]
    fn release_artist_should_leave_out_various() {
        let mut various = release(1);
        various.artists = Some(vec![DiscogsArtist {
            id: None,
            name: "Various".to_string(),
        }]);
        assert_eq!(release_artist(&various), "");
        assert_eq!(release_artist(&release(1)), "Prince");
    }

    #[test]
    fn build_versions_should_return_only_the_wanted_release_without_master() {
        let (versions, total, truncated) = build_versions(&release(3), None);
        assert_eq!(versions.len(), 1);
        assert_eq!((total, truncated), (1, false));
    }

    #[test]
    fn build_versions_should_take_label_and_catno_of_the_wanted_release_from_its_labels() {
        let (versions, _, _) = build_versions(&release(3), None);
        assert_eq!(versions[0].label.as_deref(), Some("Warner"));
        assert_eq!(versions[0].catno, None, "catno 'none' is dropped");
        assert_eq!(versions[0].released.as_deref(), Some("1984"));
    }

    #[test]
    fn stats_dto_should_map_an_empty_marketplace() {
        let dto = stats_dto(
            4,
            &DiscogsMarketplaceStats {
                lowest_price: None,
                num_for_sale: None,
                blocked_from_sale: None,
            },
        );
        assert_eq!(dto.lowest_price, None);
        assert_eq!(dto.num_for_sale, 0);
        assert!(!dto.blocked_from_sale);
    }

    #[test]
    fn stats_dto_should_map_price_and_currency() {
        let dto = stats_dto(
            4,
            &DiscogsMarketplaceStats {
                lowest_price: Some(DiscogsMoney {
                    value: 12.5,
                    currency: "EUR".to_string(),
                }),
                num_for_sale: Some(23),
                blocked_from_sale: Some(false),
            },
        );
        assert_eq!(dto.lowest_price, Some(12.5));
        assert_eq!(dto.currency.as_deref(), Some("EUR"));
        assert_eq!(dto.num_for_sale, 23);
    }
}
