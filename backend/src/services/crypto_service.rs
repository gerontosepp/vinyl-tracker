use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::Aead};
use rand::RngCore;

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
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext_and_tag = cipher.encrypt(nonce, plaintext.as_bytes()).ok()?;

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

        let (nonce_bytes, ct_and_tag) = data.split_at(GCM_NONCE_SIZE);
        let nonce = Nonce::from_slice(nonce_bytes);
        let cipher = Aes256Gcm::new_from_slice(&self.modern_key).ok()?;
        let pt = cipher.decrypt(nonce, ct_and_tag).ok()?;

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
}
