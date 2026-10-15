use aes::Aes256;
use cbc::{
    Decryptor, Encryptor,
    cipher::{BlockDecryptMut, BlockEncryptMut, KeyIvInit, block_padding::Pkcs7},
};
use rand::RngCore;

type Aes256CbcEnc = Encryptor<Aes256>;
type Aes256CbcDec = Decryptor<Aes256>;

#[derive(Clone, Debug)]
pub struct CryptoService {
    key: [u8; 32],
}

impl CryptoService {
    /// Creates a new `CryptoService` matching Spring Security's `Encryptors.text(password, salt)`.
    /// - Key derivation: PBKDF2WithHmacSHA1, 1024 iterations, 32-byte key
    /// - Cipher: AES-256-CBC with PKCS7 padding
    /// - Salt: hex-decoded from `salt_hex`
    pub fn new(password: &str, salt_hex: &str) -> Result<Self, String> {
        let salt_bytes =
            hex::decode(salt_hex).map_err(|e| format!("Invalid hex salt for encryption: {e}"))?;

        let mut key = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<sha1::Sha1>(password.as_bytes(), &salt_bytes, 1024, &mut key);

        Ok(Self { key })
    }

    /// Encrypts plaintext string, returning hex-encoded `IV (16 bytes) + Ciphertext`.
    pub fn encrypt(&self, plaintext: &str) -> Option<String> {
        if plaintext.is_empty() {
            return None;
        }

        let mut iv = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut iv);

        let encryptor = Aes256CbcEnc::new(&self.key.into(), &iv.into());
        let mut buf = vec![0u8; plaintext.len() + 16];
        let ct = encryptor
            .encrypt_padded_b2b_mut::<Pkcs7>(plaintext.as_bytes(), &mut buf)
            .ok()?;

        let mut combined = Vec::with_capacity(16 + ct.len());
        combined.extend_from_slice(&iv);
        combined.extend_from_slice(ct);

        Some(hex::encode(combined))
    }

    /// Decrypts hex-encoded `IV (16 bytes) + Ciphertext` into plaintext string.
    pub fn decrypt(&self, encrypted_hex: &str) -> Option<String> {
        if encrypted_hex.is_empty() {
            return None;
        }

        let data = hex::decode(encrypted_hex).ok()?;
        if data.len() < 16 {
            return None;
        }

        let (iv, ct) = data.split_at(16);
        let decryptor = Aes256CbcDec::new(&self.key.into(), iv.into());
        let mut buf = ct.to_vec();
        let pt = decryptor.decrypt_padded_mut::<Pkcs7>(&mut buf).ok()?;

        String::from_utf8(pt.to_vec()).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let crypto = CryptoService::new("test-password-1234567890123456", "1234567890abcdef")
            .expect("Initialization must succeed");

        let secret = "discogs_pat_token_test_1234567890";
        let encrypted = crypto.encrypt(secret).expect("Encryption must succeed");
        assert_ne!(encrypted, secret);
        assert!(encrypted.len() >= 64);

        let decrypted = crypto.decrypt(&encrypted).expect("Decryption must succeed");
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn test_empty_input_returns_none() {
        let crypto = CryptoService::new("test-password", "12345678").unwrap();
        assert!(crypto.encrypt("").is_none());
        assert!(crypto.decrypt("").is_none());
        assert!(crypto.decrypt("invalid-garbage").is_none());
    }
}
