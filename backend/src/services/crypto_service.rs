use aes::Aes256;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::Aead};
use cbc::{
    Decryptor,
    cipher::{BlockDecryptMut, KeyIvInit, block_padding::Pkcs7},
};
use rand::RngCore;

type Aes256CbcDec = Decryptor<Aes256>;

const MODERN_PREFIX: &str = "v2:";
const PBKDF2_MODERN_ITERATIONS: u32 = 100_000;
const PBKDF2_LEGACY_ITERATIONS: u32 = 1024;
const GCM_NONCE_SIZE: usize = 12; // 96-bit nonce
const GCM_TAG_SIZE: usize = 16; // 128-bit authentication tag

#[derive(Clone, Debug)]
pub struct CryptoService {
    legacy_key: [u8; 32],
    modern_key: [u8; 32],
}

impl CryptoService {
    /// Creates a new `CryptoService`.
    /// - Modern Key Derivation: PBKDF2-HMAC-SHA256, 100,000 iterations, 32-byte key (OWASP/BSI standard)
    /// - Legacy Key Derivation: PBKDF2-HMAC-SHA1, 1024 iterations, 32-byte key (Spring Security compatibility)
    /// - Salt: hex-decoded from `salt_hex`
    pub fn new(password: &str, salt_hex: &str) -> Result<Self, String> {
        let salt_bytes =
            hex::decode(salt_hex).map_err(|e| format!("Invalid hex salt for encryption: {e}"))?;

        let mut legacy_key = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<sha1::Sha1>(
            password.as_bytes(),
            &salt_bytes,
            PBKDF2_LEGACY_ITERATIONS,
            &mut legacy_key,
        );

        let mut modern_key = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<sha2::Sha256>(
            password.as_bytes(),
            &salt_bytes,
            PBKDF2_MODERN_ITERATIONS,
            &mut modern_key,
        );

        Ok(Self {
            legacy_key,
            modern_key,
        })
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

    /// Decrypts encrypted string into plaintext string.
    /// Transparently supports:
    /// 1. Modern AES-256-GCM tokens (`v2:<hex>`)
    /// 2. Legacy Spring Security AES-256-CBC hex tokens (raw hex without prefix)
    pub fn decrypt(&self, encrypted: &str) -> Option<String> {
        if encrypted.is_empty() {
            return None;
        }

        if let Some(payload_hex) = encrypted.strip_prefix(MODERN_PREFIX) {
            self.decrypt_modern(payload_hex)
        } else {
            self.decrypt_legacy(encrypted)
        }
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

    fn decrypt_legacy(&self, encrypted_hex: &str) -> Option<String> {
        let data = hex::decode(encrypted_hex).ok()?;
        if data.len() < 16 {
            return None;
        }

        let (iv, ct) = data.split_at(16);
        let decryptor = Aes256CbcDec::new(&self.legacy_key.into(), iv.into());
        let mut buf = ct.to_vec();
        let pt = decryptor.decrypt_padded_mut::<Pkcs7>(&mut buf).ok()?;

        String::from_utf8(pt.to_vec()).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cbc::{Encryptor, cipher::BlockEncryptMut};

    /// Legacy AES-256-CBC encryption, only to produce fixtures for the backward-compatibility test.
    fn encrypt_legacy(crypto: &CryptoService, plaintext: &str) -> Option<String> {
        if plaintext.is_empty() {
            return None;
        }

        let mut iv = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut iv);

        let encryptor = Encryptor::<Aes256>::new(&crypto.legacy_key.into(), &iv.into());
        let mut buf = vec![0u8; plaintext.len() + 16];
        let ct = encryptor
            .encrypt_padded_b2b_mut::<Pkcs7>(plaintext.as_bytes(), &mut buf)
            .ok()?;

        let mut combined = Vec::with_capacity(16 + ct.len());
        combined.extend_from_slice(&iv);
        combined.extend_from_slice(ct);

        Some(hex::encode(combined))
    }

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
    fn test_legacy_backward_compatibility() {
        let crypto = CryptoService::new("test-password-1234567890123456", "1234567890abcdef")
            .expect("Initialization must succeed");

        let secret = "legacy_discogs_token_xyz987";
        let legacy_encrypted =
            encrypt_legacy(&crypto, secret).expect("Legacy encryption must succeed");
        assert!(!legacy_encrypted.starts_with("v2:"));

        let decrypted = crypto
            .decrypt(&legacy_encrypted)
            .expect("Legacy token must be transparently decrypted");
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
        assert!(encrypt_legacy(&crypto, "").is_none());
        assert!(crypto.decrypt("").is_none());
        assert!(crypto.decrypt("invalid-garbage").is_none());
        assert!(crypto.decrypt("v2:invalid-garbage").is_none());
        assert!(crypto.decrypt("v2:1234").is_none());
    }
}
