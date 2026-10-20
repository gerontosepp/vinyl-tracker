# Design: Druck-Modul mit Vorlagen

## Context

- `backend/src/services/qr_pdf_service.rs` erzeugt heute das einzige Druck-PDF: 9 Karten (56×68 mm) pro A4-Seite mit Überschrift, QR-Inhalt `discogs-id:<id>`, gerendert per `fast_qr` als Rasterbild und `printpdf` mit Builtin-Fonts (Helvetica). Die Helfer `estimate_text_width_mm`/`truncate_text` liegen dort privat.
- Zwei Routen nutzen es: `GET /api/collection/qr-codes/all` (Daten aus der DB, Künstler-Sortierung) und `POST /api/collection/qr-codes/selected` (Titel/Künstler vom Client). Aufrufer sind nur `SettingsComponent` und `CollectionComponent`.
- `CollectionQueryService::get_collection_for_export` liefert bereits gefilterte und sortierte Platten (eine Zeile pro `collection_item`) für die Exporte.
- Lange Requests laufen über `LONG_RUNNING_PATHS` in `routes/timeout.rs`.

## Goals / Non-Goals

**Goals:**
- Eine Vorlage = ein eigenständiger Renderer; eine neue Vorlage braucht keine Änderung an Route, Datenbeschaffung oder Dialog-Grundgerüst.
- Etiketten treffen den Avery-Bogen ohne Kalibrierung auf üblichen Laserdruckern (Toleranz durch Innenabstand).
- Bestehendes Karten-Layout pixelgleich erhalten.

**Non-Goals:**
- Druckerkalibrierung (Versatz in mm), weitere Etikettenformate, Vorschau im Browser.
- Unicode-Fonts: Es bleibt bei den Builtin-Fonts wie bei den bestehenden PDFs.

## Decisions

### 1. Server liest die Daten, Client schickt nur Umfang
`POST /api/print` mit JSON-Body:
```json
{
  "template": "avery-3474",
  "scope": { "type": "ids", "discogs_ids": [123, 456] },
  "options": { "language": "de", "start_position": 5 }
}
```
`scope.type`: `all` | `filter` (mit denselben Feldern wie die Query-Parameter von `GET /api/collection`) | `ids`. Der Server lädt über `get_collection_for_export`; bei `ids` wird auf die IDs eingeschränkt (max. 5 000 IDs).
- *Warum*: Die Scan-Liste braucht Jahr und Format, künftige Vorlagen Preise und Zustände; das soll nicht der Client mitschicken. Filter-Umfang ist ohne Server-Daten nicht möglich.
- *Alternative*: wie bisher Titel/Künstler vom Client → verworfen, da nicht erweiterbar und manipulierbar.
- POST statt GET, weil ID-Listen URL-Längen sprengen.

### 2. Vorlagen als Trait-Implementierungen
```
services/print/
  mod.rs        PrintService (Datenbeschaffung, Dispatch), PrintTemplate-Enum, PrintRecord, PrintOptions
  layout.rs     gemeinsame Helfer: Textbreite, Kürzen (1–2 Zeilen), QR-Rasterbild, Text-/Rahmen-Ops, Übersetzungen
  avery.rs      AveryLabels (70×37, 3×8)
  scan_list.rs  ScanList
  qr_cards.rs   QrCards (bisheriger Code aus qr_pdf_service, unverändert im Ergebnis)
```
Trait `PrintRenderer { fn render(&self, doc: &mut PdfDocument, records: &[PrintRecord], options: &PrintOptions) -> Result<Vec<PdfPage>, AppError> }`. `PrintTemplate` deserialisiert aus `kebab-case`; unbekannte Werte → 400 mit Liste der Vorlagen.
- *Alternative*: Konfigurierbares Raster-Layout (Datenmodell für Spalten/Zellen) → für 3 Vorlagen überdimensioniert.
- `qr_pdf_service.rs` und die alten Routen werden entfernt; die Tests ziehen in die jeweiligen Vorlagen.

