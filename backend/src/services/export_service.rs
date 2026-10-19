use crate::{
    error::AppError, models::collection::CollectionRelease,
    services::image_proxy::ImageProxyService,
};
use chrono::Utc;
use printpdf::{
    BuiltinFont, Color, LinePoint, Mm, Op, PaintMode, PdfDocument, PdfFontHandle, PdfPage,
    PdfSaveOptions, Point, Polygon, PolygonRing, Pt, Px, RawImage, RawImageData, RawImageFormat,
    Rgb, TextItem, WindingOrder, XObjectTransform,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CollectionBackupDto<'a> {
    pub exported_at: String,
    pub username: &'a str,
    pub total_records: usize,
    pub total_estimated_value: f64,
    pub releases: &'a [CollectionRelease],
}

pub struct ExportService;

impl ExportService {
    /// Generates a CSV export according to RFC 4180
    pub fn export_collection_csv(releases: &[CollectionRelease]) -> Result<Vec<u8>, AppError> {
        let mut wtr = csv::WriterBuilder::new()
            .has_headers(true)
            .from_writer(vec![]);

        wtr.write_record([
            "Artist",
            "Title",
            "Release Year",
            "Format",
            "Genres",
            "Discogs ID",
            "Estimated Value (EUR)",
            "Date Added",
            "Media Condition",
            "Sleeve Condition",
            "Listen Count",
            "Last Played",
        ])
        .map_err(|e| AppError::Internal(format!("Failed to write CSV header: {e}")))?;

        for rel in releases {
            let artist = rel
                .basic_information
                .artists
                .first()
                .map(|a| a.name.as_str())
                .unwrap_or("Unknown Artist");
            let title = &rel.basic_information.title;
            let year = rel
                .basic_information
                .year
                .map(|y| y.to_string())
                .unwrap_or_default();
            let format = &rel.basic_information.format;
            let genres = rel.basic_information.genres.join("; ");
            let discogs_id = rel.id.to_string();
            let estimated_value = rel
                .basic_information
                .median_price
                .or(rel.basic_information.lowest_price)
                .map(|v| format!("{:.2}", v))
                .unwrap_or_default();
            let date_added = &rel.date_added;
            let media_cond = rel.media_condition.as_deref().unwrap_or("");
            let sleeve_cond = rel.sleeve_condition.as_deref().unwrap_or("");
            let listen_count = rel.listen_count.to_string();
            let last_played = rel.last_played_at.as_deref().unwrap_or("");

            wtr.write_record([
                artist,
                title,
                &year,
                format,
                &genres,
                &discogs_id,
                &estimated_value,
                date_added,
                media_cond,
                sleeve_cond,
                &listen_count,
                last_played,
            ])
            .map_err(|e| AppError::Internal(format!("Failed to write CSV record: {e}")))?;
        }

        wtr.into_inner()
            .map_err(|e| AppError::Internal(format!("Failed to finalize CSV data: {e}")))
    }

    /// Generates a structured JSON backup of the user collection
    pub fn export_collection_json(
        username: &str,
        releases: &[CollectionRelease],
    ) -> Result<Vec<u8>, AppError> {
        let total_value: f64 = releases
            .iter()
            .map(|r| {
                r.basic_information
                    .median_price
                    .or(r.basic_information.lowest_price)
                    .unwrap_or(0.0)
            })
            .sum();

        let backup = CollectionBackupDto {
            exported_at: Utc::now().to_rfc3339(),
            username,
            total_records: releases.len(),
            total_estimated_value: (total_value * 100.0).round() / 100.0,
            releases,
        };

        serde_json::to_vec_pretty(&backup)
            .map_err(|e| AppError::Internal(format!("Failed to serialize JSON backup: {e}")))
    }

