//! Inventory list: A4 checklist grouped by computed storage location (shelf, compartment),
//! copies without a place at the end.

use super::layout::{self, Labels, PAGE_HEIGHT_MM, PAGE_WIDTH_MM};
use super::{PrintOptions, PrintRecord, PrintRenderer};
use crate::error::AppError;
use chrono::Utc;
use printpdf::{BuiltinFont, Mm, Op, PaintMode, PdfDocument, PdfPage};

const MARGIN_MM: f32 = 15.0;
const HEADER_HEIGHT_MM: f32 = 20.0;
const COLUMN_HEADER_HEIGHT_MM: f32 = 8.0;
const FOOTER_HEIGHT_MM: f32 = 12.0;
const LINE_HEIGHT_MM: f32 = 7.0;
const CHECKBOX_MM: f32 = 3.5;

const ROWS_TOP_MM: f32 = PAGE_HEIGHT_MM - MARGIN_MM - HEADER_HEIGHT_MM - COLUMN_HEADER_HEIGHT_MM;
const ROWS_BOTTOM_MM: f32 = MARGIN_MM + FOOTER_HEIGHT_MM;
pub const LINES_PER_PAGE: usize = ((ROWS_TOP_MM - ROWS_BOTTOM_MM) / LINE_HEIGHT_MM) as usize;

const TABLE_WIDTH_MM: f32 = PAGE_WIDTH_MM - 2.0 * MARGIN_MM;
const CELL_PADDING_MM: f32 = 1.5;
const TEXT_PT: f32 = 8.0;

/// Column widths in mm: checkbox | artist | title | year | format | ID (sum = 180 mm)
const COLUMN_WIDTHS: [f32; 6] = [10.0, 52.0, 66.0, 12.0, 22.0, 18.0];

pub struct Inventory;

fn column_x(index: usize) -> f32 {
    MARGIN_MM + COLUMN_WIDTHS[..index].iter().sum::<f32>()
}

/// Copies of one compartment (or without place) in shelf order.
struct Group<'a> {
    label: String,
    records: Vec<&'a PrintRecord>,
}

enum Line<'a> {
    Heading {
        label: &'a str,
        count: usize,
        continued: bool,
    },
    Row(&'a PrintRecord),
}

/// Groups the records by compartment in shelf order; copies without a place come last.
fn groups<'a>(records: &'a [PrintRecord], labels: &Labels) -> Vec<Group<'a>> {
    let mut sorted: Vec<&PrintRecord> = records.iter().collect();
    // Stable: copies of media without shelves keep the order of the scope
    sorted.sort_by_key(|r| {
        r.location
            .as_ref()
            .map_or((usize::MAX, usize::MAX), |l| (l.group, l.rank))
    });

    let mut groups: Vec<Group> = Vec::new();
    for record in sorted {
        let label = match record.location.as_ref().and_then(|l| l.slot.as_ref()) {
            Some((unit, compartment)) => format!("{unit} · {} {compartment}", labels.compartment),
            None => labels.no_location.to_string(),
        };
        match groups.last_mut() {
            Some(group) if group.label == label => group.records.push(record),
            _ => groups.push(Group {
                label,
                records: vec![record],
            }),
        }
    }
    groups
}

