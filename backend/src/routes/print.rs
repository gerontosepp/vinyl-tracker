use crate::{
    auth::CurrentUser,
    error::AppError,
    services::print::{PrintService, PrintTemplate},
    state::AppState,
};
use axum::{
    Router,
    body::Bytes,
    extract::State,
    http::{StatusCode, header},
    response::IntoResponse,
    routing::post,
};

/// Renders records of the user's collection with a print template into a PDF.
pub async fn print_handler(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    body: Bytes,
) -> Result<impl IntoResponse, AppError> {
    let request = PrintService::parse_request(&body)?;
    let records = PrintService::load_records(&state.pool, user.id, &request.scope).await?;
    let pdf = PrintService::render(request.template, &records, &request.options)?;

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/pdf".to_string()),
            (
                header::CONTENT_DISPOSITION,
                content_disposition(request.template),
            ),
        ],
        pdf,
    ))
}

fn content_disposition(template: PrintTemplate) -> String {
    format!("attachment; filename=\"vinyl_{}.pdf\"", template.slug())
}

pub fn router() -> Router<AppState> {
    Router::new().route("/", post(print_handler))
}
