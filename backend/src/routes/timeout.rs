use crate::error::AppError;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::time::Duration;

/// Routes that call Discogs once per release (rate limited to 60 req/min) or render
/// collection-wide documents and therefore legitimately run for minutes.
const LONG_RUNNING_PATHS: &[&str] = &[
    "/api/collection/sync",
    "/api/collection/prices/refresh",
    "/api/collection/export",
    "/api/collection/restore",
    "/api/print",
];

#[derive(Debug, Clone, Copy)]
pub struct RequestTimeouts {
    pub standard: Duration,
    pub long_running: Duration,
}

impl RequestTimeouts {
    pub fn for_path(&self, path: &str) -> Duration {
        if LONG_RUNNING_PATHS
            .iter()
            .any(|prefix| path.starts_with(prefix))
        {
            self.long_running
        } else {
            self.standard
        }
    }
}

pub async fn request_timeout_middleware(
    State(timeouts): State<RequestTimeouts>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path().to_owned();
    let limit = timeouts.for_path(&path);

    match tokio::time::timeout(limit, next.run(request)).await {
        Ok(response) => response,
        Err(_) => {
            tracing::warn!("Request to {path} exceeded timeout of {}s", limit.as_secs());
            AppError::Timeout(format!(
                "Request processing exceeded the time limit of {} seconds.",
                limit.as_secs()
            ))
            .into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{Router, body::Body, http::StatusCode, routing::get};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    const TIMEOUTS: RequestTimeouts = RequestTimeouts {
        standard: Duration::from_millis(50),
        long_running: Duration::from_millis(500),
    };

    fn app() -> Router {
        let slow = || async {
            tokio::time::sleep(Duration::from_millis(200)).await;
            "done"
        };
        Router::new()
            .route("/api/records/1", get(slow))
            .route("/api/collection/export", get(slow))
            .layer(axum::middleware::from_fn_with_state(
                TIMEOUTS,
                request_timeout_middleware,
            ))
    }

    async fn call(path: &str) -> Response {
        app()
            .oneshot(Request::get(path).body(Body::empty()).unwrap())
            .await
            .unwrap()
    }

    #[test]
    fn test_long_running_paths_get_extended_timeout() {
        for path in [
            "/api/collection/sync",
            "/api/collection/prices/refresh",
            "/api/collection/export",
            "/api/collection/restore",
            "/api/print",
        ] {
            assert_eq!(TIMEOUTS.for_path(path), TIMEOUTS.long_running, "{path}");
        }
        for path in ["/api/collection", "/api/records/1", "/api/users/login"] {
            assert_eq!(TIMEOUTS.for_path(path), TIMEOUTS.standard, "{path}");
        }
    }

    #[tokio::test]
    async fn test_slow_standard_request_returns_503_problem_detail() {
        let res = call("/api/records/1").await;
        assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);

        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        let problem: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(problem["status"], 503);
        assert!(problem["detail"].as_str().unwrap().contains("time limit"));
    }

    #[tokio::test]
    async fn test_slow_long_running_request_completes_within_extended_timeout() {
        let res = call("/api/collection/export").await;
        assert_eq!(res.status(), StatusCode::OK);
    }
}
