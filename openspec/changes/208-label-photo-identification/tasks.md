## 1. Backend

- [ ] 1.1 `DiscogsSearchFilter` + strukturierte Parameter in `DiscogsClient::search` und `GET /api/discogs/search`
- [ ] 1.2 `label` in Suchergebnissen, `identifiers`/`notes` in Release und Record-Details
- [ ] 1.3 Migration `11_create_label_photo.sql`
- [ ] 1.4 `LabelPhotoService` (Verkleinern, JPEG, EXIF entfernen, CRUD) und Route `/api/label-photos`
- [ ] 1.5 Tests (Client, Routen, Service)

## 2. MCP

- [ ] 2.1 `SearchDiscogsArgs` um strukturierte Filter erweitern, Client durchreichen
- [ ] 2.2 Tools `get_label_inbox` (Image-Content) und `resolve_label_photo`
- [ ] 2.3 Prompts `identify_record_from_label` und `process_label_inbox`
- [ ] 2.4 Tests (Registrierung, Contract)

## 3. Frontend

- [ ] 3.1 `ApiService.uploadLabelPhoto` / `getLabelInboxCount`
- [ ] 3.2 Scanner: Button „Label fotografieren“, clientseitiges Verkleinern, Toast, Badge
- [ ] 3.3 Übersetzungen (de/en) und Specs

## 4. Dokumentation

- [ ] 4.1 README (Anleitung Label-Foto), arc42 (Tabelle, Datenfluss), Release-Info
