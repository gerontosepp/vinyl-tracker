use std::{net::IpAddr, time::Duration};
use bytes::Bytes;
use moka::future::Cache;
use reqwest::header::{HeaderValue, CONTENT_TYPE, USER_AGENT};
use url::Url;
use crate::error::AppError;

#[derive(Clone)]
pub struct ImageProxyService {
    http: reqwest::Client,
    allowed_hosts: Vec<String>,
    cache: Cache<String, (HeaderValue, Bytes)>,
    user_agent: String,
}

impl ImageProxyService {
    pub fn new(allowed_hosts_csv: &str, user_agent: String) -> Self {
        let allowed_hosts: Vec<String> = allowed_hosts_csv
            .split(',')
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to build ImageProxy HTTP client");

        let cache = Cache::builder()
            .max_capacity(1000)
            .time_to_live(Duration::from_secs(86400)) // 24 hours
            .build();

        Self {
            http,
            allowed_hosts,
            cache,
            user_agent,
        }
    }

    /// Validates the target URL against host allowlists and performs DNS resolution
    /// to ensure no internal, loopback, or private IP addresses are targeted (SSRF defense).
    pub async fn validate_url(&self, raw_url: &str) -> Result<Url, AppError> {
        let raw_url = raw_url.trim();
        if raw_url.is_empty() {
            return Err(AppError::BadRequest("Image URL must not be empty".to_string()));
        }

        let parsed = Url::parse(raw_url)
            .map_err(|_| AppError::BadRequest("Invalid image URL format".to_string()))?;

        if parsed.scheme() != "https" {
            return Err(AppError::BadRequest("Only HTTPS image URLs are permitted".to_string()));
        }

        if !parsed.username().is_empty() || parsed.password().is_some() {
            return Err(AppError::BadRequest("Userinfo is not allowed in image URLs".to_string()));
        }

        if matches!(parsed.port(), Some(port) if port != 443) {
            return Err(AppError::BadRequest("Non-standard ports are not allowed".to_string()));
        }

        let host_str = parsed
            .host_str()
            .ok_or_else(|| AppError::BadRequest("Missing host in image URL".to_string()))?
            .to_lowercase();

        if host_str == "localhost" || !self.is_host_allowed(&host_str) {
            return Err(AppError::BadRequest(format!(
                "Target host '{host_str}' is not in the allowed image proxy whitelist"
            )));
        }

        // DNS Resolution & SSRF Private IP check
        let host_with_port = format!("{host_str}:443");
        let addresses: Vec<std::net::SocketAddr> = tokio::net::lookup_host(&host_with_port)
            .await
            .map_err(|e| AppError::BadRequest(format!("DNS resolution failed for '{host_str}': {e}")))?
            .collect();

        if addresses.is_empty() {
            return Err(AppError::BadRequest(format!("No IP address found for '{host_str}'")));
        }

        for addr in addresses {
            if !Self::is_public_ip(addr.ip()) {
                return Err(AppError::BadRequest(format!(
                    "Access to non-public / internal IP address '{}' is blocked",
                    addr.ip()
                )));
            }
        }

        Ok(parsed)
    }

    fn is_host_allowed(&self, host: &str) -> bool {
        for allowed in &self.allowed_hosts {
            if host == allowed || host.ends_with(&format!(".{allowed}")) {
                return true;
            }
        }
        false
    }

    pub fn is_public_ip(ip: IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => {
                if ipv4.is_loopback()
                    || ipv4.is_unspecified()
                    || ipv4.is_broadcast()
                    || ipv4.is_multicast()
                    || ipv4.is_link_local()
                {
                    return false;
                }
                // Private IPv4 ranges (RFC 1918)
                let octets = ipv4.octets();
                if octets[0] == 10 {
                    return false;
                }
                if octets[0] == 172 && (16..=31).contains(&octets[1]) {
                    return false;
                }
                if octets[0] == 192 && octets[1] == 168 {
                    return false;
                }
                true
            }
            IpAddr::V6(ipv6) => {
                if ipv6.is_loopback() || ipv6.is_unspecified() || ipv6.is_multicast() {
                    return false;
                }
                // Unique Local Addresses (fc00::/7) and Link-Local (fe80::/10)
                let segments = ipv6.segments();
                if (segments[0] & 0xfe00) == 0xfc00 || (segments[0] & 0xffc0) == 0xfe80 {
                    return false;
                }
                true
            }
        }
    }

    /// Fetches the image from upstream or returns it from cache.
    pub async fn proxy_image(&self, raw_url: &str) -> Result<(HeaderValue, Bytes), AppError> {
        let validated_url = self.validate_url(raw_url).await?;
        let url_key = validated_url.to_string();

        if let Some(cached) = self.cache.get(&url_key).await {
            tracing::debug!("Image proxy cache hit for {}", url_key);
            return Ok(cached);
        }

        tracing::info!("Proxying image from upstream: {}", url_key);
        let res = self
            .http
            .get(validated_url)
            .header(USER_AGENT, &self.user_agent)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Upstream image request failed: {e}")))?;

        if !res.status().is_success() {
            let status = res.status();
            return Err(AppError::Internal(format!(
                "Upstream image server returned status {status}"
            )));
        }

        let content_type = res
            .headers()
            .get(CONTENT_TYPE)
            .cloned()
            .unwrap_or_else(|| HeaderValue::from_static("image/jpeg"));

        let bytes = res
            .bytes()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read image bytes: {e}")))?;

        let result = (content_type, bytes);
        self.cache.insert(url_key, result.clone()).await;

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validate_url_rejects_non_https() {
        let proxy = ImageProxyService::new("i.discogs.com", "TestApp/1.0".to_string());
        let res = proxy.validate_url("http://i.discogs.com/image.jpg").await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_validate_url_rejects_disallowed_host() {
        let proxy = ImageProxyService::new("i.discogs.com", "TestApp/1.0".to_string());
        let res = proxy.validate_url("https://malicious-site.com/image.jpg").await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_validate_url_rejects_localhost() {
        let proxy = ImageProxyService::new("localhost,i.discogs.com", "TestApp/1.0".to_string());
        let res = proxy.validate_url("https://localhost/image.jpg").await;
        assert!(res.is_err());
    }
}
