## 1. Backend
- [x] 1.1 Migration `12_add_sort_key_to_collection_item.sql`
- [x] 1.2 `SHELF_ARTIST_KEY_SQL` berücksichtigt `ci.sort_key`
- [x] 1.3 `RecordDetailDto` um `sort_key` / `default_sort_key` erweitern
- [x] 1.4 `PATCH /api/records/{id}/sort-key` (Validierung, alle Exemplare, 404)
- [x] 1.5 JSON-Backup: Export und Restore von `sort_key`
- [x] 1.6 Integrationstests (Sortierung, Regal, Reset, 404, 400, Backup)

## 2. Frontend
- [x] 2.1 Typen und `ApiService.updateRecordSortKey`
- [x] 2.2 Detail-Dialog: Feld „Sortierung“ mit Speichern/Zurücksetzen
- [x] 2.3 Sammlung nach Änderung neu laden
- [x] 2.4 Übersetzungen (de/en) und Specs

## 3. Doku
- [x] 3.1 README, arc42 (Schema), ADR-0009, Release-Info
