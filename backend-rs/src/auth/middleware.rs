use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use crate::{
    auth::jwt::validate_token,
    error::AppError,
    models::user::AppUser,
    state::AppState,
};

pub struct CurrentUser(pub AppUser);

impl<S> FromRequestParts<S> for CurrentUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        // 1. Try Authorization header: Bearer <token>
        let mut token_opt = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|h| {
                if let Some(t) = h.strip_prefix("Bearer ") {
                    Some(t)
                } else {
                    h.strip_prefix("bearer ")
                }
            })
            .map(|s| s.trim().to_string());

        // 2. Fallback to Cookie: vinyl_token=<token>
        if token_opt.is_none() {
            if let Some(cookie_hdr) = parts.headers.get(axum::http::header::COOKIE).and_then(|h| h.to_str().ok()) {
                for pair in cookie_hdr.split(';') {
                    let mut parts = pair.trim().splitn(2, '=');
                    if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                        if k == "vinyl_token" {
                            token_opt = Some(v.to_string());
                            break;
                        }
                    }
                }
            }
        }

        let token = token_opt.ok_or_else(|| {
            AppError::Unauthorized("Missing authentication credentials".to_string())
        })?;

        // Validate token
        let claims = validate_token(&token, &app_state.config.jwt_secret)?;

        // Fetch user from database
        let user = sqlx::query_as::<_, AppUser>(
            "SELECT id, username, password, discogs_username, discogs_token, roon_host, roon_port, roon_zone_id, roon_zone_name, roon_token
             FROM app_user WHERE username = $1"
        )
        .bind(&claims.sub)
        .fetch_optional(&app_state.pool)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::Unauthorized("User no longer exists".to_string()))?;

        Ok(CurrentUser(user))
    }
}
