use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::Aead};

const MODERN_PREFIX: &str = "v2:";
const PBKDF2_MODERN_ITERATIONS: u32 = 100_000;
const GCM_NONCE_SIZE: usize = 12; // 96-bit nonce
const GCM_TAG_SIZE: usize = 16; // 128-bit authentication tag

#[derive(Clone, Debug)]
pub struct CryptoService {
    modern_key: [u8; 32],
}

impl CryptoService {
    /// Creates a new `CryptoService`.
    /// - Modern Key Derivation: PBKDF2-HMAC-SHA256, 100,000 iterations, 32-byte key (OWASP/BSI standard)
    /// - Salt: hex-decoded from `salt_hex`
    pub fn new(password: &str, salt_hex: &str) -> Result<Self, String> {
        let salt_bytes =
            hex::decode(salt_hex).map_err(|e| format!("Invalid hex salt for encryption: {e}"))?;

        let mut modern_key = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<sha2::Sha256>(
            password.as_bytes(),
            &salt_bytes,
            PBKDF2_MODERN_ITERATIONS,
            &mut modern_key,
        );

        Ok(Self { modern_key })
    }

    /// Encrypts plaintext string using modern authenticated encryption (AES-256-GCM).
    /// Returns formatted string `v2:<hex(Nonce 12B + Ciphertext + Tag 16B)>`.
    pub fn encrypt(&self, plaintext: &str) -> Option<String> {
        if plaintext.is_empty() {
            return None;
        }

        let cipher = Aes256Gcm::new_from_slice(&self.modern_key).ok()?;
        let mut nonce_bytes = [0u8; GCM_NONCE_SIZE];
        rand::fill(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);

        let ciphertext_and_tag = cipher.encrypt(&nonce, plaintext.as_bytes()).ok()?;

        let mut combined = Vec::with_capacity(GCM_NONCE_SIZE + ciphertext_and_tag.len());
        combined.extend_from_slice(&nonce_bytes);
        combined.extend_from_slice(&ciphertext_and_tag);

        Some(format!("{MODERN_PREFIX}{}", hex::encode(combined)))
    }

    /// Decrypts a `v2:<hex>` AES-256-GCM token; anything else yields `None`.
    pub fn decrypt(&self, encrypted: &str) -> Option<String> {
        encrypted
            .strip_prefix(MODERN_PREFIX)
            .and_then(|payload_hex| self.decrypt_modern(payload_hex))
    }

    fn decrypt_modern(&self, hex_payload: &str) -> Option<String> {
        let data = hex::decode(hex_payload).ok()?;
        if data.len() < GCM_NONCE_SIZE + GCM_TAG_SIZE {
            return None;
        }

        let (nonce_bytes, ct_and_tag) = data.split_first_chunk::<GCM_NONCE_SIZE>()?;
        let nonce = Nonce::from(*nonce_bytes);
        let cipher = Aes256Gcm::new_from_slice(&self.modern_key).ok()?;
        let pt = cipher.decrypt(&nonce, ct_and_tag).ok()?;

        String::from_utf8(pt).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_modern_encrypt_decrypt_roundtrip() {
        let crypto = CryptoService::new("test-password-1234567890123456", "1234567890abcdef")
            .expect("Initialization must succeed");

        let secret = "discogs_pat_token_test_1234567890";
        let encrypted = crypto.encrypt(secret).expect("Encryption must succeed");
        assert_ne!(encrypted, secret);
        assert!(encrypted.starts_with("v2:"));

        let decrypted = crypto.decrypt(&encrypted).expect("Decryption must succeed");
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn test_tampered_modern_ciphertext_fails() {
        let crypto = CryptoService::new("test-password-1234567890123456", "1234567890abcdef")
            .expect("Initialization must succeed");

        let secret = "super_secret_token";
        let encrypted = crypto.encrypt(secret).unwrap();
        // Tamper with the hex payload
        let mut tampered = encrypted.clone();
        let last_char = if tampered.ends_with('0') { '1' } else { '0' };
        tampered.pop();
        tampered.push(last_char);

        assert!(
            crypto.decrypt(&tampered).is_none(),
            "AEAD must detect tampering and reject"
        );
    }

    #[test]
    fn test_empty_and_garbage_input_returns_none() {
        let crypto = CryptoService::new("test-password", "12345678").unwrap();
        assert!(crypto.encrypt("").is_none());
        assert!(crypto.decrypt("").is_none());
        assert!(crypto.decrypt("invalid-garbage").is_none());
        // Former AES-CBC tokens (hex without prefix) are no longer accepted
        assert!(
            crypto
                .decrypt("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
                .is_none()
        );
        assert!(crypto.decrypt("v2:invalid-garbage").is_none());
        assert!(crypto.decrypt("v2:1234").is_none());
    }

    // Fixtures produced before the RustCrypto upgrade (aes-gcm 0.10, pbkdf2 0.12, sha2 0.10); the
    // key was cross-checked with Python's `hashlib.pbkdf2_hmac`. They pin the stored format so
    // that values encrypted by earlier versions stay readable.
    const FIXTURE_PASSWORD: &str = "fixture-password-1234567890";
    const FIXTURE_SALT_HEX: &str = "00112233445566778899aabbccddeeff";
    const FIXTURE_KEY_HEX: &str =
        "a78b8db61f9d81a6480ba53490d1ae75a4413b9b9269b5cf61c58299692b09fc";
    const FIXTURE_PLAINTEXT: &str = "discogs_pat_fixture_token_0123456789";
    const FIXTURE_CIPHERTEXT: &str = "v2:e3fa3896fbc417b7264412879c2f31647288ef48dddacea8b7809355936aa86faf4f148b474ce5ce5a1e7da073de7030b7ec6e07da7a8594bee20785862a791f";

    #[test]
    fn test_key_derivation_matches_independent_pbkdf2() {
        let crypto = CryptoService::new(FIXTURE_PASSWORD, FIXTURE_SALT_HEX).unwrap();
        assert_eq!(hex::encode(crypto.modern_key), FIXTURE_KEY_HEX);
    }

    #[test]
    fn test_existing_ciphertext_stays_decryptable() {
        let crypto = CryptoService::new(FIXTURE_PASSWORD, FIXTURE_SALT_HEX).unwrap();
        assert_eq!(
            crypto.decrypt(FIXTURE_CIPHERTEXT).as_deref(),
            Some(FIXTURE_PLAINTEXT)
        );
    }

    #[test]
    fn test_existing_ciphertext_is_rejected_with_other_key() {
        let other = CryptoService::new("another-password-1234567890", FIXTURE_SALT_HEX).unwrap();
        assert!(other.decrypt(FIXTURE_CIPHERTEXT).is_none());
    }

    #[test]
    fn test_nonce_is_random_and_ciphertext_layout_is_stable() {
        let crypto = CryptoService::new(FIXTURE_PASSWORD, FIXTURE_SALT_HEX).unwrap();
        let a = crypto.encrypt(FIXTURE_PLAINTEXT).unwrap();
        let b = crypto.encrypt(FIXTURE_PLAINTEXT).unwrap();
        assert_ne!(a, b, "two encryptions must use different nonces");
        // Layout: `v2:` + hex(nonce 12 B + ciphertext + tag 16 B), same size as the fixture
        assert_eq!(a.len(), FIXTURE_CIPHERTEXT.len());
        assert_eq!(a.len(), 3 + 2 * (12 + FIXTURE_PLAINTEXT.len() + 16));
    }
}
