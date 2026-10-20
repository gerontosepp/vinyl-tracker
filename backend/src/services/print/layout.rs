//! Shared drawing helpers for the print templates (A4, builtin Helvetica fonts, mm coordinates
//! with the origin at the bottom left as in `printpdf`).

use super::PrintLanguage;
use crate::error::AppError;
use fast_qr::QRBuilder;
use printpdf::{
    BuiltinFont, Color, LinePoint, Mm, Op, PaintMode, PdfDocument, PdfFontHandle, Point, Polygon,
    PolygonRing, Pt, Px, RawImage, RawImageData, RawImageFormat, Rgb, TextItem, WindingOrder,
    XObjectId, XObjectTransform,
};

pub const PAGE_WIDTH_MM: f32 = 210.0;
pub const PAGE_HEIGHT_MM: f32 = 297.0;

const ELLIPSIS: char = '…';
const QR_PIXEL_SCALE: usize = 6;
const QR_BORDER_MODULES: usize = 2;
const PT_TO_MM: f32 = 0.352778;

/// Approximate rendered width of `text` in Helvetica (good enough for layout decisions).
pub fn text_width_mm(text: &str, font_size_pt: f32) -> f32 {
    let em_sum: f32 = text
        .chars()
        .map(|ch| match ch {
            'i' | 'l' | 'j' | '!' | '|' | ':' | ';' | '.' | ',' | '\'' | '`' => 0.28,
            'f' | 't' | 'r' | ' ' | '(' | ')' | '[' | ']' | '-' => 0.35,
            'w' | 'm' | 'M' | 'W' => 0.88,
            'A'..='Z' => 0.68,
            _ => 0.52,
        })
        .sum();
    em_sum * font_size_pt * PT_TO_MM
}

/// Shortens `text` to `max_width_mm`, ending it with "…" if anything was cut.
pub fn truncate(text: &str, max_width_mm: f32, font_size_pt: f32) -> String {
    if text_width_mm(text, font_size_pt) <= max_width_mm {
        return text.to_string();
    }
    let target = max_width_mm - text_width_mm(&ELLIPSIS.to_string(), font_size_pt);
    let mut out = String::new();
    for ch in text.chars() {
        out.push(ch);
        if text_width_mm(&out, font_size_pt) > target {
            out.pop();
            break;
        }
    }
    format!("{}{ELLIPSIS}", out.trim_end())
}

/// Word-wraps `text` into at most `max_lines` lines of `max_width_mm`; overlong words are split
/// and the last line is truncated with "…" if text remains.
pub fn wrap(text: &str, max_width_mm: f32, font_size_pt: f32, max_lines: usize) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();

    for word in text.split_whitespace() {
        let candidate = if current.is_empty() {
            word.to_string()
        } else {
            format!("{current} {word}")
        };
        if text_width_mm(&candidate, font_size_pt) <= max_width_mm {
            current = candidate;
            continue;
        }
        if !current.is_empty() {
            lines.push(std::mem::take(&mut current));
        }
        // A single word wider than the line is split character by character
        let mut rest = word.to_string();
        while text_width_mm(&rest, font_size_pt) > max_width_mm {
            let mut head = String::new();
            for ch in rest.chars() {
                head.push(ch);
                if text_width_mm(&head, font_size_pt) > max_width_mm {
                    head.pop();
                    break;
                }
            }
            if head.is_empty() {
                break;
            }
            rest = rest[head.len()..].to_string();
            lines.push(head);
        }
        current = rest;
    }
    if !current.is_empty() {
        lines.push(current);
    }

    if lines.len() > max_lines {
        let remainder = lines[max_lines - 1..].join(" ");
        lines.truncate(max_lines - 1);
        lines.push(truncate(
            &format!("{remainder}{ELLIPSIS}"),
            max_width_mm,
            font_size_pt,
        ));
    }
    lines
}

