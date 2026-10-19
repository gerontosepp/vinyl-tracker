use crate::{
    error::AppError,
    models::discogs::{
        DiscogsAddReleaseResponse, DiscogsCollectionFieldsResponse,
        DiscogsCollectionFolderResponse, DiscogsPriceSuggestion, DiscogsRelease,
        DiscogsSearchResponse, DiscogsValueResponse,
    },
};
use governor::{
    Quota, RateLimiter,
    clock::DefaultClock,
    middleware::NoOpMiddleware,
    state::{InMemoryState, NotKeyed},
};
use moka::future::Cache;
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue, USER_AGENT};
use std::{collections::HashMap, num::NonZeroU32, sync::Arc, time::Duration};

type DirectRateLimiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock, NoOpMiddleware>;

#[derive(Clone)]
pub struct DiscogsClient {
    http: reqwest::Client,
    base_url: String,
    user_agent: String,
    rate_limiter: Arc<DirectRateLimiter>,
    release_cache: Cache<i64, Arc<DiscogsRelease>>,
    price_cache: Cache<i64, Arc<HashMap<String, DiscogsPriceSuggestion>>>,
}

impl DiscogsClient {
    pub fn new(user_agent: String) -> Self {
        Self::with_base_url("https://api.discogs.com".to_string(), user_agent)
    }

    pub fn with_base_url(base_url: String, user_agent: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("Failed to build HTTP client");

        // 60 requests per minute according to Discogs API guidelines
        let quota = Quota::per_minute(NonZeroU32::new(60).unwrap());
        let rate_limiter = Arc::new(RateLimiter::direct(quota));

        let release_cache = Cache::builder()
            .max_capacity(5000)
            .time_to_live(Duration::from_secs(86400)) // 24 hours
            .build();

        let price_cache = Cache::builder()
            .max_capacity(5000)
            .time_to_live(Duration::from_secs(3600)) // 1 hour
            .build();

        Self {
            http,
            base_url,
            user_agent,
            rate_limiter,
            release_cache,
            price_cache,
        }
    }

    async fn wait_for_rate_limit(&self) {
        self.rate_limiter.until_ready().await;
    }

