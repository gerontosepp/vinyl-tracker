# Proposal: Druck-Modul mit Vorlagen (#157, ersetzt #56)

## Why

Der QR-Code-Export kennt nur ein festes Layout (9 Karten pro A4-Seite mit Überschrift), das auf keinen handelsüblichen Etikettenbogen passt (#56). Weitere Ausdrucke wie Scan-, Verkaufs- oder Inventurlisten sind gewünscht, hätten heute aber jeweils einen eigenen Endpunkt und eigenen Button zur Folge. Ein Druck-Modul mit austauschbaren Vorlagen bündelt das.

## What Changes

- **Neuer Endpunkt `POST /api/print`**: erzeugt ein PDF aus Vorlage, Auswahl und Optionen. Die Plattendaten liest der Server aus der Sammlung des Nutzers.
  - Auswahl: ganze Sammlung, aktuelle Filter der Sammlungsansicht oder markierte Platten (Discogs-IDs).
  - Optionen: Sprache der Beschriftung (DE/EN), Start-Etikett für angebrochene Bögen.
- **Vorlagen der ersten Ausbaustufe**:
  - `avery-3474`: QR-Etiketten für Avery Zweckform 6605/3474 (70×37 mm, 3×8 auf A4), ohne Seitenüberschrift. Druckbeginn ab Etikett 1–24.
  - `scan-list`: Tabelle (Künstler, Titel, Jahr, Format, Discogs-ID) mit einem QR-Code pro Zeile zum Scannen von Hörvorgängen.
  - `qr-cards`: das bisherige Layout (9 Karten pro Seite), unverändert als Vorlage.
- **Frontend: Druck-Dialog** (Vorlage, Umfang, Start-Etikett, Herunterladen):
  - Sammlung: Der Button „QR-Codes drucken“ der Auswahlleiste öffnet den Dialog mit „Auswahl“ bzw. „aktuelle Filter“.
  - Einstellungen: Der QR-Code-Button öffnet den Dialog mit „ganze Sammlung“; der `window.confirm`-Dialog entfällt.
- **BREAKING (API)**: `GET /api/collection/qr-codes/all` und `POST /api/collection/qr-codes/selected` entfallen. Einziger Nutzer ist das eigene Frontend, das auf `POST /api/print` umgestellt wird; der MCP-Server nutzt sie nicht.

Nicht im Umfang: Verkaufsliste mit Preisen und Inventurliste (eigene Issues, setzen auf dem Modul auf), Druckerkalibrierung (Versatz in mm), MCP-Tool für Ausdrucke.

## Capabilities

### New Capabilities
- `print`: Erzeugung druckfertiger PDF-Ausdrucke aus der Sammlung anhand auswählbarer Vorlagen, inklusive Auswahl des Umfangs und vorlagenspezifischer Optionen.

### Modified Capabilities
<!-- Keine: Die bestehenden Specs beschreiben den QR-Export nicht als Requirement. -->

## Impact

- **Backend**: neues Modul `services/print/` (Vorlagen-Renderer, gemeinsame Layout-Helfer aus `qr_pdf_service`), neue Route `routes/print.rs` unter `/api/print` mit Long-Running-Timeout. `qr_pdf_service` geht im Modul auf; das ungenutzte `generate_qr_svg` entfällt. Die beiden alten QR-Routen werden entfernt. Keine DB-Migration.
- **Frontend**: neuer Druck-Dialog (`shared/components/print-dialog`), `ApiService.print()`, Anbindung in Sammlung und Einstellungen, Übersetzungen DE/EN. `downloadQrCodes` und `downloadQrCodesSelected` entfallen.
- **Doku**: README, arc42 (Services, Laufzeitsicht QR-Druck), ADR für das Druck-Modul, Release-Info.
- **Abhängigkeiten**: keine neuen (`printpdf`, `fast_qr` sind vorhanden).
