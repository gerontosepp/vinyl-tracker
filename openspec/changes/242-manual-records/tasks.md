## 1. Datenmodell & Schutz
- [ ] 1.1 Migration `14_add_manual_records.sql` (Sequenz, `source`, `manual_uid`, Felder, `record_cover`, `label_photo.label_reading`/`record_id`)
- [ ] 1.2 Sync-Löschpfade nur für `instance_id > 0` + Regressionstest
- [ ] 1.3 Discogs-Seiteneffekte für `source = manual` überspringen (Details, Zustand, Listen, Löschen, Preis-Refresh, Scan)

## 2. Manuelle Platten
- [ ] 2.1 `manual_record_service.rs`: anlegen, bearbeiten, Validierung, Regalplatz
- [ ] 2.2 Cover-Upload (`normalize_image`) und `GET /api/covers/{uuid}`
- [ ] 2.3 DTOs mit `source` und neuen Feldern, Filter `source`
- [ ] 2.4 Barcode-Scan lokal vor Discogs, QR negativer IDs nur lokal, Druck „Manuell #n“
- [ ] 2.5 Label-Erkennung: `label_text` → `label_reading`, „kein Treffer“ getrennt von Fehlern
- [ ] 2.6 Backup v4 + Restore über `manual_uid`

## 3. Frontend
- [ ] 3.1 `ManualRecordFormComponent` mit Cover-Upload / Label-Foto als Cover und Regalplatz
- [ ] 3.2 Einstiege: Label-Inbox, Sammlung, Scanner
- [ ] 3.3 Badge, Filter nach Quelle, Bearbeiten, keine Discogs-Links
- [ ] 3.4 Specs und Playwright

## 4. Doku
- [ ] 4.1 ADR-0023 (Status Accepted bei Umsetzung), README, arc42, Release-Info
