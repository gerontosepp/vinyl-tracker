use crate::models::*;
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue, SET_COOKIE};
use serde::de::DeserializeOwned;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

#[derive(Clone)]
pub struct VinylApiClient {
    base_url: String,
    http_client: reqwest::Client,
    username: Option<String>,
    password: Option<String>,
    token: Arc<RwLock<Option<String>>>,
    /// Serializes logins so parallel tool calls share a single authentication request.
    login_lock: Arc<Mutex<()>>,
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
            login_lock: Arc::new(Mutex::new(())),
        }
    }

    /// Try to login if username & password are provided and token is missing.
    ///
    /// Holding the login lock twice (once here, once while checking) keeps concurrent tool calls
    /// from firing several logins at the same time.
    pub async fn ensure_authenticated(&self) -> Result<(), String> {
        if self.token.read().await.is_some() {
            return Ok(());
        }

        let _guard = self.login_lock.lock().await;
        if self.token.read().await.is_some() {
            return Ok(());
        }
        self.login_with_credentials().await
    }

    /// Logs in with the configured credentials, if any. The caller must hold the login lock.
    async fn login_with_credentials(&self) -> Result<(), String> {
        match (&self.username, &self.password) {
            (Some(u), Some(p)) => {
                self.login_inner(u, p).await?;
                Ok(())
            }
            // No credentials provided; proceed unauthenticated (may fail if endpoint requires auth)
            _ => Ok(()),
        }
    }

    async fn login_inner(&self, username: &str, password: &str) -> Result<String, String> {
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

    /// Replaces the rejected token, unless another call already refreshed it.
    async fn refresh_login(&self, stale_token: &str) -> Result<(), String> {
        let _guard = self.login_lock.lock().await;
        if self.token.read().await.as_deref() != Some(stale_token) {
            // Another tool call refreshed the token while this one was waiting.
            return Ok(());
        }
        self.login_with_credentials().await
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

    /// Sends an authenticated request. A rejected token (401) triggers exactly one re-login and a
    /// retry, so a long-running MCP session survives token expiry and backend secret rotation.
    async fn send<F>(&self, endpoint: &str, build: F) -> Result<reqwest::Response, String>
    where
        F: Fn(HeaderMap) -> reqwest::RequestBuilder,
    {
        self.ensure_authenticated().await?;
        let stale_token = self.token.read().await.clone();

        let res = build(self.build_auth_headers().await)
            .send()
            .await
            .map_err(|e| format!("Request to {} failed: {}", endpoint, e))?;

        if res.status() != reqwest::StatusCode::UNAUTHORIZED {
            return Ok(res);
        }

        let Some(stale_token) = stale_token else {
            return Ok(res);
        };
        if self.username.is_none() || self.password.is_none() {
            return Ok(res);
        }

        tracing::warn!(
            "Backend rejected the session token on {} – re-authenticating and retrying once.",
            endpoint
        );
        if let Err(e) = self.refresh_login(&stale_token).await {
            tracing::warn!("Re-authentication failed: {}", e);
            return Ok(res);
        }

        build(self.build_auth_headers().await)
            .send()
            .await
            .map_err(|e| {
                format!(
                    "Request to {} failed after re-authentication: {}",
                    endpoint, e
                )
            })
    }

    async fn send_json<T, F>(&self, endpoint: &str, build: F) -> Result<T, String>
    where
        T: DeserializeOwned,
        F: Fn(HeaderMap) -> reqwest::RequestBuilder,
    {
        let res = self.send(endpoint, build).await?;
        Self::check_status(res)
            .await?
            .json::<T>()
            .await
            .map_err(|e| format!("Failed to parse {} response: {}", endpoint, e))
    }

    async fn send_text<F>(&self, endpoint: &str, build: F) -> Result<String, String>
    where
        F: Fn(HeaderMap) -> reqwest::RequestBuilder,
    {
        let res = self.send(endpoint, build).await?;
        Self::check_status(res)
            .await?
            .text()
            .await
            .map_err(|e| format!("Failed to read {} response: {}", endpoint, e))
    }

    async fn send_ok<F>(&self, endpoint: &str, build: F) -> Result<(), String>
    where
        F: Fn(HeaderMap) -> reqwest::RequestBuilder,
    {
        let res = self.send(endpoint, build).await?;
        Self::check_status(res).await?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Collection APIs
    // ------------------------------------------------------------------------

    pub async fn get_collection(
        &self,
        args: &GetCollectionArgs,
    ) -> Result<CollectionResponse, String> {
        let url = format!("{}/api/collection", self.base_url);
        self.send_json("/api/collection", |headers| {
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
            req
        })
        .await
    }

    pub async fn get_random_record(
        &self,
        args: &GetRandomRecordArgs,
    ) -> Result<Option<CollectionRelease>, String> {
        let url = format!("{}/api/collection/random", self.base_url);
        let res = self
            .send("/api/collection/random", |headers| {
                let mut req = self.http_client.get(&url).headers(headers);
                if let Some(g) = &args.genre {
                    req = req.query(&[("genre", g)]);
                }
                if let Some(u) = args.unplayed_only {
                    req = req.query(&[("unplayed_only", u.to_string())]);
                }
                req
            })
            .await?;

        if res.status().as_u16() == 404 {
            return Ok(None);
        }

        Self::check_status(res)
            .await?
            .json::<CollectionRelease>()
            .await
            .map(Some)
            .map_err(|e| format!("Failed to parse random record response: {}", e))
    }

    pub async fn get_unplayed_records(
        &self,
        args: &GetUnplayedRecordsArgs,
    ) -> Result<CollectionResponse, String> {
        let url = format!("{}/api/collection/unplayed", self.base_url);
        self.send_json("/api/collection/unplayed", |headers| {
            let mut req = self.http_client.get(&url).headers(headers);
            if let Some(p) = args.page {
                req = req.query(&[("page", p.to_string())]);
            }
            if let Some(pp) = args.per_page {
                req = req.query(&[("per_page", pp.to_string())]);
            }
            req
        })
        .await
    }

    pub async fn sync_collection(&self) -> Result<SyncResultDto, String> {
        let url = format!("{}/api/collection/sync", self.base_url);
        self.send_json("/api/collection/sync", |headers| {
            self.http_client.post(&url).headers(headers)
        })
        .await
    }

    pub async fn add_to_collection(&self, release_id: i64) -> Result<SyncResultDto, String> {
        let url = format!("{}/api/collection/releases/{}", self.base_url, release_id);
        self.send_json("/api/collection/releases", |headers| {
            self.http_client.post(&url).headers(headers)
        })
        .await
    }

    pub async fn remove_from_collection(
        &self,
        release_id: i64,
        instance_id: Option<i64>,
    ) -> Result<(), String> {
        let url = format!("{}/api/collection/releases/{}", self.base_url, release_id);
        self.send_ok("/api/collection/releases", |headers| {
            let mut req = self.http_client.delete(&url).headers(headers);
            if let Some(inst_id) = instance_id {
                req = req.query(&[("instance_id", inst_id.to_string())]);
            }
            req
        })
        .await
    }

    // ------------------------------------------------------------------------
    // Want-to-Have APIs
    // ------------------------------------------------------------------------

    pub async fn get_want_to_have(&self) -> Result<Vec<WantToHaveItemDto>, String> {
        let url = format!("{}/api/want-to-have", self.base_url);
        let res = self
            .send("/api/want-to-have", |headers| {
                self.http_client.get(&url).headers(headers)
            })
            .await?;

        if !res.status().is_success() {
            return Err(want_to_have_error(res).await);
        }

        res.json::<Vec<WantToHaveItemDto>>()
            .await
            .map_err(|e| format!("Failed to parse Want-to-Have JSON: {}", e))
    }

    /// Adds a release to the list. 409 (already owned or listed) becomes a plain-language error.
    pub async fn add_to_want_to_have(&self, discogs_id: i64) -> Result<WantToHaveItemDto, String> {
        let url = format!("{}/api/want-to-have", self.base_url);
        let res = self
            .send("/api/want-to-have", |headers| {
                self.http_client
                    .post(&url)
                    .headers(headers)
                    .json(&AddWantToHaveRequestDto { discogs_id })
            })
            .await?;

        if !res.status().is_success() {
            return Err(want_to_have_error(res).await);
        }

        res.json::<WantToHaveItemDto>()
            .await
            .map_err(|e| format!("Failed to parse Want-to-Have item JSON: {}", e))
    }

    pub async fn remove_from_want_to_have(&self, id: i64) -> Result<(), String> {
        let url = format!("{}/api/want-to-have/{}", self.base_url, id);
        let res = self
            .send("/api/want-to-have", |headers| {
                self.http_client.delete(&url).headers(headers)
            })
            .await?;

        if !res.status().is_success() {
            return Err(want_to_have_error(res).await);
        }

        Ok(())
    }

    /// Online sources of a list entry: all Vinyl versions with marketplace figures (first few)
    /// and shop search links.
    pub async fn get_want_to_have_sources(&self, id: i64) -> Result<PurchaseSourcesDto, String> {
        let url = format!("{}/api/want-to-have/{}/sources", self.base_url, id);
        let res = self
            .send("/api/want-to-have/sources", |headers| {
                self.http_client.get(&url).headers(headers)
            })
            .await?;

        if !res.status().is_success() {
            return Err(want_to_have_error(res).await);
        }

        res.json::<PurchaseSourcesDto>()
            .await
            .map_err(|e| format!("Failed to parse Want-to-Have sources JSON: {}", e))
    }

    /// Marketplace figures of one version of a list entry.
    pub async fn get_want_to_have_version_stats(
        &self,
        id: i64,
        release_id: i64,
    ) -> Result<MarketplaceStatsDto, String> {
        let url = format!(
            "{}/api/want-to-have/{}/sources/{}/stats",
            self.base_url, id, release_id
        );
        let res = self
            .send("/api/want-to-have/sources/stats", |headers| {
                self.http_client.get(&url).headers(headers)
            })
            .await?;

        if !res.status().is_success() {
            return Err(want_to_have_error(res).await);
        }

        res.json::<MarketplaceStatsDto>()
            .await
            .map_err(|e| format!("Failed to parse Want-to-Have version stats JSON: {}", e))
    }

    // ------------------------------------------------------------------------
    // Scan & Listen APIs
    // ------------------------------------------------------------------------

    pub async fn scan_barcode(&self, barcode: &str) -> Result<ScanResultDto, String> {
        let url = format!("{}/api/scan", self.base_url);
        let payload = ScanRequest {
            barcode: barcode.to_string(),
            identify: false,
        };

        let res = self
            .send("/api/scan", |headers| {
                self.http_client.post(&url).headers(headers).json(&payload)
            })
            .await?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            // Try parsing ScanResultDto from error body
            if let Ok(err_dto) = serde_json::from_str::<ScanResultDto>(&body) {
                return Ok(err_dto);
            }
            return Err(format!("Backend error {}: {}", status, body));
        }

        res.json::<ScanResultDto>()
            .await
            .map_err(|e| format!("Failed to parse scan result: {}", e))
    }

    pub async fn log_record_listen(&self, id: i64) -> Result<RecordDetailDto, String> {
        let url = format!("{}/api/records/{}/listen", self.base_url, id);
        self.send_json("/api/records/listen", |headers| {
            self.http_client.post(&url).headers(headers)
        })
        .await
    }

    pub async fn delete_scan(&self, id: i64) -> Result<String, String> {
        let url = format!("{}/api/scan/{}", self.base_url, id);
        self.send_ok("/api/scan", |headers| {
            self.http_client.delete(&url).headers(headers)
        })
        .await?;

        Ok(format!("Scan {} deleted successfully.", id))
    }

    pub async fn reset_all_listens(&self) -> Result<ResetResultDto, String> {
        let url = format!("{}/api/scan/all", self.base_url);
        self.send_json("/api/scan/all", |headers| {
            self.http_client.delete(&url).headers(headers)
        })
        .await
    }

    // ------------------------------------------------------------------------
    // Analytics APIs
    // ------------------------------------------------------------------------

    pub async fn get_recent_listens(
        &self,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<ListenEventDto>, String> {
        let url = format!("{}/api/analytics/recent", self.base_url);
        self.send_json("/api/analytics/recent", |headers| {
            let mut req = self.http_client.get(&url).headers(headers);
            if let Some(f) = from {
                req = req.query(&[("from", f)]);
            }
            if let Some(t) = to {
                req = req.query(&[("to", t)]);
            }
            req
        })
        .await
    }

    pub async fn get_top_records(
        &self,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<TopRecordDto>, String> {
        let url = format!("{}/api/analytics/top", self.base_url);
        self.send_json("/api/analytics/top", |headers| {
            let mut req = self.http_client.get(&url).headers(headers);
            if let Some(f) = from {
                req = req.query(&[("from", f)]);
            }
            if let Some(t) = to {
                req = req.query(&[("to", t)]);
            }
            req
        })
        .await
    }

    pub async fn get_top_artists(
        &self,
        from: Option<&str>,
        to: Option<&str>,
    ) -> Result<Vec<TopArtistDto>, String> {
        let url = format!("{}/api/analytics/top-artists", self.base_url);
        self.send_json("/api/analytics/top-artists", |headers| {
            let mut req = self.http_client.get(&url).headers(headers);
            if let Some(f) = from {
                req = req.query(&[("from", f)]);
            }
            if let Some(t) = to {
                req = req.query(&[("to", t)]);
            }
            req
        })
        .await
    }

    pub async fn get_collection_value(&self) -> Result<CollectionValueResponse, String> {
        let url = format!("{}/api/analytics/collection/value", self.base_url);
        self.send_json("/api/analytics/collection/value", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn get_genre_breakdown(&self) -> Result<Vec<GenreBreakdownItem>, String> {
        let url = format!("{}/api/analytics/collection/genres", self.base_url);
        self.send_json("/api/analytics/collection/genres", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn get_current_user(&self) -> Result<UserResponseDto, String> {
        let url = format!("{}/api/users/me", self.base_url);
        self.send_json("/api/users/me", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn get_record_details(&self, id: i64) -> Result<RecordDetailDto, String> {
        let url = format!("{}/api/records/{}", self.base_url, id);
        self.send_json("/api/records", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    /// Shelf position of a record; `None` if no shelf is configured for its medium.
    pub async fn get_record_placement(
        &self,
        discogs_id: i64,
    ) -> Result<Option<StoragePlacementDto>, String> {
        let url = format!("{}/api/storage/placement/{}", self.base_url, discogs_id);
        let res = self
            .send("/api/storage/placement", |headers| {
                self.http_client.get(&url).headers(headers)
            })
            .await?;

        if res.status() == reqwest::StatusCode::NO_CONTENT {
            return Ok(None);
        }

        Self::check_status(res)
            .await?
            .json::<StoragePlacementDto>()
            .await
            .map(Some)
            .map_err(|e| format!("Failed to parse placement response: {}", e))
    }

    pub async fn get_storage_layout(&self) -> Result<StorageLayoutDto, String> {
        let url = format!("{}/api/storage/layout", self.base_url);
        self.send_json("/api/storage/layout", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn search_discogs(
        &self,
        args: &SearchDiscogsArgs,
    ) -> Result<DiscogsSearchResponse, String> {
        let url = format!("{}/api/discogs/search", self.base_url);
        self.send_json("/api/discogs/search", |headers| {
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
            req
        })
        .await
    }

    pub async fn list_label_photos(
        &self,
        status: LabelPhotoStatus,
        limit: i64,
    ) -> Result<LabelPhotosDto, String> {
        let url = format!("{}/api/label-photos", self.base_url);
        self.send_json("/api/label-photos", |headers| {
            self.http_client
                .get(&url)
                .headers(headers)
                .query(&[("status", status.as_str()), ("limit", &limit.to_string())])
        })
        .await
    }

    /// Returns the image bytes of a label photo (longest edge at most `max_edge`) and their
    /// MIME type.
    pub async fn get_label_photo_image(
        &self,
        id: i64,
        max_edge: u32,
    ) -> Result<(impl AsRef<[u8]> + use<>, String), String> {
        let url = format!("{}/api/label-photos/{}/image", self.base_url, id);
        let res = self
            .send("/api/label-photos/image", |headers| {
                self.http_client
                    .get(&url)
                    .headers(headers)
                    .query(&[("max_edge", max_edge)])
            })
            .await?;
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
        Ok((bytes, mime_type))
    }

    pub async fn update_label_photo(
        &self,
        id: i64,
        request: &UpdateLabelPhotoRequest,
    ) -> Result<LabelPhotoDto, String> {
        let url = format!("{}/api/label-photos/{}", self.base_url, id);
        self.send_json("/api/label-photos", |headers| {
            self.http_client.patch(&url).headers(headers).json(request)
        })
        .await
    }

    pub async fn create_manual_record(
        &self,
        request: &ManualRecordRequest,
    ) -> Result<ManualRecordCreatedDto, String> {
        let url = format!("{}/api/records/manual", self.base_url);
        self.send_json("/api/records/manual", |headers| {
            self.http_client.post(&url).headers(headers).json(request)
        })
        .await
    }

    pub async fn check_manual_record(&self, id: i64) -> Result<Vec<DiscogsCandidateDto>, String> {
        let url = format!("{}/api/records/{}/discogs-candidates", self.base_url, id);
        self.send_json("/api/records/discogs-candidates", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn take_over_manual_record(
        &self,
        id: i64,
        request: &TakeoverRequest,
    ) -> Result<TakeoverResultDto, String> {
        let url = format!("{}/api/records/{}/takeover", self.base_url, id);
        self.send_json("/api/records/takeover", |headers| {
            self.http_client.post(&url).headers(headers).json(request)
        })
        .await
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
        let url = format!("{}/api/roon/play", self.base_url);
        let payload = RoonPlayRequestDto {
            artist: args.artist.clone(),
            title: args.title.clone(),
            zone_id: args.zone_id.clone(),
        };

        self.send_json("/api/roon/play", |headers| {
            self.http_client.post(&url).headers(headers).json(&payload)
        })
        .await
    }

    pub async fn get_roon_zones(&self) -> Result<Vec<RoonZoneDto>, String> {
        let url = format!("{}/api/roon/zones", self.base_url);
        self.send_json("/api/roon/zones", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn update_record_condition(
        &self,
        id: i64,
        args: &UpdateRecordConditionArgs,
    ) -> Result<RecordDetailDto, String> {
        let url = format!("{}/api/records/{}/condition", self.base_url, id);
        let payload = UpdateConditionRequestDto {
            media_condition: args.media_condition.clone(),
            sleeve_condition: args.sleeve_condition.clone(),
        };

        self.send_json("/api/records/condition", |headers| {
            self.http_client.patch(&url).headers(headers).json(&payload)
        })
        .await
    }

    pub async fn refresh_collection_prices(
        &self,
        only_missing: Option<bool>,
    ) -> Result<PriceRefreshResultDto, String> {
        let url = format!("{}/api/collection/prices/refresh", self.base_url);
        let only_missing_val = only_missing.unwrap_or(true);

        self.send_json("/api/collection/prices/refresh", |headers| {
            self.http_client
                .post(&url)
                .headers(headers)
                .query(&[("onlyMissing", only_missing_val.to_string())])
        })
        .await
    }

    pub async fn get_roon_status(&self) -> Result<RoonStatusDto, String> {
        let url = format!("{}/api/roon/status", self.base_url);
        self.send_json("/api/roon/status", |headers| {
            self.http_client.get(&url).headers(headers)
        })
        .await
    }

    pub async fn export_collection(&self, format: &str) -> Result<String, String> {
        let url = format!("{}/api/collection/export", self.base_url);
        self.send_text("/api/collection/export", |headers| {
            self.http_client
                .get(&url)
                .headers(headers)
                .query(&[("format", format)])
        })
        .await
    }
}

/// Turns a failed Want-to-Have response into a readable message, using the
/// `ProblemDetail.detail` of the backend when present (409 reads "Not added …").
async fn want_to_have_error(res: reqwest::Response) -> String {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<serde_json::Value>(&body)
        .ok()
        .and_then(|v| v["detail"].as_str().map(str::to_string))
        .unwrap_or(body);
    if status == reqwest::StatusCode::CONFLICT {
        format!("Not added to Want-to-Have: {detail}")
    } else {
        format!("Backend error {status}: {detail}")
    }
}
