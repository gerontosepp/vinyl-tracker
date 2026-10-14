use std::collections::BTreeMap;
use fast_qr::convert::svg::SvgBuilder;
use fast_qr::QRBuilder;
use printpdf::{GeneratePdfOptions, PdfDocument, PdfSaveOptions};
use sqlx::{PgPool, Row};
use crate::{
    error::AppError,
    models::analytics::QrCodeItem,
};

pub struct QrPdfService;

impl QrPdfService {
    pub fn generate_qr_svg(content: &str) -> Result<String, AppError> {
        let qrcode = QRBuilder::new(content)
            .build()
            .map_err(|e| AppError::Internal(format!("Failed to build QR code: {e:?}")))?;

        let svg = SvgBuilder::default().to_str(&qrcode);
        Ok(svg)
    }

    pub fn generate_qr_codes_pdf(items: &[QrCodeItem]) -> Result<Vec<u8>, AppError> {
        if items.is_empty() {
            return Err(AppError::BadRequest("Items list must not be empty".to_string()));
        }

        let mut cards_html = String::new();
        for item in items {
            let qr_payload = format!("VT:{}", item.id);
            let qr_svg = Self::generate_qr_svg(&qr_payload)?;

            let escaped_title = html_escape(&item.title);
            let escaped_artist = html_escape(item.artist.as_deref().unwrap_or("Unknown Artist"));

            cards_html.push_str(&format!(
                r#"
                <div class="card">
                    <div class="title">{}</div>
                    <div class="artist">{}</div>
                    <div class="qr-container">{}</div>
                    <div class="id-label">ID: {}</div>
                </div>
                "#,
                escaped_title, escaped_artist, qr_svg, item.id
            ));
        }

        let full_html = format!(
            r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
    body {{
        font-family: Helvetica, Arial, sans-serif;
        margin: 20px;
        color: #222;
    }}
    h1 {{
        text-align: center;
        font-size: 18pt;
        margin-bottom: 25px;
        font-weight: bold;
    }}
    .grid {{
        width: 100%;
    }}
    .card {{
        float: left;
        width: 30%;
        margin: 1.5%;
        padding: 10px;
        box-sizing: border-box;
        border: 1px dashed #999;
        text-align: center;
        page-break-inside: avoid;
    }}
    .title {{
        font-weight: bold;
        font-size: 10pt;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 3px;
    }}
    .artist {{
        font-size: 8.5pt;
        color: #555;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 6px;
    }}
    .qr-container svg {{
        width: 110px;
        height: 110px;
        margin: 0 auto;
    }}
    .id-label {{
        font-size: 8pt;
        font-style: italic;
        color: #777;
        margin-top: 5px;
    }}
</style>
</head>
<body>
    <h1>My Vinyl Collection QR Codes</h1>
    <div class="grid">
        {}
    </div>
</body>
</html>"#,
            cards_html
        );

        let images = BTreeMap::new();
        let fonts = BTreeMap::new();
        let options = GeneratePdfOptions::default();
        let mut warnings = Vec::new();

        let doc = PdfDocument::from_html(&full_html, &images, &fonts, &options, &mut warnings)
            .map_err(|e| AppError::Internal(format!("PDF generation failed: {e}")))?;

        let pdf_bytes = doc.save(&PdfSaveOptions::default(), &mut warnings);
        Ok(pdf_bytes)
    }

    pub async fn generate_all_qr_codes_pdf(
        pool: &PgPool,
        user_id: i64,
    ) -> Result<Vec<u8>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT rc.discogs_id, rc.title, rc.artist
            FROM collection_item ci
            JOIN record_cache rc ON ci.record_id = rc.id
            WHERE ci.user_id = $1
            ORDER BY LOWER(COALESCE(rc.artist, '')) ASC, LOWER(COALESCE(rc.title, '')) ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        let items: Vec<QrCodeItem> = rows
            .into_iter()
            .map(|r| {
                let discogs_id: i64 = r.get("discogs_id");
                let title: String = r.get("title");
                let artist: Option<String> = r.get("artist");
                QrCodeItem {
                    id: discogs_id,
                    title,
                    artist,
                }
            })
            .collect();

        Self::generate_qr_codes_pdf(&items)
    }
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_qr_svg() {
        let svg = QrPdfService::generate_qr_svg("VT:12345").unwrap();
        assert!(svg.contains("<svg"));
        assert!(svg.contains("</svg>"));
    }

    #[test]
    fn test_generate_qr_codes_pdf_empty_fails() {
        let res = QrPdfService::generate_qr_codes_pdf(&[]);
        assert!(res.is_err());
    }

    #[test]
    fn test_generate_qr_codes_pdf_success() {
        let items = vec![
            QrCodeItem {
                id: 1001,
                title: "Kind of Blue".to_string(),
                artist: Some("Miles Davis".to_string()),
            },
            QrCodeItem {
                id: 1002,
                title: "A Love Supreme".to_string(),
                artist: Some("John Coltrane".to_string()),
            },
        ];

        let pdf = QrPdfService::generate_qr_codes_pdf(&items).unwrap();
        assert!(!pdf.is_empty());
        assert_eq!(&pdf[0..4], b"%PDF");
    }
}
