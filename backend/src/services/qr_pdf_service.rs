use crate::{error::AppError, models::analytics::QrCodeItem};
use fast_qr::QRBuilder;
use fast_qr::convert::svg::SvgBuilder;
use printpdf::{
    BuiltinFont, Color, LineDashPattern, LinePoint, Mm, Op, PaintMode, PdfDocument, PdfFontHandle,
    PdfPage, PdfSaveOptions, Point, Polygon, PolygonRing, Pt, Px, RawImage, RawImageData,
    RawImageFormat, Rgb, TextItem, WindingOrder, XObjectTransform,
};
use sqlx::{PgPool, Row};

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
            return Err(AppError::BadRequest(
                "Items list must not be empty".to_string(),
            ));
        }

        let mut doc = PdfDocument::new("Vinyl Tracker QR Codes");
        let mut pages = Vec::new();

        // 3 columns x 3 rows = 9 items per A4 page
        const ITEMS_PER_PAGE: usize = 9;
        const COLS: usize = 3;

        const CARD_WIDTH_MM: f32 = 56.0;
        const CARD_HEIGHT_MM: f32 = 68.0;

        // X coordinates of each column
        const COL_X: [f32; 3] = [15.0, 77.0, 139.0];
        // Y coordinates (bottom of card) for each row
        const ROW_Y: [f32; 3] = [192.0, 116.0, 40.0];

        // QR image target size on page in mm
        const QR_SIZE_MM: f32 = 34.0;
        const QR_PIXEL_SCALE: usize = 6;
        const QR_BORDER_MODULES: usize = 2;

        for chunk in items.chunks(ITEMS_PER_PAGE) {
            let mut ops = Vec::new();

            // Header at top of each page
            let header_text = "My Vinyl Collection QR Codes";
            let header_w = estimate_text_width_mm(header_text, 16.0);
            let header_x = (105.0 - header_w / 2.0).max(15.0);

            ops.push(Op::StartTextSection);
            ops.push(Op::SetFont {
                font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
                size: Pt(16.0),
            });
            ops.push(Op::SetTextCursor {
                pos: Point::new(Mm(header_x), Mm(277.0)),
            });
            ops.push(Op::SetFillColor {
                col: Color::Rgb(Rgb {
                    r: 0.1,
                    g: 0.1,
                    b: 0.1,
                    icc_profile: None,
                }),
            });
            ops.push(Op::ShowText {
                items: vec![TextItem::Text(header_text.to_string())],
            });
            ops.push(Op::EndTextSection);

            for (idx, item) in chunk.iter().enumerate() {
                let col = idx % COLS;
                let row = idx / COLS;
                let card_x = COL_X[col];
                let card_y = ROW_Y[row];
                let center_x = card_x + CARD_WIDTH_MM / 2.0;

                // 1. Dashed Border
                let border_polygon = Polygon {
                    rings: vec![PolygonRing {
                        points: vec![
                            LinePoint {
                                p: Point::new(Mm(card_x), Mm(card_y)),
                                bezier: false,
                            },
                            LinePoint {
                                p: Point::new(Mm(card_x + CARD_WIDTH_MM), Mm(card_y)),
                                bezier: false,
                            },
                            LinePoint {
                                p: Point::new(
                                    Mm(card_x + CARD_WIDTH_MM),
                                    Mm(card_y + CARD_HEIGHT_MM),
                                ),
                                bezier: false,
                            },
                            LinePoint {
                                p: Point::new(Mm(card_x), Mm(card_y + CARD_HEIGHT_MM)),
                                bezier: false,
                            },
                        ],
                    }],
                    mode: PaintMode::Stroke,
                    winding_order: WindingOrder::NonZero,
                };

                ops.push(Op::SetOutlineColor {
                    col: Color::Rgb(Rgb {
                        r: 0.7,
                        g: 0.7,
                        b: 0.7,
                        icc_profile: None,
                    }),
                });
                ops.push(Op::SetOutlineThickness { pt: Pt(0.75) });
                ops.push(Op::SetLineDashPattern {
                    dash: LineDashPattern::new(0.0, &[3.0, 2.5]),
                });
                ops.push(Op::DrawPolygon {
                    polygon: border_polygon,
                });
                ops.push(Op::SetLineDashPattern {
                    dash: LineDashPattern::solid(),
                });

                // 2. Title
                let title_text = truncate_text(&item.title, 50.0, 9.0);
                let title_w = estimate_text_width_mm(&title_text, 9.0);
                let title_x = (center_x - title_w / 2.0).max(card_x + 2.0);
                let title_y = card_y + CARD_HEIGHT_MM - 7.0;

                ops.push(Op::StartTextSection);
                ops.push(Op::SetFont {
                    font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
                    size: Pt(9.0),
                });
                ops.push(Op::SetTextCursor {
                    pos: Point::new(Mm(title_x), Mm(title_y)),
                });
                ops.push(Op::SetFillColor {
                    col: Color::Rgb(Rgb {
                        r: 0.1,
                        g: 0.1,
                        b: 0.1,
                        icc_profile: None,
                    }),
                });
                ops.push(Op::ShowText {
                    items: vec![TextItem::Text(title_text)],
                });
                ops.push(Op::EndTextSection);

                // 3. Artist
                let artist_raw = item.artist.as_deref().unwrap_or("Unknown Artist");
                let artist_text = truncate_text(artist_raw, 50.0, 8.0);
                let artist_w = estimate_text_width_mm(&artist_text, 8.0);
                let artist_x = (center_x - artist_w / 2.0).max(card_x + 2.0);
                let artist_y = card_y + CARD_HEIGHT_MM - 12.0;

                ops.push(Op::StartTextSection);
                ops.push(Op::SetFont {
                    font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
                    size: Pt(8.0),
                });
                ops.push(Op::SetTextCursor {
                    pos: Point::new(Mm(artist_x), Mm(artist_y)),
                });
                ops.push(Op::SetFillColor {
                    col: Color::Rgb(Rgb {
                        r: 0.35,
                        g: 0.35,
                        b: 0.35,
                        icc_profile: None,
                    }),
                });
                ops.push(Op::ShowText {
                    items: vec![TextItem::Text(artist_text)],
                });
                ops.push(Op::EndTextSection);

                // 4. QR Code
                let qr_payload = format!("discogs-id:{}", item.id);
                let qrcode = QRBuilder::new(qr_payload)
                    .build()
                    .map_err(|e| AppError::Internal(format!("Failed to build QR code: {e:?}")))?;

                let qr_size = qrcode.size;
                let total_modules = qr_size + QR_BORDER_MODULES * 2;
                let img_dimension = total_modules * QR_PIXEL_SCALE;

                let mut pixels = Vec::with_capacity(img_dimension * img_dimension * 3);
                for py in 0..img_dimension {
                    let my = py / QR_PIXEL_SCALE;
                    for px in 0..img_dimension {
                        let mx = px / QR_PIXEL_SCALE;
                        let is_dark = if mx >= QR_BORDER_MODULES
                            && mx < qr_size + QR_BORDER_MODULES
                            && my >= QR_BORDER_MODULES
                            && my < qr_size + QR_BORDER_MODULES
                        {
                            qrcode[my - QR_BORDER_MODULES][mx - QR_BORDER_MODULES].value()
                        } else {
                            false
                        };
                        let val = if is_dark { 0u8 } else { 255u8 };
                        pixels.push(val);
                        pixels.push(val);
                        pixels.push(val);
                    }
                }

                let raw_image = RawImage {
                    pixels: RawImageData::U8(pixels),
                    width: img_dimension,
                    height: img_dimension,
                    data_format: RawImageFormat::RGB8,
                    tag: Vec::new(),
                };
                let image_id = doc.add_image(&raw_image);

                let target_size_pt = Mm(QR_SIZE_MM).into_pt().0;
                let natural_w_pt = Px(img_dimension).into_pt(300.0).0;
                let scale = target_size_pt / natural_w_pt;

                let qr_x = center_x - QR_SIZE_MM / 2.0;
                let qr_y = card_y + 11.0;

                ops.push(Op::UseXobject {
                    id: image_id,
                    transform: XObjectTransform {
                        translate_x: Some(Pt::from(Mm(qr_x))),
                        translate_y: Some(Pt::from(Mm(qr_y))),
                        scale_x: Some(scale),
                        scale_y: Some(scale),
                        dpi: Some(300.0),
                        ..Default::default()
                    },
                });

                // 5. ID Label
                let id_text = format!("ID: {}", item.id);
                let id_w = estimate_text_width_mm(&id_text, 7.5);
                let id_x = center_x - id_w / 2.0;
                let id_y = card_y + 5.5;

                ops.push(Op::StartTextSection);
                ops.push(Op::SetFont {
                    font: PdfFontHandle::Builtin(BuiltinFont::HelveticaOblique),
                    size: Pt(7.5),
                });
                ops.push(Op::SetTextCursor {
                    pos: Point::new(Mm(id_x), Mm(id_y)),
                });
                ops.push(Op::SetFillColor {
                    col: Color::Rgb(Rgb {
                        r: 0.45,
                        g: 0.45,
                        b: 0.45,
                        icc_profile: None,
                    }),
                });
                ops.push(Op::ShowText {
                    items: vec![TextItem::Text(id_text)],
                });
                ops.push(Op::EndTextSection);
            }

            pages.push(PdfPage::new(Mm(210.0), Mm(297.0), ops));
        }

        let mut warnings = Vec::new();
        let pdf_bytes = doc
            .with_pages(pages)
            .save(&PdfSaveOptions::default(), &mut warnings);

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

