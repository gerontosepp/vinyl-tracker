# Tasks

## 1. Backend (`backend/`)

- [x] 1.1 JSON-Export: `format_version: 2` und `listen_history` pro Platte
- [x] 1.2 Restore-DTOs (`CollectionBackupRequest`, `RestoreResultDto`) und Validierung
- [x] 1.3 `CollectionRestoreService`: Upserts für `record_cache`, `record_genres`, `collection_item`, `listen_event` in einer Transaktion
- [x] 1.4 Route `POST /api/collection/restore` mit 25-MB-Body-Limit und Long-Running-Timeout
- [x] 1.5 Integrationstests: Roundtrip Export → Restore, Idempotenz, Merge-Regeln, altes Backup, Validierungsfehler, Auth

## 2. Frontend (`frontend/`)

- [x] 2.1 `ApiService.restoreCollection()` und `RestoreResult`-Modell
- [x] 2.2 Einstellungen → Datenverwaltung: Dateiauswahl, Bestätigungsdialog, Ladeindikator, Toasts
- [x] 2.3 Lokalisierung DE/EN
- [x] 2.4 Unit-Tests (Service, Komponente)

## 3. Dokumentation & Abschluss

- [x] 3.1 `README.md`, `docs/arc42.md`, `docs/Release-Info.md` (inkl. Sync)
- [x] 3.2 Backend: `cargo fmt`, `cargo clippy`, `cargo test`; Frontend: `npm test -- --watch=false --coverage`, `npm run build`
- [x] 3.3 OpenSpec-Change nach dem Merge archivieren
