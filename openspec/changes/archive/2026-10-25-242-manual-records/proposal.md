# Proposal: Manuelle Platten ohne Discogs-Eintrag – Etappe 1 (#242)

## Why

Einige Platten und CDs gibt es bei Discogs nicht. Die Discogs-API kann keine Releases anlegen, also muss Vinyl Tracker solche Platten selbst verwalten. Heute setzt die App überall eine Discogs-Release-ID und eine Discogs-Exemplar-ID voraus; der Discogs-Sync würde manuelle Einträge sogar löschen (`collection_sync.rs`, `DELETE … instance_id != ALL(remote)`).

## What Changes

- **Lokale IDs als negative Discogs-IDs** aus der Sequenz `manual_record_seq` (`record_cache.discogs_id = -n`, `collection_item.instance_id = -n`) plus `record_cache.source` (`discogs` | `manual`) und `manual_uid` (UUID). Sammlung, Regal, Sortierung, Statistik, Druck und MCP-Lesepfade funktionieren dadurch unverändert; negative IDs kollidieren weder mit Discogs- noch mit lokalen IDs (ADR-0023).
- **Sync-Schutz:** Die Lösch-Pfade des Discogs-Syncs betreffen nur `instance_id > 0`. Discogs-Seiteneffekte (Release-Abruf, Preise, Zustands-Sync, Löschen bei Discogs, Preis-Refresh) entfallen für `source = manual`.
- **Neue Felder** in `record_cache`: `label`, `catno`, `country`, `barcode` (indiziert), `notes`; der eigene Wert wird in `median_price` gespeichert und zählt zum Sammlungswert. Covers in `record_cover`.
- **API:** `POST /api/records/manual`, `PUT /api/records/{id}/manual`, `PUT /api/records/{id}/cover` (Upload, verkleinert ohne EXIF), `GET /api/covers/{uuid}` ohne Login (nicht erratbare UUID, damit `<img>` ohne Auth-Cookie funktioniert, vgl. #238). `CollectionRelease` und `RecordDetailDto` liefern `source` und die neuen Felder; Filter `source`.
- **Einstiege im Frontend:** Label-Inbox ohne Treffer (vorausgefüllt aus der Label-Lesung `label_photo.label_reading`), Button „Platte manuell anlegen“ in der Sammlung, Scanner bei unbekanntem Barcode (Barcode vorbelegt). Formular mit Cover-Upload oder Label-Foto als Cover; danach Regalplatz.
- **Markierung:** Badge „Manuell“, Filter nach Quelle, keine Discogs-Links, Bearbeiten in der Detailansicht.
- **Scanner:** lokaler Barcode vor Discogs; QR `discogs-id:-n` wird nur lokal aufgelöst; Druck zeigt „Manuell #n“.
- **Label-Erkennung:** `submit_identification` liefert immer `label_text` (gelesene Label-Daten), gespeichert in `label_photo.label_reading`; „kein Treffer“ wird von technischen Fehlern getrennt.
- **Backup `format_version: 4`:** manuelle Platten inklusive Cover; Restore ordnet über `manual_uid` zu, Version 3 bleibt lesbar.

Nicht im Umfang (Etappe 2, #243): Prüfen bei Discogs, Übernahme der Discogs-Daten, Link zu „Add Release“, MCP-Tool zum Anlegen.

## Capabilities

### Modified Capabilities
- `collection`: manuelle Platten ohne Discogs-Eintrag.

## Impact

- Backend: Migration `14_add_manual_records.sql`, `manual_record_service.rs`, `collection_sync.rs`, `record_service.rs`, `scan_service.rs`, `collection_restore.rs`/`export_service.rs`, Druck, Label-Erkennung, DTOs in `vinyl-api-types`.
- Frontend: `ManualRecordFormComponent`, Label-Inbox, Sammlung (Toolbar, Badge, Filter), Scanner, Detail-Dialog, Übersetzungen.
- Doku: ADR-0023, README, arc42, Release-Info.
