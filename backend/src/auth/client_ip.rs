use axum::http::HeaderMap;
use ipnet::IpNet;
use std::net::{IpAddr, Ipv4Addr};

/// Parses a comma-separated list of trusted proxy addresses or CIDR ranges
/// (e.g. `172.16.0.0/12, 10.0.0.5`). Invalid entries are logged and skipped.
pub fn parse_trusted_proxies(raw: &str) -> Vec<IpNet> {
    raw.split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .filter_map(|entry| {
            entry
                .parse::<IpNet>()
                .or_else(|_| entry.parse::<IpAddr>().map(IpNet::from))
                .inspect_err(|_| tracing::warn!("Ignoring invalid TRUSTED_PROXIES entry: {entry}"))
                .ok()
        })
        .collect()
}

/// Determines the originating client IP for a request.
///
/// Forwarding headers can be forged by any client, so they are only honoured when the
/// direct TCP peer is a trusted proxy. `X-Forwarded-For` is walked from right to left,
/// skipping trusted hops, so values prepended by the client are never used.
/// Without a known peer address (e.g. in-process tests) the loopback address is returned.
pub fn resolve_client_ip(
    peer: Option<IpAddr>,
    headers: &HeaderMap,
    trusted_proxies: &[IpNet],
) -> IpAddr {
    let Some(peer) = peer else {
        return IpAddr::V4(Ipv4Addr::LOCALHOST);
    };

    let is_trusted = |ip: &IpAddr| trusted_proxies.iter().any(|net| net.contains(ip));
    if !is_trusted(&peer) {
        return peer;
    }

    let forwarded_hops: Vec<IpAddr> = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .filter_map(|hop| hop.trim().parse::<IpAddr>().ok())
        .collect();

    if let Some(client) = forwarded_hops.iter().rev().find(|hop| !is_trusted(hop)) {
        return *client;
    }

    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<IpAddr>().ok())
        .unwrap_or(peer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.append(*name, HeaderValue::from_str(value).unwrap());
        }
        map
    }

    #[test]
    fn test_parse_trusted_proxies_accepts_cidrs_and_plain_ips() {
        let proxies = parse_trusted_proxies(" 172.16.0.0/12, 10.0.0.5 ,, ::1, not-an-ip ");
        assert_eq!(proxies.len(), 3);
        assert!(proxies[0].contains(&ip("172.20.1.2")));
        assert!(proxies[1].contains(&ip("10.0.0.5")));
        assert!(!proxies[1].contains(&ip("10.0.0.6")));
        assert!(proxies[2].contains(&ip("::1")));
    }

    #[test]
    fn test_untrusted_peer_ignores_forwarding_headers() {
        let hdrs = headers(&[
            ("x-forwarded-for", "198.51.100.7"),
            ("x-real-ip", "198.51.100.8"),
        ]);
        let resolved = resolve_client_ip(Some(ip("203.0.113.10")), &hdrs, &[]);
        assert_eq!(resolved, ip("203.0.113.10"));
    }

    #[test]
    fn test_trusted_peer_uses_rightmost_untrusted_forwarded_hop() {
        let trusted = parse_trusted_proxies("172.16.0.0/12");
        // Client forged "1.2.3.4"; nginx appended the real address 198.51.100.7.
        let hdrs = headers(&[("x-forwarded-for", "1.2.3.4, 198.51.100.7")]);
        let resolved = resolve_client_ip(Some(ip("172.18.0.3")), &hdrs, &trusted);
        assert_eq!(resolved, ip("198.51.100.7"));
    }

    #[test]
    fn test_trusted_peer_skips_trusted_hops_in_proxy_chain() {
        let trusted = parse_trusted_proxies("172.16.0.0/12, 10.0.0.0/8");
        let hdrs = headers(&[
            ("x-forwarded-for", "198.51.100.7, 10.1.1.1"),
            ("x-forwarded-for", "172.18.0.9"),
        ]);
        let resolved = resolve_client_ip(Some(ip("172.18.0.3")), &hdrs, &trusted);
        assert_eq!(resolved, ip("198.51.100.7"));
    }

    #[test]
    fn test_trusted_peer_falls_back_to_real_ip_then_peer() {
        let trusted = parse_trusted_proxies("172.16.0.0/12");
        let with_real_ip = headers(&[("x-real-ip", "198.51.100.8")]);
        assert_eq!(
            resolve_client_ip(Some(ip("172.18.0.3")), &with_real_ip, &trusted),
            ip("198.51.100.8")
        );
        assert_eq!(
            resolve_client_ip(Some(ip("172.18.0.3")), &HeaderMap::new(), &trusted),
            ip("172.18.0.3")
        );
    }

    #[test]
    fn test_unknown_peer_ignores_headers_and_returns_loopback() {
        let hdrs = headers(&[("x-forwarded-for", "198.51.100.7")]);
        let trusted = parse_trusted_proxies("0.0.0.0/0");
        assert_eq!(
            resolve_client_ip(None, &hdrs, &trusted),
            IpAddr::V4(Ipv4Addr::LOCALHOST)
        );
    }
}
