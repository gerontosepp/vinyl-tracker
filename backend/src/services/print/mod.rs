//! Print module: renders collection records into printable PDF documents using templates.

mod avery;
mod inventory;
pub mod layout;
mod qr_cards;
mod scan_list;

use crate::{
    error::AppError,
    models::collection::{CollectionQueryParams, CollectionRelease, ParsedCollectionFilter},
    services::{collection_query::CollectionQueryService, storage::StorageService},
};
use printpdf::{PdfDocument, PdfPage, PdfSaveOptions};
use serde::Deserialize;
use sqlx::PgPool;
use std::collections::HashSet;

/// Upper bound for explicitly selected records.
pub const MAX_PRINT_IDS: usize = 5_000;
/// Labels per Avery 3474 sheet (valid start positions are 1..=LABELS_PER_SHEET).
pub const LABELS_PER_SHEET: u32 = avery::LABELS_PER_SHEET as u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrintTemplate {
    /// Avery Zweckform 6605/3474 labels, 70 x 37 mm, 3 x 8 per A4 sheet
    #[serde(rename = "avery-3474")]
    Avery3474,
    /// Table with one scannable QR code per record
    ScanList,
    /// Legacy layout: 9 QR cards per page
    QrCards,
    /// Checklist grouped by computed storage location
    Inventory,
}

impl PrintTemplate {
    pub fn slug(self) -> &'static str {
        match self {
            Self::Avery3474 => "avery-3474",
            Self::ScanList => "scan-list",
            Self::QrCards => "qr-cards",
            Self::Inventory => "inventory",
        }
    }

    fn document_title(self) -> &'static str {
        match self {
            Self::Avery3474 => "Vinyl Tracker Labels",
            Self::ScanList => "Vinyl Tracker Scan List",
            Self::QrCards => "Vinyl Tracker QR Codes",
            Self::Inventory => "Vinyl Tracker Inventory",
        }
    }
}