/// Splits the groups into pages; a heading never ends a page and is repeated with
/// `continued` when a group continues on the next page.
fn paginate<'a>(groups: &'a [Group<'a>], lines_per_page: usize) -> Vec<Vec<Line<'a>>> {
    let mut pages = Vec::new();
    let mut current: Vec<Line> = Vec::new();
    for group in groups {
        if !current.is_empty() && current.len() + 2 > lines_per_page {
            pages.push(std::mem::take(&mut current));
        }
        let heading = |continued| Line::Heading {
            label: &group.label,
            count: group.records.len(),
            continued,
        };
        current.push(heading(false));
        for record in &group.records {
            if current.len() == lines_per_page {
                pages.push(std::mem::take(&mut current));
                current.push(heading(true));
            }
            current.push(Line::Row(record));
        }
    }
    if !current.is_empty() {
        pages.push(current);
    }
    pages
}

impl PrintRenderer for Inventory {
    fn render(
        &self,
        _doc: &mut PdfDocument,
        records: &[PrintRecord],
        options: &PrintOptions,
    ) -> Result<Vec<PdfPage>, AppError> {
        let labels = Labels::for_language(options.language);
        let groups = groups(records, labels);
        let pages = paginate(&groups, LINES_PER_PAGE);
        let date = Utc::now().format(labels.date_format).to_string();
        let subtitle = format!("{date} · {} {}", records.len(), labels.records);

        let mut result = Vec::with_capacity(pages.len());
        for (page_idx, lines) in pages.iter().enumerate() {
            let mut ops = Vec::new();
            draw_header(&mut ops, labels, &subtitle);

            for (line_idx, line) in lines.iter().enumerate() {
                let bottom = ROWS_TOP_MM - (line_idx + 1) as f32 * LINE_HEIGHT_MM;
                match line {
                    Line::Heading {
                        label,
                        count,
                        continued,
                    } => draw_heading(&mut ops, labels, label, *count, *continued, bottom),
                    Line::Row(record) => draw_row(&mut ops, labels, record, bottom),
                }
            }

            let footer = labels.page_of(page_idx + 1, pages.len());
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
        labels.inventory_title,
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
        "",
        labels.artist,
        labels.title,
        labels.year,
        labels.format,
        labels.id,
    ];
    for (idx, heading) in headings.iter().enumerate().skip(1) {
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

fn draw_heading(
    ops: &mut Vec<Op>,
    labels: &Labels,
    label: &str,
    count: usize,
    continued: bool,
    bottom: f32,
) {
    ops.push(Op::SetFillColor {
        col: layout::gray(0.94),
    });
    ops.push(layout::rect(
        MARGIN_MM,
        bottom,
        TABLE_WIDTH_MM,
        LINE_HEIGHT_MM,
        PaintMode::Fill,
    ));
    let text = if continued {
        format!("{label} ({count}) {}", labels.continued)
    } else {
        format!("{label} ({count})")
    };
    layout::text(
        ops,
        BuiltinFont::HelveticaBold,
        9.0,
        layout::gray(0.1),
        MARGIN_MM + CELL_PADDING_MM,
        bottom + 2.3,
        &layout::truncate(&text, TABLE_WIDTH_MM - 2.0 * CELL_PADDING_MM, 9.0),
    );
}

fn draw_row(ops: &mut Vec<Op>, labels: &Labels, record: &PrintRecord, bottom: f32) {
    let box_offset = (LINE_HEIGHT_MM - CHECKBOX_MM) / 2.0;
    ops.push(Op::SetOutlineColor {
        col: layout::gray(0.35),
    });
    ops.push(layout::rect(
        column_x(0) + (COLUMN_WIDTHS[0] - CHECKBOX_MM) / 2.0,
        bottom + box_offset,
        CHECKBOX_MM,
        CHECKBOX_MM,
        PaintMode::Stroke,
    ));

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
    for (column, value, bold) in cells {
        let width = COLUMN_WIDTHS[column] - 2.0 * CELL_PADDING_MM;
        let font = if bold {
            BuiltinFont::HelveticaBold
        } else {
            BuiltinFont::Helvetica
        };
        layout::text(
            ops,
            font,
            TEXT_PT,
            layout::gray(0.15),
            column_x(column) + CELL_PADDING_MM,
            bottom + 2.3,
            &layout::truncate(value, width, TEXT_PT),
        );
    }
    ops.push(Op::SetOutlineColor {
        col: layout::gray(0.85),
    });
    ops.push(layout::rect(
        MARGIN_MM,
        bottom,
        TABLE_WIDTH_MM,
        0.0,
        PaintMode::Stroke,
    ));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::print::test_support::{self, pdf_text, record};
    use crate::services::print::{PrintLanguage, PrintLocation, PrintService, PrintTemplate};

    fn render(records: &[PrintRecord], language: PrintLanguage) -> Vec<u8> {
        let options = PrintOptions {
            language,
            start_position: None,
        };
        PrintService::render(PrintTemplate::Inventory, records, &options).unwrap()
    }

    fn placed(
        id: i64,
        artist: &str,
        unit: &str,
        compartment: i32,
        group: usize,
        rank: usize,
    ) -> PrintRecord {
        PrintRecord {
            location: Some(PrintLocation {
                slot: Some((unit.to_string(), compartment)),
                group,
                rank,
            }),
            ..record(id, artist, &format!("Title {id}"))
        }
    }

    fn unplaced(id: i64, artist: &str, rank: usize) -> PrintRecord {
        PrintRecord {
            location: Some(PrintLocation {
                slot: None,
                group: usize::MAX,
                rank,
            }),
            ..record(id, artist, &format!("Title {id}"))
        }
    }

    fn position(text: &str, needle: &str) -> usize {
        text.find(needle)
            .unwrap_or_else(|| panic!("missing {needle} in {text}"))
    }

    #[test]
    fn test_layout_fits_page() {
        assert_eq!(COLUMN_WIDTHS.iter().sum::<f32>(), TABLE_WIDTH_MM);
        assert_eq!(LINES_PER_PAGE, 32);
    }

    #[test]
    fn test_groups_in_shelf_order_with_unplaced_last() {
        // Given in collection order, not in shelf order
        let records = vec![
            unplaced(1, "Zappa", 9),
            placed(2, "Beatles", "Kallax-1", 2, 1, 3),
            placed(3, "Abba", "Kallax-1", 1, 0, 0),
            placed(4, "Bowie", "Kallax-1", 2, 1, 4),
            placed(5, "Adele", "Kallax-1", 1, 0, 1),
        ];
        let text = pdf_text(&render(&records, PrintLanguage::De));
        assert!(text.contains("Inventurliste"));
        assert!(text.contains("5 Platten"));
        let first = position(&text, "Kallax-1 · Fach 1 (2)");
        let second = position(&text, "Kallax-1 · Fach 2 (2)");
        let none = position(&text, "Ohne Platz (1)");
        assert!(first < second && second < none, "{text}");
        assert!(position(&text, "Abba") < position(&text, "Adele"));
        assert!(position(&text, "Adele") < second);
        assert!(position(&text, "Beatles") < position(&text, "Bowie"));
        assert!(none < position(&text, "Zappa"));
    }

    #[test]
    fn test_without_shelves_everything_is_without_location() {
        let text = pdf_text(&render(&test_support::records(3), PrintLanguage::En));
        assert!(text.contains("No location (3)"), "{text}");
        assert!(!text.contains("Compartment"));
        for label in ["Inventory List", "Artist", "Title", "Page 1 of 1"] {
            assert!(text.lines().any(|l| l == label), "missing {label}");
        }
    }

    #[test]
    fn test_group_continues_on_next_page() {
        let records: Vec<PrintRecord> = (0..40)
            .map(|i| {
                placed(
                    100 + i,
                    &format!("Artist {i:02}"),
                    "Kallax-2",
                    3,
                    0,
                    i as usize,
                )
            })
            .collect();
        let pdf = render(&records, PrintLanguage::De);
        assert_eq!(test_support::page_count(&pdf), 2);
        let text = pdf_text(&pdf);
        assert!(text.contains("Kallax-2 · Fach 3 (40)"));
        assert!(text.contains("Kallax-2 · Fach 3 (40) (Forts.)"), "{text}");
        assert_eq!(text.lines().filter(|l| *l == "Titel").count(), 2);
        assert!(text.contains("Seite 2 von 2"));

        let english = pdf_text(&render(&records, PrintLanguage::En));
        assert!(
            english.contains("Kallax-2 · Compartment 3 (40) (cont.)"),
            "{english}"
        );
    }

    #[test]
    fn test_heading_never_ends_a_page() {
        let mut records: Vec<PrintRecord> = (0..30)
            .map(|i| placed(i, "A", "K", 1, 0, i as usize))
            .collect();
        records.push(placed(99, "B", "K", 2, 1, 99));
        records.push(placed(98, "B", "K", 2, 1, 100));
        // 31 lines for group 1; group 2 (heading + row) does not fit the remaining line
        let groups = groups(&records, Labels::for_language(PrintLanguage::De));
        let pages = paginate(&groups, LINES_PER_PAGE);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].len(), 31);
        assert!(matches!(
            pages[1][0],
            Line::Heading {
                continued: false,
                count: 2,
                ..
            }
        ));
    }
}