pub fn gray(value: f32) -> Color {
    Color::Rgb(Rgb {
        r: value,
        g: value,
        b: value,
        icc_profile: None,
    })
}

/// Writes one line of text with its baseline at (`x`, `y`).
pub fn text(
    ops: &mut Vec<Op>,
    font: BuiltinFont,
    size_pt: f32,
    color: Color,
    x: f32,
    y: f32,
    content: &str,
) {
    ops.push(Op::StartTextSection);
    ops.push(Op::SetFont {
        font: PdfFontHandle::Builtin(font),
        size: Pt(size_pt),
    });
    ops.push(Op::SetTextCursor {
        pos: Point::new(Mm(x), Mm(y)),
    });
    ops.push(Op::SetFillColor { col: color });
    ops.push(Op::ShowText {
        items: vec![TextItem::Text(content.to_string())],
    });
    ops.push(Op::EndTextSection);
}

/// Writes several lines top-down starting with the baseline `y`; returns the last baseline.
#[allow(clippy::too_many_arguments)]
pub fn text_lines(
    ops: &mut Vec<Op>,
    font: BuiltinFont,
    size_pt: f32,
    color: Color,
    x: f32,
    y: f32,
    line_height_mm: f32,
    lines: &[String],
) -> f32 {
    let mut baseline = y;
    for (idx, line) in lines.iter().enumerate() {
        baseline = y - idx as f32 * line_height_mm;
        text(ops, font, size_pt, color.clone(), x, baseline, line);
    }
    baseline
}

/// Rectangle path with its bottom-left corner at (`x`, `y`).
pub fn rect(x: f32, y: f32, width: f32, height: f32, mode: PaintMode) -> Op {
    let corner = |px: f32, py: f32| LinePoint {
        p: Point::new(Mm(px), Mm(py)),
        bezier: false,
    };
    Op::DrawPolygon {
        polygon: Polygon {
            rings: vec![PolygonRing {
                points: vec![
                    corner(x, y),
                    corner(x + width, y),
                    corner(x + width, y + height),
                    corner(x, y + height),
                ],
            }],
            mode,
            winding_order: WindingOrder::NonZero,
        },
    }
}

/// A QR code registered as image in the document.
pub struct QrImage {
    id: XObjectId,
    pixels: usize,
}

/// Payload the scanner recognizes as a collection record.
pub fn qr_payload(discogs_id: i64) -> String {
    format!("discogs-id:{discogs_id}")
}

/// Renders the scanner payload for `discogs_id` as black/white raster image with a quiet zone.
pub fn qr_image(doc: &mut PdfDocument, discogs_id: i64) -> Result<QrImage, AppError> {
    let qrcode = QRBuilder::new(qr_payload(discogs_id))
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to build QR code: {e:?}")))?;

    let modules = qrcode.size;
    let pixels = (modules + QR_BORDER_MODULES * 2) * QR_PIXEL_SCALE;
    let mut data = Vec::with_capacity(pixels * pixels * 3);
    for py in 0..pixels {
        let my = py / QR_PIXEL_SCALE;
        for px in 0..pixels {
            let mx = px / QR_PIXEL_SCALE;
            let inside = (QR_BORDER_MODULES..modules + QR_BORDER_MODULES).contains(&mx)
                && (QR_BORDER_MODULES..modules + QR_BORDER_MODULES).contains(&my);
            let dark = inside && qrcode[my - QR_BORDER_MODULES][mx - QR_BORDER_MODULES].value();
            let value = if dark { 0u8 } else { 255u8 };
            data.extend_from_slice(&[value, value, value]);
        }
    }

    let id = doc.add_image(&RawImage {
        pixels: RawImageData::U8(data),
        width: pixels,
        height: pixels,
        data_format: RawImageFormat::RGB8,
        tag: Vec::new(),
    });
    Ok(QrImage { id, pixels })
}

