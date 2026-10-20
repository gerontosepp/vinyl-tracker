//! Scan list: A4 table with one scannable QR code per record to log listens from paper.

use super::layout::{self, Labels, PAGE_HEIGHT_MM, PAGE_WIDTH_MM};
use super::{PrintOptions, PrintRecord, PrintRenderer};
use crate::error::AppError;
use chrono::Utc;
use printpdf::{BuiltinFont, Mm, Op, PaintMode, PdfDocument, PdfPage};

const MARGIN_MM: f32 = 15.0;
const HEADER_HEIGHT_MM: f32 = 20.0;
const COLUMN_HEADER_HEIGHT_MM: f32 = 8.0;
const FOOTER_HEIGHT_MM: f32 = 12.0;
const ROW_HEIGHT_MM: f32 = 22.0;
const QR_SIZE_MM: f32 = 18.0;

const TABLE_TOP_MM: f32 = PAGE_HEIGHT_MM - MARGIN_MM - HEADER_HEIGHT_MM;
const ROWS_TOP_MM: f32 = TABLE_TOP_MM - COLUMN_HEADER_HEIGHT_MM;
const ROWS_BOTTOM_MM: f32 = MARGIN_MM + FOOTER_HEIGHT_MM;
pub const ROWS_PER_PAGE: usize = ((ROWS_TOP_MM - ROWS_BOTTOM_MM) / ROW_HEIGHT_MM) as usize;

const TABLE_WIDTH_MM: f32 = PAGE_WIDTH_MM - 2.0 * MARGIN_MM;
const CELL_PADDING_MM: f32 = 1.5;
const TEXT_PT: f32 = 8.0;
const LINE_HEIGHT_MM: f32 = 3.4;

/// Column widths in mm: QR | artist | title | year | format | ID (sum = 180 mm)
const COLUMN_WIDTHS: [f32; 6] = [22.0, 48.0, 58.0, 14.0, 20.0, 18.0];

// QR codes must stay scannable with a phone camera
const _: () = assert!(QR_SIZE_MM >= 15.0);

pub struct ScanList;

fn column_x(index: usize) -> f32 {
    MARGIN_MM + COLUMN_WIDTHS[..index].iter().sum::<f32>()
}

/// Number of pages needed for `records` rows.
pub fn page_count(records: usize) -> usize {
    records.div_ceil(ROWS_PER_PAGE).max(1)
}

impl PrintRenderer for ScanList {
    fn render(
        &self,
        doc: &mut PdfDocument,
        records: &[PrintRecord],
        options: &PrintOptions,
    ) -> Result<Vec<PdfPage>, AppError> {
        let labels = Labels::for_language(options.language);
        let pages = page_count(records.len());
        let date = Utc::now().format(labels.date_format).to_string();
        let subtitle = format!("{date} · {} {}", records.len(), labels.records);

        let mut result = Vec::with_capacity(pages);
        for (page_idx, chunk) in records.chunks(ROWS_PER_PAGE).enumerate() {
            let mut ops = Vec::new();
            draw_header(&mut ops, labels, &subtitle);

            for (row_idx, record) in chunk.iter().enumerate() {
                let row_bottom = ROWS_TOP_MM - (row_idx + 1) as f32 * ROW_HEIGHT_MM;
                if row_idx % 2 == 1 {
                    ops.push(Op::SetFillColor {
                        col: layout::gray(0.96),
                    });
                    ops.push(layout::rect(
                        MARGIN_MM,
                        row_bottom,
                        TABLE_WIDTH_MM,
                        ROW_HEIGHT_MM,
                        PaintMode::Fill,
                    ));
                }
                draw_row(doc, &mut ops, labels, record, row_bottom)?;
            }

            let footer = labels.page_of(page_idx + 1, pages);
            layout::text(
                &mut ops,
                BuiltinFont::Helvetica,
                7.0,
                layout::gray(0.45),
                PAGE_WIDTH_MM - MARGIN_MM - layout::text_width_mm(&footer, 7.0),
                MARGIN_MM,
                &footer,
            );
            layout::text(
                &mut ops,
                BuiltinFont::Helvetica,
                7.0,
                layout::gray(0.45),
                MARGIN_MM,
                MARGIN_MM,
                "Vinyl Tracker",
            );

            result.push(PdfPage::new(Mm(PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), ops));
        }
        Ok(result)
    }
}