fn estimate_text_width_mm(text: &str, font_size_pt: f32) -> f32 {
    let mut em_sum = 0.0f32;
    for ch in text.chars() {
        em_sum += match ch {
            'i' | 'l' | 'j' | '!' | '|' | ':' | ';' | '.' | ',' | '\'' | '`' => 0.28,
            'f' | 't' | 'r' | ' ' | '(' | ')' | '[' | ']' | '-' => 0.35,
            'w' | 'm' | 'M' | 'W' => 0.88,
            'A'..='Z' => 0.68,
            _ => 0.52,
        };
    }
    em_sum * font_size_pt * 0.352778
}

fn truncate_text(text: &str, max_width_mm: f32, font_size_pt: f32) -> String {
    if estimate_text_width_mm(text, font_size_pt) <= max_width_mm {
        return text.to_string();
    }
    let ellipsis = "...";
    let ellipsis_w = estimate_text_width_mm(ellipsis, font_size_pt);
    let target_w = max_width_mm - ellipsis_w;
    let mut truncated = String::new();
    for ch in text.chars() {
        if estimate_text_width_mm(&format!("{truncated}{ch}"), font_size_pt) > target_w {
            break;
        }
        truncated.push(ch);
    }
    format!("{truncated}...")
}

#[cfg(test)]
mod tests {
    use super::*;

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

