use std::sync::Once;

/// Installs `ring` as the process-wide rustls crypto provider (idempotent).
///
/// reqwest 0.13 with `rustls-no-provider` panics when a client is built without one. We avoid the
/// default `rustls` feature because it pulls in `aws-lc-rs`, which needs a C build in the
/// multi-arch Docker images (ADR-0024).
pub fn ensure_crypto_provider() {
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        if rustls::crypto::ring::default_provider()
            .install_default()
            .is_err()
        {
            // Another provider won the race; it stays in charge, but make the mismatch visible
            tracing::warn!("A rustls crypto provider was already installed; not installing ring");
        }
    });
}

/// The only way to start an outbound HTTP client: makes sure the TLS provider exists first, so
/// no call site has to remember the precondition. Use this instead of `reqwest::Client::builder()`.
pub fn http_client_builder() -> reqwest::ClientBuilder {
    ensure_crypto_provider();
    reqwest::Client::builder()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_crypto_provider_is_idempotent_and_installs_a_default() {
        ensure_crypto_provider();
        ensure_crypto_provider();
        assert!(rustls::crypto::CryptoProvider::get_default().is_some());
    }

    #[test]
    fn test_http_client_builds_after_provider_install() {
        http_client_builder()
            .build()
            .expect("A client must build once the provider is installed");
    }
}
