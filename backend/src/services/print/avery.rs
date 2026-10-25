//! Avery Zweckform 6605/3474 labels: 70 x 37 mm, 3 columns x 8 rows on A4, no page margins
//! left/right (3 x 70 = 210 mm) and 0.5 mm at the top (8 x 37 = 296 mm).

use super::layout::{self, Labels, PAGE_HEIGHT_MM};
use super::{PrintOptions, PrintRecord, PrintRenderer};
use crate::error::AppError;
use printpdf::{BuiltinFont, Mm, PdfDocument, PdfPage};

const COLUMNS: usize = 3;
const ROWS: usize = 8;
pub const LABELS_PER_SHEET: usize = COLUMNS * ROWS;

const LABEL_WIDTH_MM: f32 = 70.0;
const LABEL_HEIGHT_MM: f32 = 37.0;
const TOP_MARGIN_MM: f32 = (PAGE_HEIGHT_MM - ROWS as f32 * LABEL_HEIGHT_MM) / 2.0;
/// Keeps content inside the printable area of common printers and tolerates sheet skew.
const PADDING_MM: f32 = 4.0;

const QR_SIZE_MM: f32 = 24.0;
const QR_TEXT_GAP_MM: f32 = 3.0;
const TEXT_X_MM: f32 = PADDING_MM + QR_SIZE_MM + QR_TEXT_GAP_MM;
const TEXT_WIDTH_MM: f32 = LABEL_WIDTH_MM - TEXT_X_MM - PADDING_MM;

const TITLE_PT: f32 = 8.0;
const ARTIST_PT: f32 = 7.0;
const ID_PT: f32 = 6.0;

// Content keeps the padding and leaves room for the text column
const _: () = assert!(QR_SIZE_MM + 2.0 * PADDING_MM <= LABEL_HEIGHT_MM);
const _: () = assert!(TEXT_WIDTH_MM >= 30.0);

pub struct AveryLabels;

/// Bottom-left corner of the label at `slot` (0-based, row by row from the top left).
fn label_origin(slot: usize) -> (f32, f32) {
    let col = slot % COLUMNS;
    let row = slot / COLUMNS;
    let x = col as f32 * LABEL_WIDTH_MM;
    let y = PAGE_HEIGHT_MM - TOP_MARGIN_MM - (row + 1) as f32 * LABEL_HEIGHT_MM;
    (x, y)
}

impl PrintRenderer for AveryLabels {
    fn render(
        &self,
        doc: &mut PdfDocument,
        records: &[PrintRecord],
        options: &PrintOptions,
    ) -> Result<Vec<PdfPage>, AppError> {
        let labels = Labels::for_language(options.language);
        // Skip the labels already used on a partially used sheet
        let offset = options.start_position.map_or(0, |p| p as usize - 1);
        let page_count = (offset + records.len()).div_ceil(LABELS_PER_SHEET);
        let mut pages: Vec<Vec<printpdf::Op>> = vec![Vec::new(); page_count];

        for (idx, record) in records.iter().enumerate() {
            let position = offset + idx;
            let ops = &mut pages[position / LABELS_PER_SHEET];
            let (x, y) = label_origin(position % LABELS_PER_SHEET);
            let top = y + LABEL_HEIGHT_MM;

            let qr = layout::qr_image(doc, record.discogs_id)?;
            let qr_y = y + (LABEL_HEIGHT_MM - QR_SIZE_MM) / 2.0;
            layout::place_qr(ops, &qr, x + PADDING_MM, qr_y, QR_SIZE_MM);

            let text_x = x + TEXT_X_MM;
            let title = layout::wrap(&record.title, TEXT_WIDTH_MM, TITLE_PT, 2);
            let last_title = layout::text_lines(
                ops,
                BuiltinFont::HelveticaBold,
                TITLE_PT,
                layout::gray(0.1),
                text_x,
                top - PADDING_MM - 3.5,
                3.4,
                &title,
            );

            let artist_name = record.artist.as_deref().unwrap_or(labels.unknown_artist);
            let artist = layout::wrap(artist_name, TEXT_WIDTH_MM, ARTIST_PT, 2);
            layout::text_lines(
                ops,
                BuiltinFont::Helvetica,
                ARTIST_PT,
                layout::gray(0.35),
                text_x,
                last_title - 4.0,
                3.0,
                &artist,
            );

            layout::text(
                ops,
                BuiltinFont::HelveticaOblique,
                ID_PT,
                layout::gray(0.45),
                text_x,
                y + PADDING_MM + 1.5,
                &labels.id_line(record.discogs_id),
            );
        }

        Ok(pages
            .into_iter()
            .map(|ops| PdfPage::new(Mm(layout::PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), ops))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::print::test_support::*;
    use crate::services::print::{PrintLanguage, PrintService, PrintTemplate};

    fn render(records: &[PrintRecord], start_position: Option<u32>) -> Vec<u8> {
        let options = PrintOptions {
            language: PrintLanguage::De,
            start_position,
        };
        PrintService::render(PrintTemplate::Avery3474, records, &options).unwrap()
    }

    #[test]
    fn test_grid_matches_avery_3474_sheet() {
        assert_eq!(LABELS_PER_SHEET, 24);
        assert_eq!(TOP_MARGIN_MM, 0.5);
        // First label at the top left, third at the top right, fourth starts the second row
        assert_eq!(label_origin(0), (0.0, 259.5));
        assert_eq!(label_origin(2), (140.0, 259.5));
        assert_eq!(label_origin(3), (0.0, 222.5));
        // Last label at the bottom right, 0.5 mm above the page edge
        assert_eq!(label_origin(23), (140.0, 0.5));
    }

    #[test]
    fn test_labels_fill_pages_without_heading() {
        let pdf = render(&records(25), None);
        assert_eq!(page_count(&pdf), 2);

        let text = pdf_text(&pdf);
        assert!(text.contains("Record 1"));
        assert!(text.contains("Artist 25"));
        assert!(text.contains("ID: 5025"));
        assert!(!text.contains("QR-Codes"), "labels have no page heading");
    }

    #[test]
    fn test_start_position_skips_used_labels() {
        assert_eq!(page_count(&render(&records(2), Some(23))), 1);
        assert_eq!(page_count(&render(&records(3), Some(23))), 2);
        assert_eq!(page_count(&render(&records(24), Some(1))), 1);
        assert_eq!(page_count(&render(&records(1), Some(24))), 1);
    }

    #[test]
    fn test_long_titles_are_shortened() {
        let long = record(
            1,
            "Ziggy Stardust and the Spiders from Mars featuring Mick Ronson",
            "The Rise and Fall of Ziggy Stardust and the Spiders from Mars (50th Anniversary Edition)",
        );
        let text = pdf_text(&render(&[long], None));
        assert!(
            !text.contains("50th Anniversary Edition"),
            "title must be shortened"
        );
    }
}
