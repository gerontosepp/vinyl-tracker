# Proposal: Identify Mode im Scanner und Vollbild-Cover (#294)

## Why

Der Scanner erfasst heute jeden Treffer als Hör-Ereignis. Wer nur wissen will, welche Platte er in der Hand hält und was dazu gespeichert ist (Regalplatz, Zustand, Preis), muss sie als gehört buchen oder in der Sammlung suchen. Außerdem zeigt das Detail-Modal das Cover nur als 64-px-Vorschau.

## What Changes

- **Identify Mode:** Umschalter im Scanner (gemerkt in `localStorage`). Der Scanner bleibt offen, mehrere Platten können nacheinander identifiziert werden.
- **Rein lesend:** `POST /api/scan` nimmt das optionale Feld `identify` (Standard `false`). Mit `identify: true` findet die Suche denselben Treffer wie bisher, schreibt aber kein `listen_event`.
- **Anzeige:** Ist die Platte im Bestand, öffnet das Frontend dasselbe Detail-Modal wie der Klick auf das Cover in der Plattenliste. Ist sie nicht im Bestand, läuft der normale Ablauf (Discogs-Treffer, Übernahme, manuell anlegen).
- **Cover in voller Auflösung:** Klick auf das Cover im Detail-Modal öffnet eine Lightbox mit dem Originalbild (`cover_url` der Detail-API: primäres Discogs-Bild bzw. eigenes Cover, sonst Thumbnail); Schließen per Klick oder Esc. Gilt überall, wo das Modal verwendet wird.

## Capabilities

### Modified Capabilities
- `scanner`: Identify Mode, Lookup ohne Hör-Ereignis.
- `collection`: Cover in voller Auflösung im Detail-Modal.

## Impact

- Backend: `ScanRequest` (`vinyl-api-types`), `scan_service.rs`, `routes/scan.rs`; Tests.
- Frontend: `ScannerService`, `BarcodeScannerComponent`, `DashboardComponent`, `RecordDetailModalComponent`, Übersetzungen (`de`/`en`).
- Doku: README, `docs/Help.md` + `docs/Help.en.md`, Release-Info.
