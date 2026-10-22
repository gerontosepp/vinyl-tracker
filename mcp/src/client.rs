use crate::models::*;
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue, SET_COOKIE};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct VinylApiClient {
    base_url: String,
    http_client: reqwest::Client,
    username: Option<String>,
    password: Option<String>,
    token: Arc<RwLock<Option<String>>>,
}

impl VinylApiClient {
    pub fn new(
        base_url: String,
        token: Option<String>,
        username: Option<String>,
        password: Option<String>,
    ) -> Self {
        let clean_base = base_url.trim_end_matches('/').to_string();
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            base_url: clean_base,
            http_client,
            username,
            password,
            token: Arc::new(RwLock::new(token)),
        }
    }

    /// Try to login if username & password are provided and token is missing
    pub async fn ensure_authenticated(&self) -> Result<(), String> {
        {
            let current = self.token.read().await;
            if current.is_some() {
                return Ok(());
            }
        }

        if let (Some(u), Some(p)) = (&self.username, &self.password) {
            self.login(u, p).await?;
            Ok(())
        } else {
            // No credentials provided; proceed unauthenticated (may fail if endpoint requires auth)
            Ok(())
        }
    }

    pub async fn login(&self, username: &str, password: &str) -> Result<String, String> {
        let url = format!("{}/api/users/login", self.base_url);
        let payload = LoginRequestDto {
            username: username.to_string(),
            password: password.to_string(),
        };

        let res = self
            .http_client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                format!(
                    "Login connection failed (is backend running at {}?): {}",
                    self.base_url, e
                )
            })?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            return Err(format!("Login failed with status {}: {}", status, body));
        }

        // Try extracting token from Set-Cookie header first
        let mut extracted_token = None;
        for val in res.headers().get_all(SET_COOKIE) {
            if let Ok(cookie_str) = val.to_str() {
                for part in cookie_str.split(';') {
                    let trimmed = part.trim();
                    if let Some(token_val) = trimmed
                        .strip_prefix("vinyl_token=")
                        .or_else(|| trimmed.strip_prefix("auth_token="))
                        .or_else(|| trimmed.strip_prefix("token="))
                        && !token_val.is_empty()
                    {
                        extracted_token = Some(token_val.to_string());
                        break;
                    }
                }
            }
        }

        // If not in cookie, check response body
        if extracted_token.is_none()
            && let Ok(dto) = res.json::<UserResponseDto>().await
            && let Some(t) = dto.token
        {
            extracted_token = Some(t);
        }

        let token = extracted_token.ok_or_else(|| {
            "Login response did not contain an auth token in Set-Cookie or JSON body".to_string()
        })?;

        let mut lock = self.token.write().await;
        *lock = Some(token.clone());
        Ok(token)
    }

    async fn build_auth_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Some(token) = self.token.read().await.as_ref() {
            if let Ok(val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                headers.insert(AUTHORIZATION, val);
            }
            if let Ok(val) = HeaderValue::from_str(&format!("vinyl_token={}", token)) {
                headers.insert(reqwest::header::COOKIE, val);
            }
        }
        headers
    }

    // ------------------------------------------------------------------------
    // Collection APIs
    // ------------------------------------------------------------------------

    pub async fn get_collection(
        &self,
        args: &GetCollectionArgs,
    ) -> Result<CollectionResponse, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);

        if let Some(p) = args.page {
            req = req.query(&[("page", p.to_string())]);
        }
        if let Some(pp) = args.per_page {
            req = req.query(&[("per_page", pp.to_string())]);
        }
        if let Some(s) = &args.sort {
            req = req.query(&[("sort", s)]);
        }
        if let Some(so) = &args.sort_order {
            req = req.query(&[("sort_order", so)]);
        }
        if let Some(mp) = args.min_plays {
            req = req.query(&[("min_plays", mp.to_string())]);
        }
        if let Some(q) = &args.search {
            req = req.query(&[("search", q)]);
        }
        if let Some(cat) = &args.category {
            req = req.query(&[("category", cat)]);
        }
        if let Some(genres) = &args.genres {
            for g in genres {
                req = req.query(&[("genres", g)]);
            }
        }
        if let Some(y) = &args.years {
            req = req.query(&[("years", y)]);
        }
        if let Some(unit) = &args.storage_unit {
            req = req.query(&[("storage_unit", unit)]);
        }
        if let Some(c) = args.compartment {
            req = req.query(&[("compartment", c.to_string())]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<CollectionResponse>()
            .await
            .map_err(|e| format!("Failed to parse collection JSON: {}", e))
    }

    pub async fn get_random_record(
        &self,
        args: &GetRandomRecordArgs,
    ) -> Result<Option<CollectionRelease>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/random", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);
        if let Some(g) = &args.genre {
            req = req.query(&[("genre", g)]);
        }
        if let Some(u) = args.unplayed_only {
            req = req.query(&[("unplayed_only", u.to_string())]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection/random failed: {}", e))?;

        if res.status().as_u16() == 404 {
            return Ok(None);
        }

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<CollectionRelease>()
            .await
            .map(Some)
            .map_err(|e| format!("Failed to parse random record JSON: {}", e))
    }

    pub async fn get_unplayed_records(
        &self,
        args: &GetUnplayedRecordsArgs,
    ) -> Result<CollectionResponse, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/unplayed", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);
        if let Some(p) = args.page {
            req = req.query(&[("page", p.to_string())]);
        }
        if let Some(pp) = args.per_page {
            req = req.query(&[("per_page", pp.to_string())]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection/unplayed failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<CollectionResponse>()
            .await
            .map_err(|e| format!("Failed to parse unplayed collection JSON: {}", e))
    }

    pub async fn sync_collection(&self) -> Result<SyncResultDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/sync", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection/sync failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<SyncResultDto>()
            .await
            .map_err(|e| format!("Failed to parse sync result JSON: {}", e))
    }

    pub async fn add_to_collection(&self, release_id: i64) -> Result<SyncResultDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/releases/{}", self.base_url, release_id);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to add release to collection failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<SyncResultDto>()
            .await
            .map_err(|e| format!("Failed to parse sync result JSON: {}", e))
    }

    pub async fn remove_from_collection(
        &self,
        release_id: i64,
        instance_id: Option<i64>,
    ) -> Result<(), String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/releases/{}", self.base_url, release_id);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.delete(&url).headers(headers);
        if let Some(inst_id) = instance_id {
            req = req.query(&[("instance_id", inst_id.to_string())]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to delete release failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        Ok(())
    }

    // ------------------------------------------------------------------------
    // Scan & Listen APIs
    // ------------------------------------------------------------------------

    pub async fn scan_barcode(&self, barcode: &str) -> Result<ScanResultDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/scan", self.base_url);
        let headers = self.build_auth_headers().await;

        let payload = ScanRequest {
            barcode: barcode.to_string(),
        };

        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Request to /api/scan failed: {}", e))?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            // Try parsing ScanResultDto from error body
            if let Ok(err_dto) = serde_json::from_str::<ScanResultDto>(&body) {
                return Ok(err_dto);
            }
            return Err(format!("Scan failed (HTTP {}): {}", status, body));
        }

        res.json::<ScanResultDto>()
            .await
            .map_err(|e| format!("Failed to parse scan result: {}", e))
    }

    pub async fn log_record_listen(&self, id: i64) -> Result<RecordDetailDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/records/{}/listen", self.base_url, id);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/records/{}/listen failed: {}", id, e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<RecordDetailDto>()
            .await
            .map_err(|e| format!("Failed to parse record detail JSON: {}", e))
    }

    pub async fn delete_scan(&self, id: i64) -> Result<String, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/scan/{}", self.base_url, id);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .delete(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to delete scan failed: {}", e))?;

        if res.status().is_success() || res.status() == reqwest::StatusCode::NO_CONTENT {
            Ok(format!("Scan {} deleted successfully.", id))
        } else {
            Err(format!(
                "Delete scan failed (HTTP {}): {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ))
        }
    }

    pub async fn reset_all_listens(&self) -> Result<ResetResultDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/scan/all", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .delete(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to reset all listens failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Reset listens failed (HTTP {}): {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<ResetResultDto>()
            .await
            .map_err(|e| format!("Failed to parse reset result JSON: {}", e))
    }

    // ------------------------------------------------------------------------
    // Analytics APIs
    // ------------------------------------------------------------------------

    pub async fn get_recent_listens(
        &self,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<ListenEventDto>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/analytics/recent", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);
        if let Some(f) = from {
            req = req.query(&[("from", f)]);
        }
        if let Some(t) = to {
            req = req.query(&[("to", t)]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/analytics/recent failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Analytics error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<Vec<ListenEventDto>>()
            .await
            .map_err(|e| format!("Failed to parse recent listens JSON: {}", e))
    }

    pub async fn get_top_records(
        &self,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<TopRecordDto>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/analytics/top", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);
        if let Some(f) = from {
            req = req.query(&[("from", f)]);
        }
        if let Some(t) = to {
            req = req.query(&[("to", t)]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/analytics/top failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Analytics error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<Vec<TopRecordDto>>()
            .await
            .map_err(|e| format!("Failed to parse top records JSON: {}", e))
    }

    pub async fn get_top_artists(
        &self,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<TopArtistDto>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/analytics/top-artists", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);
        if let Some(f) = from {
            req = req.query(&[("from", f)]);
        }
        if let Some(t) = to {
            req = req.query(&[("to", t)]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/analytics/top-artists failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Analytics error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<Vec<TopArtistDto>>()
            .await
            .map_err(|e| format!("Failed to parse top artists JSON: {}", e))
    }

    pub async fn get_collection_value(&self) -> Result<CollectionValueResponse, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/analytics/collection/value", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/analytics/collection/value failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Analytics error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<CollectionValueResponse>()
            .await
            .map_err(|e| format!("Failed to parse collection value JSON: {}", e))
    }

    pub async fn get_genre_breakdown(&self) -> Result<Vec<GenreBreakdownItem>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/analytics/collection/genres", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/analytics/collection/genres failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Analytics error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<Vec<GenreBreakdownItem>>()
            .await
            .map_err(|e| format!("Failed to parse genre breakdown JSON: {}", e))
    }

    pub async fn get_current_user(&self) -> Result<UserResponseDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/users/me", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/users/me failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Get user error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<UserResponseDto>()
            .await
            .map_err(|e| format!("Failed to parse user JSON: {}", e))
    }

    pub async fn get_record_details(&self, id: i64) -> Result<RecordDetailDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/records/{}", self.base_url, id);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/records/{} failed: {}", id, e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<RecordDetailDto>()
            .await
            .map_err(|e| format!("Failed to parse record details JSON: {}", e))
    }

    /// Shelf position of a record; `None` if no shelf is configured for its medium.
    pub async fn get_record_placement(
        &self,
        discogs_id: i64,
    ) -> Result<Option<StoragePlacementDto>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/storage/placement/{}", self.base_url, discogs_id);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| {
                format!(
                    "Request to /api/storage/placement/{} failed: {}",
                    discogs_id, e
                )
            })?;

        if res.status() == reqwest::StatusCode::NO_CONTENT {
            return Ok(None);
        }
        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<StoragePlacementDto>()
            .await
            .map(Some)
            .map_err(|e| format!("Failed to parse placement JSON: {}", e))
    }

    pub async fn get_storage_layout(&self) -> Result<StorageLayoutDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/storage/layout", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/storage/layout failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<StorageLayoutDto>()
            .await
            .map_err(|e| format!("Failed to parse storage layout JSON: {}", e))
    }

    pub async fn search_discogs(
        &self,
        args: &SearchDiscogsArgs,
    ) -> Result<DiscogsSearchResponse, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/discogs/search", self.base_url);
        let headers = self.build_auth_headers().await;

        let filters = [
            ("query", &args.query),
            ("catno", &args.catno),
            ("label", &args.label),
            ("artist", &args.artist),
            ("release_title", &args.release_title),
            ("year", &args.year),
            ("country", &args.country),
            ("format", &args.format),
        ];
        let mut req = self.http_client.get(&url).headers(headers);
        for (key, value) in filters {
            if let Some(v) = value {
                req = req.query(&[(key, v)]);
            }
        }
        if let Some(t) = &args.r#type {
            req = req.query(&[("type", t)]);
        }
        if let Some(p) = args.page {
            req = req.query(&[("page", p.to_string())]);
        }
        if let Some(pp) = args.per_page {
            req = req.query(&[("per_page", pp.to_string())]);
        }

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/discogs/search failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<DiscogsSearchResponse>()
            .await
            .map_err(|e| format!("Failed to parse Discogs search JSON: {}", e))
    }

    pub async fn list_label_photos(
        &self,
        status: LabelPhotoStatus,
        limit: i64,
    ) -> Result<LabelPhotosDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/label-photos", self.base_url);
        let res = self
            .http_client
            .get(&url)
            .headers(self.build_auth_headers().await)
            .query(&[("status", status.as_str()), ("limit", &limit.to_string())])
            .send()
            .await
            .map_err(|e| format!("Request to /api/label-photos failed: {}", e))?;
        Self::check_status(res)
            .await?
            .json::<LabelPhotosDto>()
            .await
            .map_err(|e| format!("Failed to parse label photos JSON: {}", e))
    }

    /// Returns the image bytes of a label photo and their MIME type.
    pub async fn get_label_photo_image(&self, id: i64) -> Result<(Vec<u8>, String), String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/label-photos/{}/image", self.base_url, id);
        let res = self
            .http_client
            .get(&url)
            .headers(self.build_auth_headers().await)
            .send()
            .await
            .map_err(|e| format!("Request to label photo image failed: {}", e))?;
        let res = Self::check_status(res).await?;
        let mime_type = res
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/jpeg")
            .to_string();
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("Failed to read label photo image: {}", e))?;
        Ok((bytes.to_vec(), mime_type))
    }

    pub async fn update_label_photo(
        &self,
        id: i64,
        request: &UpdateLabelPhotoRequest,
    ) -> Result<LabelPhotoDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/label-photos/{}", self.base_url, id);
        let res = self
            .http_client
            .patch(&url)
            .headers(self.build_auth_headers().await)
            .json(request)
            .send()
            .await
            .map_err(|e| format!("Request to update label photo failed: {}", e))?;
        Self::check_status(res)
            .await?
            .json::<LabelPhotoDto>()
            .await
            .map_err(|e| format!("Failed to parse label photo JSON: {}", e))
    }

    async fn check_status(res: reqwest::Response) -> Result<reqwest::Response, String> {
        if res.status().is_success() {
            Ok(res)
        } else {
            Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ))
        }
    }

    pub async fn play_on_roon(
        &self,
        args: &PlayRecordOnRoonArgs,
    ) -> Result<RoonPlayResponseDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/roon/play", self.base_url);
        let headers = self.build_auth_headers().await;

        let payload = RoonPlayRequestDto {
            artist: args.artist.clone(),
            title: args.title.clone(),
            zone_id: args.zone_id.clone(),
        };

        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Request to /api/roon/play failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Roon playback error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<RoonPlayResponseDto>()
            .await
            .map_err(|e| format!("Failed to parse Roon play JSON response: {}", e))
    }

    pub async fn get_roon_zones(&self) -> Result<Vec<RoonZoneDto>, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/roon/zones", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/roon/zones failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<Vec<RoonZoneDto>>()
            .await
            .map_err(|e| format!("Failed to parse Roon zones JSON response: {}", e))
    }

    pub async fn update_record_condition(
        &self,
        id: i64,
        args: &UpdateRecordConditionArgs,
    ) -> Result<RecordDetailDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/records/{}/condition", self.base_url, id);
        let headers = self.build_auth_headers().await;

        let payload = UpdateConditionRequestDto {
            media_condition: args.media_condition.clone(),
            sleeve_condition: args.sleeve_condition.clone(),
        };

        let res = self
            .http_client
            .patch(&url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Request to /api/records/{}/condition failed: {}", id, e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<RecordDetailDto>()
            .await
            .map_err(|e| format!("Failed to parse record details JSON: {}", e))
    }

    pub async fn refresh_collection_prices(
        &self,
        only_missing: Option<bool>,
    ) -> Result<PriceRefreshResultDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/prices/refresh", self.base_url);
        let headers = self.build_auth_headers().await;

        let only_missing_val = only_missing.unwrap_or(true);
        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .query(&[("onlyMissing", only_missing_val.to_string())])
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection/prices/refresh failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<PriceRefreshResultDto>()
            .await
            .map_err(|e| format!("Failed to parse price refresh result JSON: {}", e))
    }

    pub async fn get_roon_status(&self) -> Result<RoonStatusDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/roon/status", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("Request to /api/roon/status failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.json::<RoonStatusDto>()
            .await
            .map_err(|e| format!("Failed to parse Roon status JSON response: {}", e))
    }

    pub async fn export_collection(&self, format: &str) -> Result<String, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/collection/export", self.base_url);
        let headers = self.build_auth_headers().await;

        let res = self
            .http_client
            .get(&url)
            .headers(headers)
            .query(&[("format", format)])
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection/export failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Backend export error {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            ));
        }

        res.text()
            .await
            .map_err(|e| format!("Failed to read export response body: {}", e))
    }
}
