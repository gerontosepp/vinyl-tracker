use crate::{auth::jwt::validate_token, error::AppError, models::user::AppUser, state::AppState};
use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
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
        let token_opt = parts
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
        let token_opt = token_opt.or_else(|| {
            parts
                .headers
                .get(axum::http::header::COOKIE)
                .and_then(|h| h.to_str().ok())
                .and_then(|cookie_hdr| {
                    cookie_hdr.split(';').find_map(|pair| {
                        let mut item = pair.trim().splitn(2, '=');
                        match (item.next(), item.next()) {
                            (Some(name), Some(v)) if name == app_state.config.auth_cookie_name => {
                                Some(v.to_string())
                            }
                            _ => None,
                        }
                    })
                })
        });

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