/// Which records of the user's collection are printed.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PrintScope {
    #[default]
    All,
    /// Same filters and sorting as `GET /api/collection`
    Filter {
        #[serde(default)]
        filter: Box<CollectionQueryParams>,
    },
    Ids {
        discogs_ids: Vec<i64>,
    },
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PrintLanguage {
    #[default]
    De,
    En,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PrintOptions {
    #[serde(default)]
    pub language: PrintLanguage,
    /// First label to print on (1-24), for partially used label sheets
    pub start_position: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PrintRequest {
    pub template: PrintTemplate,
    #[serde(default)]
    pub scope: PrintScope,
    #[serde(default)]
    pub options: PrintOptions,
}

/// The record data the templates print.
#[derive(Debug, Clone, PartialEq)]
pub struct PrintRecord {
    pub discogs_id: i64,
    pub title: String,
    pub artist: Option<String>,
    pub year: Option<i32>,
    pub format: String,
    /// Computed storage location; `None` for media without shelves
    pub location: Option<PrintLocation>,
}

/// Storage location of a printed copy.
#[derive(Debug, Clone, PartialEq)]
pub struct PrintLocation {
    /// Shelf name and compartment number; `None` if the copy has no place
    pub slot: Option<(String, i32)>,
    /// Compartment index in shelf order (`usize::MAX` without place)
    pub group: usize,
    /// Position of the copy in shelf order
    pub rank: usize,
}

impl From<CollectionRelease> for PrintRecord {
    fn from(release: CollectionRelease) -> Self {
        let info = release.basic_information;
        Self {
            discogs_id: release.id,
            title: info.title,
            artist: info
                .artists
                .into_iter()
                .next()
                .map(|a| a.name)
                .filter(|name| !name.trim().is_empty()),
            year: info.year,
            format: info.format,
            location: None,
        }
    }
}

/// A print template renders all records into pages of one document.
trait PrintRenderer {
    fn render(
        &self,
        doc: &mut PdfDocument,
        records: &[PrintRecord],
        options: &PrintOptions,
    ) -> Result<Vec<PdfPage>, AppError>;
}

pub struct PrintService;

impl PrintService {
    /// Parses and validates a print request; every error is reported as 400 Problem Details.
    pub fn parse_request(body: &[u8]) -> Result<PrintRequest, AppError> {
        let request: PrintRequest = serde_json::from_slice(body)
            .map_err(|e| AppError::BadRequest(format!("Invalid print request: {e}")))?;

        if let Some(position) = request.options.start_position
            && !(1..=LABELS_PER_SHEET).contains(&position)
        {
            return Err(AppError::BadRequest(format!(
                "start_position must be between 1 and {LABELS_PER_SHEET}, got {position}"
            )));
        }
        if let PrintScope::Ids { discogs_ids } = &request.scope
            && discogs_ids.len() > MAX_PRINT_IDS
        {
            return Err(AppError::BadRequest(format!(
                "At most {MAX_PRINT_IDS} records can be selected for printing, got {}",
                discogs_ids.len()
            )));
        }
        Ok(request)
    }

    /// Loads the records of the scope (one entry per collection item, i.e. per copy).
    pub async fn load_records(
        pool: &PgPool,
        user_id: i64,
        scope: &PrintScope,
    ) -> Result<Vec<PrintRecord>, AppError> {
        let params = match scope {
            PrintScope::Filter { filter } => (**filter).clone(),
            PrintScope::All | PrintScope::Ids { .. } => CollectionQueryParams::default(),
        };
        let mut releases = CollectionQueryService::get_collection_for_export(
            pool,
            user_id,
            ParsedCollectionFilter::from(params),
        )
        .await?;

        if let PrintScope::Ids { discogs_ids } = scope {
            let wanted: HashSet<i64> = discogs_ids.iter().copied().collect();
            releases.retain(|r| wanted.contains(&r.id));
        }
        if releases.is_empty() {
            return Err(AppError::BadRequest(
                "The selected scope contains no records of your collection".to_string(),
            ));
        }

        let positions = StorageService::positions(pool, user_id).await?;
        Ok(releases
            .into_iter()
            .map(|release| {
                let location = positions.get(&release.instance_id).map(|p| PrintLocation {
                    slot: p.slot.unit_name.clone().zip(p.slot.compartment),
                    group: p.compartment,
                    rank: p.rank,
                });
                PrintRecord {
                    location,
                    ..PrintRecord::from(release)
                }
            })
            .collect())
    }

    /// Renders `records` with the given template into a PDF document.
    pub fn render(
        template: PrintTemplate,
        records: &[PrintRecord],
        options: &PrintOptions,
    ) -> Result<Vec<u8>, AppError> {
        if records.is_empty() {
            return Err(AppError::BadRequest(
                "Nothing to print: no records given".to_string(),
            ));
        }
        let renderer: &dyn PrintRenderer = match template {
            PrintTemplate::Avery3474 => &avery::AveryLabels,
            PrintTemplate::ScanList => &scan_list::ScanList,
            PrintTemplate::QrCards => &qr_cards::QrCards,
            PrintTemplate::Inventory => &inventory::Inventory,
        };

        let mut doc = PdfDocument::new(template.document_title());
        let pages = renderer.render(&mut doc, records, options)?;
        let mut warnings = Vec::new();
        Ok(doc
            .with_pages(pages)
            .save(&PdfSaveOptions::default(), &mut warnings))
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::PrintRecord;

    pub fn record(discogs_id: i64, artist: &str, title: &str) -> PrintRecord {
        PrintRecord {
            discogs_id,
            title: title.to_string(),
            artist: Some(artist.to_string()),
            year: Some(1977),
            format: "LP".to_string(),
            location: None,
        }
    }

    pub fn records(count: usize) -> Vec<PrintRecord> {
        (1..=count as i64)
            .map(|i| record(5000 + i, &format!("Artist {i}"), &format!("Record {i}")))
            .collect()
    }

    /// Text shown by the PDF's `Tj`/`TJ` operators, one line per operator (WinAnsi decoded).
    pub fn pdf_text(pdf: &[u8]) -> String {
        let doc = lopdf::Document::load_mem(pdf).expect("valid PDF");
        let mut lines = Vec::new();
        for page_id in doc.get_pages().into_values() {
            let content = doc
                .get_and_decode_page_content(page_id)
                .expect("page content");
            for operation in content.operations {
                let strings: Vec<&[u8]> = match operation.operator.as_str() {
                    "Tj" => operation.operands.iter().filter_map(string_bytes).collect(),
                    "TJ" => operation
                        .operands
                        .iter()
                        .filter_map(|o| o.as_array().ok())
                        .flatten()
                        .filter_map(string_bytes)
                        .collect(),
                    _ => continue,
                };
                // WinAnsi equals Latin-1 for all characters the tests use
                lines.push(
                    strings
                        .concat()
                        .iter()
                        .map(|&b| b as char)
                        .collect::<String>(),
                );
            }
        }
        lines.join("\n")
    }

    fn string_bytes(object: &lopdf::Object) -> Option<&[u8]> {
        match object {
            lopdf::Object::String(bytes, _) => Some(bytes),
            _ => None,
        }
    }

    pub fn page_count(pdf: &[u8]) -> usize {
        lopdf::Document::load_mem(pdf)
            .expect("valid PDF")
            .get_pages()
            .len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_support::*;

    fn parse(body: &str) -> Result<PrintRequest, AppError> {
        PrintService::parse_request(body.as_bytes())
    }

    fn bad_request(result: Result<PrintRequest, AppError>) -> String {
        match result {
            Err(AppError::BadRequest(detail)) => detail,
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[test]
    fn test_parse_request_defaults() {
        let request = parse(r#"{"template":"avery-3474"}"#).unwrap();
        assert_eq!(request.template, PrintTemplate::Avery3474);
        assert!(matches!(request.scope, PrintScope::All));
        assert_eq!(request.options.language, PrintLanguage::De);
        assert_eq!(request.options.start_position, None);
    }

    #[test]
    fn test_parse_request_scopes_and_options() {
        let request = parse(
            r#"{"template":"scan-list","scope":{"type":"ids","discogs_ids":[1,2]},"options":{"language":"en","start_position":24}}"#,
        )
        .unwrap();
        assert_eq!(request.template, PrintTemplate::ScanList);
        assert!(
            matches!(request.scope, PrintScope::Ids { ref discogs_ids } if discogs_ids == &[1, 2])
        );
        assert_eq!(request.options.language, PrintLanguage::En);
        assert_eq!(request.options.start_position, Some(24));

        let request = parse(
            r#"{"template":"qr-cards","scope":{"type":"filter","filter":{"genres":"Jazz","sort":"year"}}}"#,
        )
        .unwrap();
        match request.scope {
            PrintScope::Filter { filter } => {
                assert_eq!(filter.genres.as_deref(), Some("Jazz"));
                assert_eq!(filter.sort.as_deref(), Some("year"));
            }
            other => panic!("unexpected scope {other:?}"),
        }
    }

    #[test]
    fn test_parse_request_rejects_unknown_template_with_available_ones() {
        let detail = bad_request(parse(r#"{"template":"poster"}"#));
        for slug in ["avery-3474", "scan-list", "qr-cards", "inventory"] {
            assert!(detail.contains(slug), "{detail}");
        }
        assert!(bad_request(parse("not json")).starts_with("Invalid print request"));
    }

    #[test]
    fn test_parse_request_validates_start_position_and_id_count() {
        for position in [0, 25] {
            let detail = bad_request(parse(&format!(
                r#"{{"template":"avery-3474","options":{{"start_position":{position}}}}}"#
            )));
            assert!(
                detail.contains("start_position must be between 1 and 24"),
                "{detail}"
            );
        }

        let ids: Vec<String> = (0..=MAX_PRINT_IDS).map(|i| i.to_string()).collect();
        let detail = bad_request(parse(&format!(
            r#"{{"template":"scan-list","scope":{{"type":"ids","discogs_ids":[{}]}}}}"#,
            ids.join(",")
        )));
        assert!(detail.contains("At most 5000 records"), "{detail}");
    }

    #[test]
    fn test_render_rejects_empty_records() {
        let result = PrintService::render(PrintTemplate::QrCards, &[], &PrintOptions::default());
        assert!(matches!(result, Err(AppError::BadRequest(_))));
    }

    #[test]
    fn test_render_all_templates_with_special_characters() {
        let records = vec![
            record(1, "Björk", "Début – Größte Hits"),
            record(2, "坂本龍一", "音楽図鑑"),
            PrintRecord {
                artist: None,
                year: None,
                ..record(3, "", "Ohne Künstler")
            },
        ];
        for template in [
            PrintTemplate::Avery3474,
            PrintTemplate::ScanList,
            PrintTemplate::QrCards,
            PrintTemplate::Inventory,
        ] {
            let pdf = PrintService::render(template, &records, &PrintOptions::default())
                .unwrap_or_else(|e| panic!("{template:?}: {e:?}"));
            assert_eq!(&pdf[0..4], b"%PDF", "{template:?}");
            assert_eq!(page_count(&pdf), 1, "{template:?}");
            let text = pdf_text(&pdf);
            assert!(text.contains("Björk"), "{template:?}: umlauts are kept");
            assert!(text.contains("Ohne Künstler"), "{template:?}");
            // Characters outside WinAnsi are replaced instead of failing
            assert!(text.contains("??"), "{template:?}");
        }
    }
}
