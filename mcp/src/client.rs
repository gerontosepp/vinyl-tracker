use crate::models::*;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, SET_COOKIE};
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
            .map_err(|e| format!("Login connection failed (is backend running at {}?): {}", self.base_url, e))?;

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
                    {
                        if !token_val.is_empty() {
                            extracted_token = Some(token_val.to_string());
                            break;
                        }
                    }
                }
            }
        }

        // If not in cookie, check response body
        if extracted_token.is_none() {
            if let Ok(dto) = res.json::<UserResponseDto>().await {
                if let Some(t) = dto.token {
                    extracted_token = Some(t);
                }
            }
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

    pub async fn get_collection(&self, args: &GetCollectionArgs) -> Result<CollectionResponse, String> {
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

        let res = req
            .send()
            .await
            .map_err(|e| format!("Request to /api/collection failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Backend error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<CollectionResponse>()
            .await
            .map_err(|e| format!("Failed to parse collection JSON: {}", e))
    }

    pub async fn get_random_record(&self, args: &GetRandomRecordArgs) -> Result<Option<CollectionRelease>, String> {
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
            return Err(format!("Backend error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<CollectionRelease>()
            .await
            .map(Some)
            .map_err(|e| format!("Failed to parse random record JSON: {}", e))
    }

    pub async fn get_unplayed_records(&self, args: &GetUnplayedRecordsArgs) -> Result<CollectionResponse, String> {
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
            return Err(format!("Backend error {}: {}", res.status(), res.text().await.unwrap_or_default()));
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
            return Err(format!("Backend error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<SyncResultDto>()
            .await
            .map_err(|e| format!("Failed to parse sync result JSON: {}", e))
    }

    // ------------------------------------------------------------------------
    // Scan & Listen APIs
    // ------------------------------------------------------------------------

    pub async fn scan_barcode(&self, barcode: &str) -> Result<ScanResultDto, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/scan", self.base_url);
        let headers = self.build_auth_headers().await;

        let payload = serde_json::json!({ "barcode": barcode });

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
            Err(format!("Delete scan failed (HTTP {}): {}", res.status(), res.text().await.unwrap_or_default()))
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
            return Err(format!("Reset listens failed (HTTP {}): {}", res.status(), res.text().await.unwrap_or_default()));
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
            return Err(format!("Analytics error {}: {}", res.status(), res.text().await.unwrap_or_default()));
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
            return Err(format!("Analytics error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<Vec<TopRecordDto>>()
            .await
            .map_err(|e| format!("Failed to parse top records JSON: {}", e))
    }

    pub async fn get_collection_value(&self) -> Result<CollectionValueDto, String> {
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
            return Err(format!("Analytics error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<CollectionValueDto>()
            .await
            .map_err(|e| format!("Failed to parse collection value JSON: {}", e))
    }

    pub async fn get_genre_breakdown(&self) -> Result<serde_json::Value, String> {
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
            return Err(format!("Analytics error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<serde_json::Value>()
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
            return Err(format!("Get user error {}: {}", res.status(), res.text().await.unwrap_or_default()));
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
            return Err(format!("Backend error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<RecordDetailDto>()
            .await
            .map_err(|e| format!("Failed to parse record details JSON: {}", e))
    }

    pub async fn search_discogs(&self, args: &SearchDiscogsArgs) -> Result<DiscogsSearchResponse, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/discogs/search", self.base_url);
        let headers = self.build_auth_headers().await;

        let mut req = self.http_client.get(&url).headers(headers);
        req = req.query(&[("query", &args.query)]);
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
            return Err(format!("Backend error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<DiscogsSearchResponse>()
            .await
            .map_err(|e| format!("Failed to parse Discogs search JSON: {}", e))
    }

    pub async fn play_on_roon(&self, args: &PlayRecordOnRoonArgs) -> Result<RoonPlayResponse, String> {
        self.ensure_authenticated().await?;
        let url = format!("{}/api/roon/play", self.base_url);
        let headers = self.build_auth_headers().await;

        let payload = serde_json::json!({
            "artist": args.artist,
            "title": args.title,
            "zoneId": args.zone_id,
        });

        let res = self
            .http_client
            .post(&url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Request to /api/roon/play failed: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Roon playback error {}: {}", res.status(), res.text().await.unwrap_or_default()));
        }

        res.json::<RoonPlayResponse>()
            .await
            .map_err(|e| format!("Failed to parse Roon play JSON response: {}", e))
    }
}