### 3. Geometrie Avery 3474
- Seite 210×297 mm, Etikett 70×37 mm, 3 Spalten ohne Seitenrand (3×70 = 210), 8 Zeilen (8×37 = 296) → oberer Rand 0,5 mm.
- Innenabstand 4 mm: Inhalte der äußeren Spalten bleiben im druckbaren Bereich üblicher Drucker (~3–4 mm), leichte Schieflage des Bogens wird toleriert.
- Inhalt: QR-Code 24×24 mm links, vertikal zentriert; rechts eine Textspalte (≈ 31 mm breit): Titel Helvetica-Bold 8 pt (max. 2 Zeilen), Künstler Helvetica 7 pt (max. 2 Zeilen), unten „ID: …“ Helvetica-Oblique 6 pt.
- `discogs-id:<8-stellig>` ergibt QR-Version 2 (25 Module + 2 Rand) → ca. 0,9 mm pro Modul, auch für die Kamera gut lesbar.
- Startposition: Index `start_position - 1` als Offset; Seitenanzahl = ⌈(offset + n) / 24⌉.
- Keine Schnittlinien (Bögen sind vorgestanzt).

### 4. Geometrie Scan-Liste
- Ränder 15 mm, Kopf (Titel „Scan-Liste“, Datum, Anzahl) 20 mm, Spaltenkopf 8 mm, Fuß (Seitenzahl) 12 mm.
- Zeilenhöhe 22 mm, QR 18 mm (≥ 15 mm laut Spec), ≈ 10 Zeilen pro Seite; abwechselnd hinterlegte Zeilen.
- Spalten (180 mm): QR 22 | Künstler 48 | Titel 58 | Jahr 14 | Format 20 | ID 18; Texte max. 2 Zeilen, gekürzt.
- Seitenzahl „Seite x von y“: Zeilen pro Seite sind fest, `y` steht vor dem Rendern fest.

### 5. Übersetzungen im Backend
Kleine statische Tabelle in `layout.rs` (`Labels::for(lang)`) für die wenigen festen PDF-Texte (de/en). Das Frontend sendet seine aktuelle Sprache mit.
- *Alternative*: Übersetzungen vom Client mitschicken → unnötige API-Fläche.

### 6. Frontend: wiederverwendbarer Druck-Dialog
`shared/components/print-dialog` (standalone, Signals): Eingaben sind die erlaubten Umfänge (`ids` mit Anzahl, `filter`, `all`) plus Daten dazu; Auswahl Vorlage (Radio-Karten mit Kurzbeschreibung), Umfang, Start-Etikett (Zahlenfeld 1–24, nur bei `avery-3474`). „Drucken“ ruft `ApiService.print()` (Blob), lädt `vinyl_<vorlage>.pdf` herunter und schließt den Dialog; bei Fehlern Toast mit Server-Meldung, Dialog bleibt offen.
- Sammlung: Toolbar-Button öffnet den Dialog; mit Auswahl → Standard „Auswahl“, sonst „aktuelle Filter“ (Filter-Signale der Komponente werden übergeben).
- Einstellungen: Button öffnet den Dialog mit „ganze Sammlung“.
- Standard-Vorlage: `avery-3474`.

## Risks / Trade-offs

- [Druckerränder/Skalierung: Browser-PDF-Viewer skalieren gern „auf Seite anpassen“] → Hinweis im Dialog „Mit 100 % / tatsächlicher Größe drucken“; Innenabstand 4 mm als Puffer.
- [Avery-Toleranzen: tatsächlicher oberer Rand kann je Charge abweichen] → Konstante zentral in `avery.rs`; Testdruck auf Normalpapier gegen einen Bogen halten (Task).
- [Builtin-Fonts können Zeichen außerhalb WinAnsi (z. B. Japanisch) nicht darstellen] → bestehende Einschränkung, unverändert. Ein Test prüft, dass Umlaute (ä, ö, ü, ß) und nicht darstellbare Zeichen das Erzeugen nicht abbrechen.
- [BREAKING: alte QR-Routen entfallen] → nur das eigene Frontend nutzt sie; Frontend und Backend werden gemeinsam ausgeliefert.
- [Große Sammlungen: viele QR-Bilder] → wie bisher; Long-Running-Timeout für `/api/print`.

## Migration Plan

Keine DB-Migration. Auslieferung wie üblich (Backend- und Frontend-Image gemeinsam). Rollback: vorheriges Image-Tag deployen.

## Open Questions

- Exakter oberer Rand des konkreten Avery-Bogens (0,5 mm laut Rechnung) – wird beim Testdruck bestätigt; ändert höchstens eine Konstante.