    fn auth_headers(&self, token: &str) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_str(&self.user_agent)
                .map_err(|e| AppError::Internal(format!("Invalid User-Agent header: {e}")))?,
        );
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Discogs token={token}"))
                .map_err(|e| AppError::Internal(format!("Invalid token header: {e}")))?,
        );
        Ok(headers)
    }

    pub async fn get_release(
        &self,
        release_id: i64,
        token: &str,
    ) -> Result<Arc<DiscogsRelease>, AppError> {
        // Check cache first
        if let Some(cached) = self.release_cache.get(&release_id).await {
            tracing::debug!("Returning release {release_id} from Moka cache");
            return Ok(cached);
        }

        self.wait_for_rate_limit().await;

        let url = format!("{}/releases/{release_id}", self.base_url);
        let headers = self.auth_headers(token)?;

        tracing::info!("Fetching release {release_id} from Discogs API");
        let res = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Discogs request error: {e}")))?;

        if !res.status().is_success() {
            let status = res.status();
            if status == reqwest::StatusCode::NOT_FOUND {
                return Err(AppError::NotFound(format!(
                    "Discogs release {release_id} not found"
                )));
            }
            return Err(AppError::Internal(format!(
                "Discogs API returned status {status}"
            )));
        }

        let release: DiscogsRelease = res.json().await.map_err(|e| {
            AppError::Internal(format!("Failed to parse Discogs release JSON: {e}"))
        })?;

        let release_arc = Arc::new(release);
        self.release_cache
            .insert(release_id, release_arc.clone())
            .await;

        Ok(release_arc)
    }

    pub async fn search_by_barcode(
        &self,
        barcode: &str,
        token: &str,
    ) -> Result<DiscogsSearchResponse, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!("{}/database/search", self.base_url);
        let headers = self.auth_headers(token)?;

        tracing::info!("Searching Discogs API for barcode: {barcode}");
        let res = self
            .http
            .get(&url)
            .headers(headers)
            .query(&[("barcode", barcode), ("type", "release")])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Discogs search request error: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Discogs search returned status {}",
                res.status()
            )));
        }

        let search_res: DiscogsSearchResponse = res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Discogs search JSON: {e}")))?;

        Ok(search_res)
    }

    pub async fn search(
        &self,
        query: &str,
        search_type: Option<&str>,
        page: u32,
        per_page: u32,
        token: &str,
    ) -> Result<DiscogsSearchResponse, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!("{}/database/search", self.base_url);
        let headers = self.auth_headers(token)?;

        let mut req = self.http.get(&url).headers(headers).query(&[
            ("q", query),
            ("page", &page.to_string()),
            ("per_page", &per_page.to_string()),
        ]);

        if let Some(st) = search_type {
            req = req.query(&[("type", st)]);
        }

        tracing::info!("Searching Discogs API for query: '{query}' (page: {page})");
        let res = req
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Discogs query request error: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Discogs search returned status {}",
                res.status()
            )));
        }

        let search_res: DiscogsSearchResponse = res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Discogs search JSON: {e}")))?;

        Ok(search_res)
    }

    pub async fn get_price_suggestions(
        &self,
        release_id: i64,
        token: &str,
    ) -> Result<Arc<HashMap<String, DiscogsPriceSuggestion>>, AppError> {
        if let Some(cached) = self.price_cache.get(&release_id).await {
            tracing::debug!("Returning price suggestions for {release_id} from cache");
            return Ok(cached);
        }

        self.wait_for_rate_limit().await;

        let url = format!(
            "{}/marketplace/price_suggestions/{release_id}",
            self.base_url
        );
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Price suggestion request error: {e}")))?;

        if !res.status().is_success() {
            return Ok(Arc::new(HashMap::new()));
        }

        let suggestions: HashMap<String, DiscogsPriceSuggestion> =
            res.json().await.unwrap_or_default();

        let suggestions_arc = Arc::new(suggestions);
        self.price_cache
            .insert(release_id, suggestions_arc.clone())
            .await;

        Ok(suggestions_arc)
    }

    pub async fn get_collection_value(
        &self,
        username: &str,
        token: &str,
    ) -> Result<DiscogsValueResponse, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!("{}/users/{username}/collection/value", self.base_url);
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .get(&url)
            .headers(headers)
            .query(&[("curr_abbr", "EUR")])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Collection value request error: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Discogs collection value returned status {}",
                res.status()
            )));
        }

        let val_res: DiscogsValueResponse = res.json().await.map_err(|e| {
            AppError::Internal(format!("Failed to parse collection value JSON: {e}"))
        })?;

        Ok(val_res)
    }

    pub async fn get_collection_fields(
        &self,
        username: &str,
        token: &str,
    ) -> Result<DiscogsCollectionFieldsResponse, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!("{}/users/{username}/collection/fields", self.base_url);
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Collection fields request error: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Discogs collection fields returned status {}",
                res.status()
            )));
        }

        let fields_res: DiscogsCollectionFieldsResponse = res.json().await.map_err(|e| {
            AppError::Internal(format!("Failed to parse collection fields JSON: {e}"))
        })?;

        Ok(fields_res)
    }

    pub async fn get_collection_releases(
        &self,
        username: &str,
        token: &str,
        page: u32,
        per_page: u32,
    ) -> Result<DiscogsCollectionFolderResponse, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!(
            "{}/users/{username}/collection/folders/0/releases",
            self.base_url
        );
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .get(&url)
            .headers(headers)
            .query(&[
                ("page", &page.to_string()),
                ("per_page", &per_page.to_string()),
                ("sort", &"artist".to_string()),
                ("sort_order", &"asc".to_string()),
            ])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Collection releases request error: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Discogs collection releases returned status {}",
                res.status()
            )));
        }

        let folder_res: DiscogsCollectionFolderResponse = res.json().await.map_err(|e| {
            AppError::Internal(format!("Failed to parse collection releases JSON: {e}"))
        })?;

        Ok(folder_res)
    }

    pub async fn add_release_to_folder(
        &self,
        username: &str,
        folder_id: i64,
        release_id: i64,
        token: &str,
    ) -> Result<DiscogsAddReleaseResponse, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!(
            "{}/users/{username}/collection/folders/{folder_id}/releases/{release_id}",
            self.base_url
        );
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .post(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Add release to folder request error: {e}")))?;

        if !res.status().is_success() {
            return Err(AppError::Internal(format!(
                "Discogs add release to folder returned status {}",
                res.status()
            )));
        }

        let add_res: DiscogsAddReleaseResponse = res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse add release JSON: {e}")))?;

        Ok(add_res)
    }

    pub async fn delete_release_instance(
        &self,
        username: &str,
        folder_id: i64,
        release_id: i64,
        instance_id: i64,
        token: &str,
    ) -> Result<(), AppError> {
        self.wait_for_rate_limit().await;

        let url = format!(
            "{}/users/{username}/collection/folders/{folder_id}/releases/{release_id}/instances/{instance_id}",
            self.base_url
        );
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .delete(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(format!("Delete release instance request error: {e}"))
            })?;

        if !res.status().is_success() && res.status() != reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::Internal(format!(
                "Discogs delete release instance returned status {}",
                res.status()
            )));
        }

        Ok(())
    }

    pub async fn is_release_in_collection(
        &self,
        username: &str,
        release_id: i64,
        token: &str,
    ) -> Result<bool, AppError> {
        self.wait_for_rate_limit().await;

        let url = format!(
            "{}/users/{username}/collection/releases/{release_id}",
            self.base_url
        );
        let headers = self.auth_headers(token)?;

        let res = self
            .http
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(format!("Check release in collection request error: {e}"))
            })?;

        if !res.status().is_success() {
            return Ok(false);
        }

        let folder_res: DiscogsCollectionFolderResponse =
            res.json().await.unwrap_or(DiscogsCollectionFolderResponse {
                pagination: crate::models::discogs::DiscogsPagination {
                    page: 1,
                    pages: 0,
                    per_page: 0,
                    items: 0,
                },
                releases: Vec::new(),
            });

        Ok(!folder_res.releases.is_empty())
    }

    pub async fn update_instance_field(
        &self,
        username: &str,
        release_id: i64,
        instance_id: i64,
        field_id: i64,
        value: &str,
        token: &str,
    ) -> Result<(), AppError> {
        self.wait_for_rate_limit().await;

        let url = format!(
            "{}/users/{username}/collection/folders/0/releases/{release_id}/instances/{instance_id}/fields/{field_id}",
            self.base_url
        );
        let headers = self.auth_headers(token)?;

        let body = serde_json::json!({ "value": value });

        let res = self
            .http
            .post(&url)
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Update instance field request error: {e}")))?;

        if !res.status().is_success() {
            tracing::warn!(
                "Discogs update instance field returned status {} for release {} instance {}",
                res.status(),
                release_id,
                instance_id
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Router,
        extract::Path,
        http::StatusCode,
        response::IntoResponse,
        routing::{delete, get, post},
    };
    use serde_json::json;

    async fn spawn_mock_discogs() -> (String, tokio::task::JoinHandle<()>) {
        let app = Router::new()
            .route(
                "/releases/{id}",
                get(|Path(id): Path<i64>| async move {
                    if id == 404 {
                        StatusCode::NOT_FOUND.into_response()
                    } else {
                        axum::Json(json!({
                            "id": id,
                            "title": "Abbey Road",
                            "artists": [{"name": "The Beatles"}],
                            "year": 1969,
                            "genres": ["Rock"],
                            "styles": ["Pop Rock"],
                            "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                            "labels": [{"name": "Apple Records", "catno": "PCS 7088"}],
                            "thumb": "https://img.discogs.com/thumb.jpg"
                        }))
                        .into_response()
                    }
                }),
            )
            .route(
                "/database/search",
                get(|| async {
                    axum::Json(json!({
                        "pagination": {
                            "page": 1,
                            "pages": 1,
                            "per_page": 10,
                            "items": 1
                        },
                        "results": [{
                            "id": 12345,
                            "title": "The Beatles - Abbey Road",
                            "year": "1969",
                            "genre": ["Rock"],
                            "style": ["Pop Rock"],
                            "format": ["Vinyl", "LP"],
                            "label": ["Apple Records"],
                            "catno": "PCS 7088",
                            "thumb": "https://img.discogs.com/thumb.jpg"
                        }]
                    }))
                }),
            )
            .route(
                "/users/{username}/collection/fields",
                get(|| async {
                    axum::Json(json!({
                        "fields": [
                            {"id": 1, "name": "Media Condition"},
                            {"id": 2, "name": "Sleeve Condition"}
                        ]
                    }))
                }),
            )
            .route(
                "/users/{username}/collection/value",
                get(|| async {
                    axum::Json(json!({
                        "minimum": "100.00 EUR",
                        "median": "250.00 EUR",
                        "maximum": "500.00 EUR"
                    }))
                }),
            )
            .route(
                "/users/{username}/collection/folders/{folder}/releases",
                get(|| async {
                    axum::Json(json!({
                        "pagination": {
                            "page": 1,
                            "pages": 1,
                            "per_page": 10,
                            "items": 1
                        },
                        "releases": [{
                            "id": 12345,
                            "instance_id": 999,
                            "date_added": "2026-01-01T00:00:00Z",
                            "basic_information": {
                                "id": 12345,
                                "title": "Abbey Road",
                                "year": 1969,
                                "artists": [{"name": "The Beatles"}],
                                "genres": ["Rock"],
                                "styles": ["Pop Rock"],
                                "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                                "labels": [{"name": "Apple Records", "catno": "PCS 7088"}],
                                "thumb": "https://img.discogs.com/thumb.jpg"
                            },
                            "notes": [
                                {"field_id": 1, "value": "Near Mint (NM or M-)"},
                                {"field_id": 2, "value": "Very Good Plus (VG+)"}
                            ]
                        }]
                    }))
                }),
            )
            .route(
                "/users/{username}/collection/releases/{id}",
                get(|| async {
                    axum::Json(json!({
                        "pagination": {
                            "page": 1,
                            "pages": 1,
                            "per_page": 10,
                            "items": 1
                        },
                        "releases": [{
                            "id": 12345,
                            "instance_id": 999,
                            "date_added": "2026-01-01T00:00:00Z",
                            "basic_information": {
                                "id": 12345,
                                "title": "Abbey Road",
                                "year": 1969,
                                "artists": [{"name": "The Beatles"}],
                                "genres": ["Rock"],
                                "styles": ["Pop Rock"],
                                "formats": [{"name": "Vinyl", "descriptions": ["LP"]}],
                                "labels": [{"name": "Apple Records", "catno": "PCS 7088"}],
                                "thumb": "https://img.discogs.com/thumb.jpg"
                            },
                            "notes": []
                        }]
                    }))
                }),
            )
            .route(
                "/users/{username}/collection/folders/{folder}/releases/{id}",
                post(|| async {
                    (
                        StatusCode::CREATED,
                        axum::Json(json!({
                            "instance_id": 999,
                            "resource_url": "https://api.discogs.com/release/12345"
                        })),
                    )
                }),
            )
            .route(
                "/users/{username}/collection/folders/{folder}/releases/{id}/instances/{instance_id}",
                delete(|| async { StatusCode::NO_CONTENT }),
            )
            .route(
                "/users/{username}/collection/folders/0/releases/{id}/instances/{instance_id}/fields/{field_id}",
                post(|| async { StatusCode::NO_CONTENT }),
            )
            .route(
                "/marketplace/price_suggestions/{id}",
                get(|| async {
                    axum::Json(json!({
                        "Near Mint (NM or M-)": {
                            "currency": "EUR",
                            "value": 45.00
                        },
                        "Very Good Plus (VG+)": {
                            "currency": "EUR",
                            "value": 30.00
                        }
                    }))
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind ephemeral test port");
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        (format!("http://{addr}"), handle)
    }

    #[tokio::test]
    async fn test_discogs_client_all_endpoints() {
        let (base_url, _handle) = spawn_mock_discogs().await;
        let client = DiscogsClient::with_base_url(base_url, "test-client/1.0".to_string());
        let token = "test_token";

        // 1. Get release (and cache check)
        let rel1 = client.get_release(12345, token).await.unwrap();
        assert_eq!(rel1.title, "Abbey Road");
        assert_eq!(rel1.artists.as_ref().unwrap().len(), 1);

        // Cached call
        let rel2 = client.get_release(12345, token).await.unwrap();
        assert_eq!(rel2.title, "Abbey Road");

        // 404 test
        let err = client.get_release(404, token).await.unwrap_err();
        match err {
            AppError::NotFound(_) => (),
            other => panic!("Expected NotFound, got: {other:?}"),
        }

        // 2. Search
        let search_res = client
            .search("Abbey Road", Some("release"), 1, 10, token)
            .await
            .unwrap();
        assert_eq!(search_res.results.len(), 1);
        assert_eq!(search_res.results[0].id, 12345);

        // 3. Collection fields
        let fields = client
            .get_collection_fields("testuser", token)
            .await
            .unwrap();
        assert_eq!(fields.fields.unwrap().len(), 2);

        // 4. Collection value
        let val = client
            .get_collection_value("testuser", token)
            .await
            .unwrap();
        assert_eq!(val.median.unwrap(), "250.00 EUR");

        // 5. Get collection & is_release_in_collection
        let coll = client
            .get_collection_releases("testuser", token, 1, 10)
            .await
            .unwrap();
        assert_eq!(coll.releases.len(), 1);

        let in_coll = client
            .is_release_in_collection("testuser", 12345, token)
            .await
            .unwrap();
        assert!(in_coll);

        // 6. Add release
        let add_res = client
            .add_release_to_folder("testuser", 0, 12345, token)
            .await
            .unwrap();
        assert_eq!(add_res.instance_id, 999);

        // 7. Delete release instance
        let del_res = client
            .delete_release_instance("testuser", 0, 12345, 999, token)
            .await;
        assert!(del_res.is_ok());

        // 8. Update instance field
        let upd_res = client
            .update_instance_field("testuser", 12345, 999, 1, "Mint", token)
            .await;
        assert!(upd_res.is_ok());

        // 9. Price suggestions (with cache check)
        let prices1 = client.get_price_suggestions(12345, token).await.unwrap();
        assert_eq!(prices1.len(), 2);
        assert_eq!(prices1.get("Near Mint (NM or M-)").unwrap().value, 45.00);

        // Cached call
        let prices2 = client.get_price_suggestions(12345, token).await.unwrap();
        assert_eq!(prices2.len(), 2);
    }
}