/// Places a QR image as square of `size_mm` with its bottom-left corner at (`x`, `y`).
pub fn place_qr(ops: &mut Vec<Op>, qr: &QrImage, x: f32, y: f32, size_mm: f32) {
    let scale = Mm(size_mm).into_pt().0 / Px(qr.pixels).into_pt(300.0).0;
    ops.push(Op::UseXobject {
        id: qr.id.clone(),
        transform: XObjectTransform {
            translate_x: Some(Pt::from(Mm(x))),
            translate_y: Some(Pt::from(Mm(y))),
            scale_x: Some(scale),
            scale_y: Some(scale),
            dpi: Some(300.0),
            ..Default::default()
        },
    });
}

/// Fixed texts printed on the documents.
pub struct Labels {
    pub cards_heading: &'static str,
    pub scan_list_title: &'static str,
    pub artist: &'static str,
    pub title: &'static str,
    pub year: &'static str,
    pub format: &'static str,
    pub id: &'static str,
    pub unknown_artist: &'static str,
    pub records: &'static str,
    pub page: &'static str,
    pub of: &'static str,
    pub date_format: &'static str,
}

impl Labels {
    pub fn for_language(language: PrintLanguage) -> &'static Labels {
        match language {
            PrintLanguage::De => &Labels {
                cards_heading: "Meine Vinyl-Sammlung – QR-Codes",
                scan_list_title: "Scan-Liste",
                artist: "Künstler",
                title: "Titel",
                year: "Jahr",
                format: "Format",
                id: "ID",
                unknown_artist: "Unbekannter Künstler",
                records: "Platten",
                page: "Seite",
                of: "von",
                date_format: "%d.%m.%Y",
            },
            PrintLanguage::En => &Labels {
                cards_heading: "My Vinyl Collection QR Codes",
                scan_list_title: "Scan List",
                artist: "Artist",
                title: "Title",
                year: "Year",
                format: "Format",
                id: "ID",
                unknown_artist: "Unknown Artist",
                records: "records",
                page: "Page",
                of: "of",
                date_format: "%Y-%m-%d",
            },
        }
    }

    pub fn page_of(&self, page: usize, pages: usize) -> String {
        format!("{} {page} {} {pages}", self.page, self.of)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_keeps_short_text_and_shortens_long_text() {
        assert_eq!(truncate("Abbey Road", 40.0, 8.0), "Abbey Road");

        let long = truncate(
            "The Rise and Fall of Ziggy Stardust and the Spiders from Mars",
            30.0,
            8.0,
        );
        assert!(long.ends_with('…'), "{long}");
        assert!(text_width_mm(&long, 8.0) <= 30.0);
    }

    #[test]
    fn test_wrap_breaks_words_and_limits_lines() {
        let lines = wrap("Mädchen auf dem Dach – Größte Erfolge", 25.0, 8.0, 2);
        assert_eq!(lines.len(), 2);
        assert!(
            lines.iter().all(|l| text_width_mm(l, 8.0) <= 25.0),
            "{lines:?}"
        );
        assert!(lines[1].ends_with('…'), "{lines:?}");
        assert!(lines[0].starts_with("Mädchen"));

        assert_eq!(wrap("Kind of Blue", 40.0, 8.0, 2), vec!["Kind of Blue"]);
        assert!(wrap("", 40.0, 8.0, 2).is_empty());
    }

    #[test]
    fn test_wrap_splits_overlong_single_word() {
        let lines = wrap("Supercalifragilisticexpialidocious", 15.0, 8.0, 3);
        assert!(lines.len() > 1);
        assert!(
            lines.iter().all(|l| text_width_mm(l, 8.0) <= 15.0),
            "{lines:?}"
        );
    }

    #[test]
    fn test_labels_page_of() {
        assert_eq!(
            Labels::for_language(PrintLanguage::De).page_of(2, 5),
            "Seite 2 von 5"
        );
        assert_eq!(
            Labels::for_language(PrintLanguage::En).page_of(1, 1),
            "Page 1 of 1"
        );
    }
}