    /// Generates a printable PDF Catalog & Insurance valuation document via `printpdf`
    pub async fn export_collection_pdf(
        username: &str,
        releases: &[CollectionRelease],
        image_proxy: Option<&ImageProxyService>,
    ) -> Result<Vec<u8>, AppError> {
        let mut doc = PdfDocument::new("Vinyl Tracker Collection Catalog");
        let now = Utc::now();
        let date_str = now.format("%Y-%m-%d %H:%M UTC").to_string();

        let total_items = releases.len();
        let total_value: f64 = releases
            .iter()
            .map(|r| {
                r.basic_information
                    .median_price
                    .or(r.basic_information.lowest_price)
                    .unwrap_or(0.0)
            })
            .sum();
        let priced_items = releases
            .iter()
            .filter(|r| {
                r.basic_information
                    .median_price
                    .or(r.basic_information.lowest_price)
                    .is_some()
            })
            .count();

        // Pagination: Page 1 fits 4 cards (due to summary box), subsequent pages fit 5 cards
        const PAGE1_CAPACITY: usize = 4;
        const OTHER_PAGE_CAPACITY: usize = 5;

        let total_pages = if total_items <= PAGE1_CAPACITY {
            1
        } else {
            1 + (total_items - PAGE1_CAPACITY).div_ceil(OTHER_PAGE_CAPACITY)
        };

        let mut pages = Vec::with_capacity(total_pages);
        let mut current_idx = 0;

        for page_num in 1..=total_pages {
            let is_page_one = page_num == 1;
            let capacity = if is_page_one {
                PAGE1_CAPACITY
            } else {
                OTHER_PAGE_CAPACITY
            };
            let end_idx = (current_idx + capacity).min(total_items);
            let chunk = &releases[current_idx..end_idx];
            current_idx = end_idx;

            let mut ops = Vec::new();

            if is_page_one {
                // Header on Page 1
                Self::draw_page1_header(&mut ops, username, &date_str);
                // Summary Box on Page 1
                Self::draw_summary_box(&mut ops, total_items, total_value, priced_items);
            } else {
                // Compact Header on Page 2+
                Self::draw_compact_header(&mut ops, username, page_num, total_pages);
            }

            // Draw Record Cards
            let card_height_mm = 37.0;
            let card_gap_mm = 4.0;
            let start_y_mm = if is_page_one { 190.0 } else { 235.0 };

            for (idx, rel) in chunk.iter().enumerate() {
                let card_y = start_y_mm - (idx as f32 * (card_height_mm + card_gap_mm));

                // 1. Card Background & Border
                Self::draw_card_frame(&mut ops, card_y, card_height_mm);

                // 2. Cover image or stylized vector sleeve
                let cover_x = 18.0;
                let cover_y = card_y + 3.5;
                let cover_size = 30.0;

                let mut image_placed = false;
                if let Some(raw_img) = match rel.basic_information.thumb_url.as_deref() {
                    Some(thumb_url) => Self::fetch_and_prepare_image(thumb_url, image_proxy).await,
                    None => None,
                } {
                    let img_w = raw_img.width;
                    let image_id = doc.add_image(&raw_img);

                    let target_pt = Mm(cover_size).into_pt().0;
                    let natural_w_pt = Px(img_w).into_pt(300.0).0;
                    let scale = target_pt / natural_w_pt;

                    ops.push(Op::UseXobject {
                        id: image_id,
                        transform: XObjectTransform {
                            translate_x: Some(Pt::from(Mm(cover_x))),
                            translate_y: Some(Pt::from(Mm(cover_y))),
                            scale_x: Some(scale),
                            scale_y: Some(scale),
                            ..Default::default()
                        },
                    });
                    image_placed = true;
                }

                if !image_placed {
                    Self::draw_vector_sleeve(
                        &mut ops,
                        cover_x,
                        cover_y,
                        cover_size,
                        &rel.basic_information.format,
                    );
                }

                // 3. Card Typography & Details
                Self::draw_card_details(&mut ops, rel, card_y);
            }

            // Footer on every page
            Self::draw_page_footer(&mut ops, page_num, total_pages);

            pages.push(PdfPage::new(Mm(210.0), Mm(297.0), ops));
        }

        let mut warnings = Vec::new();
        let pdf_bytes = doc
            .with_pages(pages)
            .save(&PdfSaveOptions::default(), &mut warnings);

        Ok(pdf_bytes)
    }

