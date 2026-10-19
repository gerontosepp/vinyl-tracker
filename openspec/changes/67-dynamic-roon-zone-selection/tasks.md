# Tasks

## 1. Backend-Validierung & Tests (`backend/`)

- [ ] 1.1 `POST /api/roon/play` prüfen: Priorisierung von `zone_id` gegenüber Default-Zone verifizieren
- [ ] 1.2 Unit-Tests in `backend/src/routes/roon.rs` bzw. `backend/src/services/roon/` für Zonenauswahl ergänzen/sicherstellen

## 2. Frontend-Implementierung (`frontend/`)

- [ ] 2.1 Lokalisierung: Zonen-Auswahl Übersetzungen (DE & EN) in `LanguageService` ergänzen
- [ ] 2.2 `RecordDetailModalComponent`: Laden verfügbarer Zonen (`apiService.getRoonZones()`), Signal für ausgewählte Zone und Dropdown-Menü/Split-Button implementieren
- [ ] 2.3 Session-Caching der zuletzt genutzten Zone implementieren
- [ ] 2.4 Unit-Tests in `record-detail-modal.component.spec.ts` für Zonenauswahl und Playback-Aufruf mit `zone_id` erstellen

## 3. Validierung & OpenSpec-Abschluss

- [ ] 3.1 Backend-Tests und Linter ausführen (`cargo fmt`, `cargo clippy`, `cargo test`)
- [ ] 3.2 Frontend-Tests ausführen (`npm test -- --watch=false` und `npm run build`)
- [ ] 3.3 Dokumentation: `docs/Release-Info.md` aktualisieren & syncen
- [ ] 3.4 OpenSpec Change validieren und archivieren
