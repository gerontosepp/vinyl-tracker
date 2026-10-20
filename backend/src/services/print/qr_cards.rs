//! QR cards: the original QR code layout with 9 cards (56 x 68 mm, 3 x 3) per A4 page.

use super::layout::{self, Labels, PAGE_HEIGHT_MM, PAGE_WIDTH_MM};
use super::{PrintOptions, PrintRecord, PrintRenderer};
use crate::error::AppError;
use printpdf::{BuiltinFont, LineDashPattern, Mm, Op, PaintMode, PdfDocument, PdfPage, Pt};

const CARDS_PER_PAGE: usize = 9;
const COLUMNS: usize = 3;
const CARD_WIDTH_MM: f32 = 56.0;
const CARD_HEIGHT_MM: f32 = 68.0;
/// X coordinates of each column
const COL_X: [f32; 3] = [15.0, 77.0, 139.0];
/// Y coordinates (bottom of card) for each row
const ROW_Y: [f32; 3] = [192.0, 116.0, 40.0];
const QR_SIZE_MM: f32 = 34.0;
const TEXT_WIDTH_MM: f32 = 50.0;

pub struct QrCards;

impl PrintRenderer for QrCards {
    fn render(
        &self,
        doc: &mut PdfDocument,
        records: &[PrintRecord],
        options: &PrintOptions,
    ) -> Result<Vec<PdfPage>, AppError> {
        let labels = Labels::for_language(options.language);
        let mut pages = Vec::new();

        for chunk in records.chunks(CARDS_PER_PAGE) {
            let mut ops = Vec::new();

            let heading_w = layout::text_width_mm(labels.cards_heading, 16.0);
            layout::text(
                &mut ops,
                BuiltinFont::HelveticaBold,
                16.0,
                layout::gray(0.1),
                (PAGE_WIDTH_MM / 2.0 - heading_w / 2.0).max(15.0),
                277.0,
                labels.cards_heading,
            );

            for (idx, record) in chunk.iter().enumerate() {
                let card_x = COL_X[idx % COLUMNS];
                let card_y = ROW_Y[idx / COLUMNS];
                let center_x = card_x + CARD_WIDTH_MM / 2.0;

                // 1. Dashed cutting border
                ops.push(Op::SetOutlineColor {
                    col: layout::gray(0.7),
                });
                ops.push(Op::SetOutlineThickness { pt: Pt(0.75) });
                ops.push(Op::SetLineDashPattern {
                    dash: LineDashPattern::new(0.0, &[3.0, 2.5]),
                });
                ops.push(layout::rect(
                    card_x,
                    card_y,
                    CARD_WIDTH_MM,
                    CARD_HEIGHT_MM,
                    PaintMode::Stroke,
                ));
                ops.push(Op::SetLineDashPattern {
                    dash: LineDashPattern::solid(),
                });

                // 2. Title and artist, centered
                let centered = |text: &str, size: f32| {
                    let w = layout::text_width_mm(text, size);
                    (center_x - w / 2.0).max(card_x + 2.0)
                };
                let title = layout::truncate(&record.title, TEXT_WIDTH_MM, 9.0);
                layout::text(
                    &mut ops,
                    BuiltinFont::HelveticaBold,
                    9.0,
                    layout::gray(0.1),
                    centered(&title, 9.0),
                    card_y + CARD_HEIGHT_MM - 7.0,
                    &title,
                );
                let artist_name = record.artist.as_deref().unwrap_or(labels.unknown_artist);
                let artist = layout::truncate(artist_name, TEXT_WIDTH_MM, 8.0);
                layout::text(
                    &mut ops,
                    BuiltinFont::Helvetica,
                    8.0,
                    layout::gray(0.35),
                    centered(&artist, 8.0),
                    card_y + CARD_HEIGHT_MM - 12.0,
                    &artist,
                );

                // 3. QR code
                let qr = layout::qr_image(doc, record.discogs_id)?;
                layout::place_qr(
                    &mut ops,
                    &qr,
                    center_x - QR_SIZE_MM / 2.0,
                    card_y + 11.0,
                    QR_SIZE_MM,
                );

                // 4. ID
                let id = format!("{}: {}", labels.id, record.discogs_id);
                layout::text(
                    &mut ops,
                    BuiltinFont::HelveticaOblique,
                    7.5,
                    layout::gray(0.45),
                    center_x - layout::text_width_mm(&id, 7.5) / 2.0,
                    card_y + 5.5,
                    &id,
                );
            }

            pages.push(PdfPage::new(Mm(PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), ops));
        }
        Ok(pages)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::print::test_support::*;
    use crate::services::print::{PrintLanguage, PrintService, PrintTemplate};

    fn render(records: &[PrintRecord], language: PrintLanguage) -> Vec<u8> {
        let options = PrintOptions {
            language,
            start_position: None,
        };
        PrintService::render(PrintTemplate::QrCards, records, &options).unwrap()
    }

    #[test]
    fn test_cards_contain_heading_and_record_data() {
        let records = vec![
            record(1001, "Miles Davis", "Kind of Blue"),
            record(1002, "John Coltrane", "A Love Supreme"),
        ];
        let text = pdf_text(&render(&records, PrintLanguage::En));
        // Spaces must be preserved (not replaced with "!")
        assert!(text.contains("My Vinyl Collection QR Codes"));
        assert!(!text.contains("My!Vinyl!Collection"));
        assert!(text.contains("Kind of Blue"));
        assert!(text.contains("Miles Davis"));
        assert!(text.contains("ID: 1001"));
    }

    #[test]
    fn test_nine_cards_per_page() {
        assert_eq!(page_count(&render(&records(9), PrintLanguage::De)), 1);
        assert_eq!(page_count(&render(&records(10), PrintLanguage::De)), 2);
        assert_eq!(page_count(&render(&records(15), PrintLanguage::De)), 2);
    }
}