    async fn fetch_and_prepare_image(
        url: &str,
        proxy: Option<&ImageProxyService>,
    ) -> Option<RawImage> {
        let p = proxy?;
        if url.trim().is_empty() {
            return None;
        }

        // Quick attempt with a 1.2s timeout to avoid blocking PDF export
        let fetch_res =
            tokio::time::timeout(std::time::Duration::from_millis(1200), p.proxy_image(url))
                .await
                .ok()?
                .ok()?;

        let bytes = fetch_res.1;
        let dyn_img = image::load_from_memory(&bytes).ok()?;
        let resized = dyn_img.thumbnail(120, 120);
        let rgb = resized.to_rgb8();
        let (w, h) = rgb.dimensions();

        Some(RawImage {
            pixels: RawImageData::U8(rgb.into_raw()),
            width: w as usize,
            height: h as usize,
            data_format: RawImageFormat::RGB8,
            tag: Vec::new(),
        })
    }

    fn draw_page1_header(ops: &mut Vec<Op>, username: &str, date_str: &str) {
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(16.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(15.0), Mm(280.0)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.1,
                g: 0.12,
                b: 0.18,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(
                "Vinyl Tracker - Collection Catalog & Insurance Report".to_string(),
            )],
        });
        ops.push(Op::EndTextSection);

        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaOblique),
            size: Pt(9.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(15.0), Mm(274.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.4,
                g: 0.45,
                b: 0.52,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(
                "Official Inventory Documentation for Insurance & Archival Purposes".to_string(),
            )],
        });
        ops.push(Op::EndTextSection);

        let meta = format!(
            "User: {username}  |  Exported: {date_str}  |  Standard: Goldmine Grading & Discogs Valuation"
        );
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(8.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(15.0), Mm(269.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.5,
                g: 0.55,
                b: 0.6,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(meta)],
        });
        ops.push(Op::EndTextSection);
    }

    fn draw_compact_header(ops: &mut Vec<Op>, username: &str, page_num: usize, total_pages: usize) {
        let text = format!("Vinyl Tracker Collection Catalog  •  User: {username}");
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(10.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(15.0), Mm(283.0)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.2,
                g: 0.25,
                b: 0.3,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(text)],
        });
        ops.push(Op::EndTextSection);

        let page_indicator = format!("Page {page_num} of {total_pages}");
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(9.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(165.0), Mm(283.0)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.5,
                g: 0.55,
                b: 0.6,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(page_indicator)],
        });
        ops.push(Op::EndTextSection);

        // Divider line
        let line = Polygon {
            rings: vec![PolygonRing {
                points: vec![
                    LinePoint {
                        p: Point::new(Mm(15.0), Mm(280.0)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(195.0), Mm(280.0)),
                        bezier: false,
                    },
                ],
            }],
            mode: PaintMode::Stroke,
            winding_order: WindingOrder::NonZero,
        };
        ops.push(Op::SetOutlineColor {
            col: Color::Rgb(Rgb {
                r: 0.85,
                g: 0.88,
                b: 0.92,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineThickness { pt: Pt(0.75) });
        ops.push(Op::DrawPolygon { polygon: line });
    }

    fn draw_summary_box(
        ops: &mut Vec<Op>,
        total_items: usize,
        total_val: f64,
        priced_items: usize,
    ) {
        let box_x = 15.0;
        let box_y = 236.0;
        let box_w = 180.0;
        let box_h = 28.0;

        let rect = Polygon {
            rings: vec![PolygonRing {
                points: vec![
                    LinePoint {
                        p: Point::new(Mm(box_x), Mm(box_y)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(box_x + box_w), Mm(box_y)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(box_x + box_w), Mm(box_y + box_h)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(box_x), Mm(box_y + box_h)),
                        bezier: false,
                    },
                ],
            }],
            mode: PaintMode::FillStroke,
            winding_order: WindingOrder::NonZero,
        };

        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.95,
                g: 0.965,
                b: 0.99,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineColor {
            col: Color::Rgb(Rgb {
                r: 0.8,
                g: 0.85,
                b: 0.93,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineThickness { pt: Pt(0.8) });
        ops.push(Op::DrawPolygon { polygon: rect });

        // Summary Text
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(8.5),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(box_x + 5.0), Mm(box_y + 20.0)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.3,
                g: 0.4,
                b: 0.65,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(
                "OFFICIAL VALUATION & INVENTORY SUMMARY".to_string(),
            )],
        });
        ops.push(Op::EndTextSection);

        // Stats line: Items & Total Valuation
        let items_text = format!("Total Records: {total_items}");
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(11.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(box_x + 5.0), Mm(box_y + 11.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.1,
                g: 0.12,
                b: 0.18,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(items_text)],
        });
        ops.push(Op::EndTextSection);

        let value_text = format!("Estimated Market Value: EUR {:.2}", total_val);
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(11.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(box_x + 80.0), Mm(box_y + 11.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.18,
                g: 0.3,
                b: 0.8,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(value_text)],
        });
        ops.push(Op::EndTextSection);

        // Pricing footnote
        let sub_text = format!(
            "{priced_items} of {total_items} records valued via Discogs marketplace median/lowest prices."
        );
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(7.5),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(box_x + 5.0), Mm(box_y + 4.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.45,
                g: 0.5,
                b: 0.55,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(sub_text)],
        });
        ops.push(Op::EndTextSection);
    }

    fn draw_card_frame(ops: &mut Vec<Op>, card_y: f32, card_h: f32) {
        let card = Polygon {
            rings: vec![PolygonRing {
                points: vec![
                    LinePoint {
                        p: Point::new(Mm(15.0), Mm(card_y)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(195.0), Mm(card_y)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(195.0), Mm(card_y + card_h)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(15.0), Mm(card_y + card_h)),
                        bezier: false,
                    },
                ],
            }],
            mode: PaintMode::FillStroke,
            winding_order: WindingOrder::NonZero,
        };

        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.99,
                g: 0.992,
                b: 0.995,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineColor {
            col: Color::Rgb(Rgb {
                r: 0.88,
                g: 0.9,
                b: 0.93,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineThickness { pt: Pt(0.65) });
        ops.push(Op::DrawPolygon { polygon: card });
    }

    fn draw_vector_sleeve(ops: &mut Vec<Op>, x: f32, y: f32, size: f32, format_name: &str) {
        let sleeve = Polygon {
            rings: vec![PolygonRing {
                points: vec![
                    LinePoint {
                        p: Point::new(Mm(x), Mm(y)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(x + size), Mm(y)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(x + size), Mm(y + size)),
                        bezier: false,
                    },
                    LinePoint {
                        p: Point::new(Mm(x), Mm(y + size)),
                        bezier: false,
                    },
                ],
            }],
            mode: PaintMode::FillStroke,
            winding_order: WindingOrder::NonZero,
        };

        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.14,
                g: 0.16,
                b: 0.22,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineColor {
            col: Color::Rgb(Rgb {
                r: 0.25,
                g: 0.28,
                b: 0.35,
                icc_profile: None,
            }),
        });
        ops.push(Op::SetOutlineThickness { pt: Pt(0.5) });
        ops.push(Op::DrawPolygon { polygon: sleeve });

        // Center badge with Format name
        let fmt = if format_name.is_empty() {
            "VINYL"
        } else {
            format_name
        };
        let label = Self::truncate(fmt, 6);

        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(9.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(x + 7.0), Mm(y + 13.0)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.85,
                g: 0.88,
                b: 0.95,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(label)],
        });
        ops.push(Op::EndTextSection);
    }

    fn draw_card_details(ops: &mut Vec<Op>, rel: &CollectionRelease, card_y: f32) {
        let details_x = 52.0;

        let artist_name = rel
            .basic_information
            .artists
            .first()
            .map(|a| a.name.as_str())
            .unwrap_or("Unknown Artist");
        let artist_clean = Self::truncate(artist_name, 45);

        // Row 1: Artist & Estimated Value
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(10.5),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(details_x), Mm(card_y + 28.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.08,
                g: 0.1,
                b: 0.15,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(artist_clean)],
        });
        ops.push(Op::EndTextSection);

        let value_str = match rel
            .basic_information
            .median_price
            .or(rel.basic_information.lowest_price)
        {
            Some(v) => format!("EUR {:.2}", v),
            None => "Unvalued".to_string(),
        };
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::HelveticaBold),
            size: Pt(10.5),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(162.0), Mm(card_y + 28.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.18,
                g: 0.3,
                b: 0.8,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(value_str)],
        });
        ops.push(Op::EndTextSection);

        // Row 2: Title
        let title_clean = Self::truncate(&rel.basic_information.title, 55);
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(9.5),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(details_x), Mm(card_y + 22.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.2,
                g: 0.22,
                b: 0.28,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(title_clean)],
        });
        ops.push(Op::EndTextSection);

        // Row 3: Format, Year, Genres
        let year_str = rel
            .basic_information
            .year
            .map(|y| y.to_string())
            .unwrap_or_else(|| "Unknown Year".to_string());
        let genres_str = if rel.basic_information.genres.is_empty() {
            "Unknown Genre".to_string()
        } else {
            rel.basic_information.genres.join(", ")
        };
        let meta_line = format!(
            "Format: {}  •  Year: {}  •  Genres: {}",
            rel.basic_information.format,
            year_str,
            Self::truncate(&genres_str, 40)
        );

        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(8.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(details_x), Mm(card_y + 16.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.38,
                g: 0.42,
                b: 0.48,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(meta_line)],
        });
        ops.push(Op::EndTextSection);

        // Row 4: Condition
        let media_c = rel.media_condition.as_deref().unwrap_or("Not Specified");
        let sleeve_c = rel.sleeve_condition.as_deref().unwrap_or("Not Specified");
        let cond_line = format!("Condition  -  Media: {media_c}  |  Sleeve: {sleeve_c}");

        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(8.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(details_x), Mm(card_y + 10.5)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.3,
                g: 0.34,
                b: 0.4,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(cond_line)],
        });
        ops.push(Op::EndTextSection);

        // Row 5: Metadata (Discogs ID, Date Added, Play count)
        let added_clean = if rel.date_added.len() >= 10 {
            &rel.date_added[0..10]
        } else {
            &rel.date_added
        };
        let id_meta = format!(
            "Discogs ID: {}  •  Added: {}  •  Plays: {}",
            rel.id, added_clean, rel.listen_count
        );

        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(7.5),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(details_x), Mm(card_y + 4.8)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.52,
                g: 0.56,
                b: 0.62,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(id_meta)],
        });
        ops.push(Op::EndTextSection);
    }

    fn draw_page_footer(ops: &mut Vec<Op>, page_num: usize, total_pages: usize) {
        let footer_text = format!(
            "Vinyl Tracker  •  Insurance & Collection Valuation Report  •  Page {page_num} of {total_pages}"
        );
        ops.push(Op::StartTextSection);
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(BuiltinFont::Helvetica),
            size: Pt(8.0),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(45.0), Mm(9.0)),
        });
        ops.push(Op::SetFillColor {
            col: Color::Rgb(Rgb {
                r: 0.55,
                g: 0.58,
                b: 0.64,
                icc_profile: None,
            }),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(footer_text)],
        });
        ops.push(Op::EndTextSection);
    }

    fn truncate(s: &str, max_len: usize) -> String {
        if s.chars().count() <= max_len {
            return s.to_string();
        }
        let truncated: String = s.chars().take(max_len.saturating_sub(3)).collect();
        format!("{truncated}...")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::collection::BasicInformation;
    use crate::models::discogs::DiscogsArtist;

    fn sample_release(id: i64, artist: &str, title: &str, price: Option<f64>) -> CollectionRelease {
        CollectionRelease {
            id,
            instance_id: 100 + id,
            listen_count: 5,
            date_added: "2026-04-10T12:00:00Z".to_string(),
            rating: None,
            media_condition: Some("Near Mint (NM or M-)".to_string()),
            sleeve_condition: Some("Very Good Plus (VG+)".to_string()),
            last_played_at: Some("2026-04-12T15:30:00Z".to_string()),
            notes: None,
            basic_information: BasicInformation {
                id,
                title: title.to_string(),
                artists: vec![DiscogsArtist {
                    name: artist.to_string(),
                    id: Some(1),
                }],
                year: Some(1973),
                thumb_url: None,
                cover_image: None,
                tracklist: None,
                formats: None,
                labels: None,
                genres: vec!["Rock".to_string(), "Prog Rock".to_string()],
                styles: vec![],
                format: "LP".to_string(),
                lowest_price: price.map(|p| p * 0.8),
                median_price: price,
            },
        }
    }

    #[test]
    fn test_export_collection_csv() {
        let releases = vec![
            sample_release(1, "Pink Floyd", "The Dark Side of the Moon", Some(35.50)),
            sample_release(2, "Miles Davis", "Kind of Blue", Some(42.00)),
        ];

        let csv_bytes = ExportService::export_collection_csv(&releases).expect("CSV generation");
        let csv_str = String::from_utf8(csv_bytes).expect("Valid UTF-8 CSV");

        assert!(csv_str.starts_with("Artist,Title,Release Year,Format"));
        assert!(csv_str.contains("Pink Floyd,The Dark Side of the Moon,1973,LP,Rock; Prog Rock,1,35.50,2026-04-10T12:00:00Z,Near Mint (NM or M-),Very Good Plus (VG+),5,2026-04-12T15:30:00Z"));
        assert!(csv_str.contains("Miles Davis,Kind of Blue,1973,LP,Rock; Prog Rock,2,42.00,2026-04-10T12:00:00Z,Near Mint (NM or M-),Very Good Plus (VG+),5,2026-04-12T15:30:00Z"));
    }

    #[test]
    fn test_export_collection_json() {
        let releases = vec![
            sample_release(10, "Led Zeppelin", "IV", Some(28.00)),
            sample_release(11, "The Beatles", "Abbey Road", Some(32.50)),
        ];

        let json_bytes =
            ExportService::export_collection_json("testuser", &releases).expect("JSON generation");
        let json_val: serde_json::Value =
            serde_json::from_slice(&json_bytes).expect("Valid JSON output");

        assert_eq!(json_val["username"], "testuser");
        assert_eq!(json_val["total_records"], 2);
        assert_eq!(json_val["total_estimated_value"], 60.50);
        assert!(json_val["exported_at"].is_string());
        assert_eq!(json_val["releases"].as_array().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn test_export_collection_pdf() {
        let releases = vec![
            sample_release(101, "Fleetwood Mac", "Rumours", Some(25.00)),
            sample_release(102, "David Bowie", "Heroes", Some(30.00)),
            sample_release(103, "Queen", "A Night at the Opera", Some(35.00)),
        ];

        let pdf_bytes = ExportService::export_collection_pdf("vinylegendlp", &releases, None)
            .await
            .expect("PDF generation");

        assert!(!pdf_bytes.is_empty());
        assert_eq!(&pdf_bytes[0..4], b"%PDF");

        // Verify PDF structure with lopdf
        let mut doc = lopdf::Document::load_mem(&pdf_bytes).expect("Valid PDF");
        doc.decompress();

        let mut full_text = String::new();
        for object in doc.objects.values() {
            if let lopdf::Object::Stream(stream) = object
                && let Ok(text) = String::from_utf8(stream.content.clone())
            {
                full_text.push_str(&text);
            }
        }

        assert!(full_text.contains("Vinyl Tracker - Collection Catalog & Insurance Report"));
        assert!(full_text.contains("vinylegendlp"));
        assert!(full_text.contains("Fleetwood Mac"));
        assert!(full_text.contains("Rumours"));
        assert!(full_text.contains("David Bowie"));
        assert!(full_text.contains("Heroes"));
        assert!(full_text.contains("Queen"));
        assert!(full_text.contains("A Night at the Opera"));
    }

    #[tokio::test]
    async fn test_export_collection_pdf_pagination() {
        // 12 items: Page 1 holds 4 items, Page 2 holds 5 items, Page 3 holds 3 items
        let releases: Vec<CollectionRelease> = (1..=12)
            .map(|i| {
                sample_release(
                    i,
                    &format!("Artist {i}"),
                    &format!("Album {i}"),
                    Some(20.0 + i as f64),
                )
            })
            .collect();

        let pdf_bytes = ExportService::export_collection_pdf("user12", &releases, None)
            .await
            .expect("PDF generation");

        let doc = lopdf::Document::load_mem(&pdf_bytes).expect("Valid PDF");
        let pages = doc.get_pages();
        assert_eq!(pages.len(), 3);
    }
}
