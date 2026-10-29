use crate::error::AppError;
use chrono::Utc;
use jsonwebtoken::{
    DecodingKey, EncodingKey, Header, Validation, decode, encode, errors::ErrorKind,
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
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("Failed to generate JWT: {e}")))
}

pub fn validate_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    let validation = Validation::default();
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
}
