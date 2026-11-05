use crate::error::AppError;
use chrono::Utc;
use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode, errors::ErrorKind,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub iat: usize,
    pub exp: usize,
}

pub fn generate_token(
    username: &str,
    secret: &str,
    expiration_secs: u64,
) -> Result<String, AppError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: username.to_string(),
        iat: now,
        exp: now + expiration_secs as usize,
    };

    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("Failed to generate JWT: {e}")))
}

pub fn validate_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    // HS256 only: the accepted algorithm is part of the code, not an inherited default
    let validation = Validation::new(Algorithm::HS256);
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|e| {
        // Expired or malformed tokens are routine (stale cookies, scanners) and appear in the
        // debug log of the resulting 401; only a wrong signature hints at a forged token
        if matches!(e.kind(), ErrorKind::InvalidSignature) {
            tracing::warn!("Rejected JWT with invalid signature");
        }
        AppError::Unauthorized(format!("Invalid or expired token: {e}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_roundtrip() {
        let secret = "testSecretMustBeAtLeast32CharactersLong!";
        let token =
            generate_token("testuser", secret, 3600).expect("Token generation must succeed");
        assert!(!token.is_empty());

        let claims = validate_token(&token, secret).expect("Token validation must succeed");
        assert_eq!(claims.sub, "testuser");
    }

    #[test]
    fn test_invalid_secret_fails() {
        let secret1 = "secretOne32CharactersLongKey1234567";
        let secret2 = "secretTwo32CharactersLongKey1234567";
        let token = generate_token("testuser", secret1, 3600).unwrap();

        let result = validate_token(&token, secret2);
        assert!(result.is_err());
    }

    // Fixtures signed outside the library (plain HMAC), so they pin the wire format that
    // sessions issued by earlier versions use. Secret: `FIXTURE_SECRET`, sub `olduser`.
    const FIXTURE_SECRET: &str = "testSecretMustBeAtLeast32CharactersLong!";
    // exp = 2100-01-01
    const FIXTURE_VALID: &str = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvbGR1c2VyIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.Jz9_ZWvHDt7Y-_hXrz1T5L9DGQ-TqeMMuiuqBnzveVY";
    // exp = 2023-11-14
    const FIXTURE_EXPIRED: &str = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvbGR1c2VyIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.wRzFnr9chDK7M7r8mrW99wwR4_1SBRzDCIeTgWyPPIQ";
    // Same claims and secret, but signed with HS512
    const FIXTURE_HS512: &str = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJvbGR1c2VyIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.QSFJDZUl3NXpb_LUsXtVA6q-Ba39FdU8Kr0HEEEbHaq0c1PZgDIn5Mct0fkDGxMCAJT4bb2UKdRZrE72C67b1Q";
    // `alg: none` with the valid claims and an empty signature
    const FIXTURE_ALG_NONE: &str = "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJvbGR1c2VyIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.";

    /// Asserts a 401 caused by the given reason, not just any failure
    fn assert_unauthorized_with(token: &str, reason: &str) {
        match validate_token(token, FIXTURE_SECRET) {
            Err(AppError::Unauthorized(msg)) => {
                assert!(msg.contains(reason), "expected `{reason}` in `{msg}`")
            }
            other => panic!("expected Unauthorized({reason}), got {other:?}"),
        }
    }

    #[test]
    fn test_existing_session_token_stays_valid() {
        let claims = validate_token(FIXTURE_VALID, FIXTURE_SECRET)
            .expect("A token issued before the upgrade must remain valid");
        assert_eq!(claims.sub, "olduser");
        assert_eq!(claims.iat, 1_700_000_000);
        assert_eq!(claims.exp, 4_102_444_800);
    }

    #[test]
    fn test_generated_token_is_hs256_with_expected_claims() {
        let token = generate_token("testuser", FIXTURE_SECRET, 3600).unwrap();
        let header = jsonwebtoken::decode_header(&token).unwrap();
        assert_eq!(header.alg, jsonwebtoken::Algorithm::HS256);

        let claims = validate_token(&token, FIXTURE_SECRET).unwrap();
        assert_eq!(claims.exp - claims.iat, 3600);
    }

    #[test]
    fn test_expired_token_is_rejected() {
        assert_unauthorized_with(FIXTURE_EXPIRED, "ExpiredSignature");
    }

    #[test]
    fn test_tampered_payload_is_rejected() {
        let mut parts: Vec<&str> = FIXTURE_VALID.split('.').collect();
        // Payload of the expired fixture with the valid fixture's signature
        parts[1] = FIXTURE_EXPIRED.split('.').nth(1).unwrap();
        let tampered = parts.join(".");
        assert_unauthorized_with(&tampered, "InvalidSignature");
    }

    #[test]
    fn test_other_algorithm_is_rejected() {
        assert_unauthorized_with(FIXTURE_HS512, "InvalidAlgorithm");
    }

    #[test]
    fn test_alg_none_is_rejected() {
        // The library does not even parse `alg: none`
        assert_unauthorized_with(FIXTURE_ALG_NONE, "unknown variant `none`");
    }

    #[test]
    fn test_garbage_token_is_rejected() {
        assert_unauthorized_with("not-a-jwt", "InvalidToken");
        assert_unauthorized_with("", "InvalidToken");
    }
}