        let mut doc = lopdf::Document::load_mem(&pdf).expect("Valid PDF");
        doc.decompress();
        let mut full_text = String::new();
        for (_, object) in doc.objects.iter() {
            if let lopdf::Object::Stream(stream) = object {
                if let Ok(text) = String::from_utf8(stream.content.clone()) {
                    full_text.push_str(&text);
                }
            }
        }
        // Ensure spaces are preserved (NOT replaced with !)
        assert!(full_text.contains("My Vinyl Collection QR Codes"));
        assert!(full_text.contains("Kind of Blue"));
        assert!(full_text.contains("Miles Davis"));
        assert!(full_text.contains("ID: 1001"));
        assert!(!full_text.contains("My!Vinyl!Collection"));
    }

    #[test]
    fn test_generate_qr_codes_pdf_pagination() {
        let items: Vec<QrCodeItem> = (1..=15)
            .map(|i| QrCodeItem {
                id: 2000 + i,
                title: format!("Record {i}"),
                artist: Some(format!("Artist {i}")),
            })
            .collect();

        let pdf = QrPdfService::generate_qr_codes_pdf(&items).unwrap();
        assert!(!pdf.is_empty());
        assert_eq!(&pdf[0..4], b"%PDF");

        let doc = lopdf::Document::load_mem(&pdf).expect("Valid PDF");
        let pages = doc.get_pages();
        // 15 items with 9 items per page should create 2 pages
        assert_eq!(pages.len(), 2);
    }
}