fn draw_header(ops: &mut Vec<Op>, labels: &Labels, subtitle: &str) {
    let top = PAGE_HEIGHT_MM - MARGIN_MM;
    layout::text(
        ops,
        BuiltinFont::HelveticaBold,
        14.0,
        layout::gray(0.1),
        MARGIN_MM,
        top - 6.0,
        labels.scan_list_title,
    );
    layout::text(
        ops,
        BuiltinFont::Helvetica,
        9.0,
        layout::gray(0.4),
        MARGIN_MM,
        top - 12.0,
        subtitle,
    );

    ops.push(Op::SetFillColor {
        col: layout::gray(0.88),
    });
    ops.push(layout::rect(
        MARGIN_MM,
        ROWS_TOP_MM,
        TABLE_WIDTH_MM,
        COLUMN_HEADER_HEIGHT_MM,
        PaintMode::Fill,
    ));
    let headings = [
        "QR",
        labels.artist,
        labels.title,
        labels.year,
        labels.format,
        labels.id,
    ];
    for (idx, heading) in headings.iter().enumerate() {
        layout::text(
            ops,
            BuiltinFont::HelveticaBold,
            TEXT_PT,
            layout::gray(0.15),
            column_x(idx) + CELL_PADDING_MM,
            ROWS_TOP_MM + 2.8,
            heading,
        );
    }
}

fn draw_row(
    doc: &mut PdfDocument,
    ops: &mut Vec<Op>,
    labels: &Labels,
    record: &PrintRecord,
    row_bottom: f32,
) -> Result<(), AppError> {
    let qr = layout::qr_image(doc, record.discogs_id)?;
    let qr_offset = (ROW_HEIGHT_MM - QR_SIZE_MM) / 2.0;
    layout::place_qr(
        ops,
        &qr,
        column_x(0) + qr_offset,
        row_bottom + qr_offset,
        QR_SIZE_MM,
    );

    let year = record.year.map(|y| y.to_string()).unwrap_or_default();
    let id = record.discogs_id.to_string();
    let cells = [
        (
            1,
            record.artist.as_deref().unwrap_or(labels.unknown_artist),
            false,
        ),
        (2, record.title.as_str(), true),
        (3, year.as_str(), false),
        (4, record.format.as_str(), false),
        (5, id.as_str(), false),
    ];

    let center = row_bottom + ROW_HEIGHT_MM / 2.0;
    for (column, value, bold) in cells {
        let width = COLUMN_WIDTHS[column] - 2.0 * CELL_PADDING_MM;
        let lines = layout::wrap(value, width, TEXT_PT, 2);
        // Vertically center one or two lines in the row
        let first_baseline = if lines.len() > 1 {
            center + 0.6
        } else {
            center - 1.1
        };
        let font = if bold {
            BuiltinFont::HelveticaBold
        } else {
            BuiltinFont::Helvetica
        };
        layout::text_lines(
            ops,
            font,
            TEXT_PT,
            layout::gray(0.15),
            column_x(column) + CELL_PADDING_MM,
            first_baseline,
            LINE_HEIGHT_MM,
            &lines,
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::print::test_support::{self, pdf_text};
    use crate::services::print::{PrintLanguage, PrintService, PrintTemplate};

    fn render(records: &[PrintRecord], language: PrintLanguage) -> Vec<u8> {
        let options = PrintOptions {
            language,
            start_position: None,
        };
        PrintService::render(PrintTemplate::ScanList, records, &options).unwrap()
    }

    #[test]
    fn test_layout_fits_page() {
        assert_eq!(COLUMN_WIDTHS.iter().sum::<f32>(), TABLE_WIDTH_MM);
        assert_eq!(ROWS_PER_PAGE, 10);
        assert!(ROWS_TOP_MM - ROWS_PER_PAGE as f32 * ROW_HEIGHT_MM >= ROWS_BOTTOM_MM);
    }

    #[test]
    fn test_page_count() {
        for (records, pages) in [(1, 1), (10, 1), (11, 2), (25, 3)] {
            assert_eq!(page_count(records), pages, "{records} records");
            let pdf = render(&test_support::records(records), PrintLanguage::De);
            assert_eq!(test_support::page_count(&pdf), pages, "{records} records");
        }
    }

    #[test]
    fn test_headers_and_page_numbers_on_every_page_in_german() {
        let text = pdf_text(&render(&test_support::records(11), PrintLanguage::De));
        assert!(text.contains("Scan-Liste"));
        assert!(text.contains("11 Platten"));
        assert_eq!(
            text.lines().filter(|l| *l == "Titel").count(),
            2,
            "column headers repeat per page"
        );
        assert!(text.lines().any(|l| l == "Künstler"));
        assert!(text.contains("Seite 1 von 2"));
        assert!(text.contains("Seite 2 von 2"));
        assert!(text.contains("Artist 11"));
        assert!(text.contains("Record 11"));
        assert!(text.contains("5011"));
    }

    #[test]
    fn test_english_labels() {
        let text = pdf_text(&render(&test_support::records(1), PrintLanguage::En));
        for label in [
            "Scan List",
            "Artist",
            "Title",
            "Year",
            "Format",
            "ID",
            "Page 1 of 1",
        ] {
            assert!(text.lines().any(|l| l == label), "missing {label}");
        }
    }
}
