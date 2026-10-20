# PR 1 – Kern: Konfiguration, Belegung, Einsortier-Hinweis, Übersicht

## 1. Datenbank & gemeinsame Typen

- [x] 1.1 Migration `backend/migrations/10_add_storage.sql`: Tabellen `storage_type`, `storage_unit`, `storage_boundary` (inkl. Constraints, Indizes, `ON DELETE CASCADE`), Spalte `record_cache.disc_count`
- [x] 1.2 `vinyl-api-types`: DTOs für Lagertyp, Regal, Reihenfolge, `StorageSlotDto`, Nachbarn, Layout (Regale/Fächer/unplaced), Placement (Slot, Nachbarn, Moves); `storage` in `CollectionRelease`/`RecordDetailDto` mit `#[serde(default)]`
- [x] 1.3 Contract-Tests in `crates/vinyl-api-types/tests/json_contract.rs` (Serialisierung, ältere Antworten ohne `storage`)

## 2. Backend: Konfiguration & Disc-Anzahl

- [x] 2.1 `disc_count(formats, media)` in `models/discogs.rs` + Unit-Tests (LP, 2×LP, Box, CD, gemischte Formate, fehlendes `qty`)
- [x] 2.2 `collection_sync` und Hinzufügen: `disc_count` im `record_cache`-Upsert speichern
- [x] 2.3 `services/storage/config.rs`: CRUD für Typen und Regale mit Validierung (Bereiche, Name, Medium, 409 bei benutztem Typ, 404 bei fremden IDs), Reihenfolge setzen
- [x] 2.4 Routen `/api/storage/types`, `/api/storage/units`, `/api/storage/units/order`

## 3. Backend: Belegung

- [x] 3.1 Gemeinsamer Regal-Sortier-Ausdruck für `build_order_by("artist")` und die Layout-Abfrage; Sortierschlüssel-Typ (Künstler, Jahr, Titel, `instance_id`) mit identischer Ordnung in Rust
- [x] 3.2 `services/storage/layout.rs`: Fächer zeilenweise aufbauen, Gleichverteilung (Zielgrenzen nach Kapazitätsanteil), Fallback der Disc-Anzahl; Unit-Tests (mehrere Regale, unterschiedliche Kapazitäten, `D > C`)
- [x] 3.3 `StorageLayout::assign`: Zuordnung nach Grenzen, Ausgleich zum nächsten Fach mit Platz (Richtung nach Anzahl Verschiebungen, Gleichstand rechts), `oversized`, `unplaced`, Ergebnis-Moves; Unit-Tests für alle Spec-Szenarien
- [x] 3.4 `StorageService::commit` (Grenzen speichern) und `redistribute` (manuell mit Vorschau, automatisch bei Strukturänderung und erstem Regal); Aufruf nach Hinzufügen und Discogs-Sync
- [x] 3.5 Routen `GET /api/storage/layout`, `GET /api/storage/redistribute/preview`, `POST /api/storage/redistribute`
- [x] 3.6 Einsortier-Hinweis: `placement` in der Antwort von `POST /api/collection/releases/{id}` (vor `commit` berechnet); `GET /api/storage/placement/{discogsId}` (Slot, Nachbarn) mit 404 wenn nicht in der Sammlung
- [x] 3.7 `collection_query`: `storage` je Eintrag (nur wenn Regale existieren); Test: Reihenfolge Layout = Sammlungsansicht
- [x] 3.8 `record_service`: `storage` und Nachbarn in den Platten-Details
- [x] 3.9 Integrationstests: Konfiguration, Verteilen, Einsortieren ohne Verschiebung, Ausgleich bei vollem Fach, Sync mit Commit, Strukturänderung, Isolation zwischen Nutzern

## 4. Frontend: Kern

- [x] 4.1 Typen und `ApiService` (Typen/Regale CRUD, Reihenfolge, Layout, Neu verteilen + Vorschau, Placement)
- [x] 4.2 Einstellungen „Lagerung“: Lagertypen mit Vorlagen (Kallax 1×4, 2×2, 2×4, 4×4, 5×5 mit 70; CD-Regal 12×1 mit 11), Regale mit Reihenfolge; Hinweis bei automatischem Neu-Verteilen
- [x] 4.3 Regal-Übersicht als Raster mit Füllstand und Künstlerbereich; Anzahl „ohne Platz“; „Neu verteilen“ mit Vorschau und Bestätigung
- [x] 4.4 Komponente `storage-placement` (Slot, Nachbarn, zusammengefasste Verschiebungen); Anzeige nach dem Hinzufügen (Suche/Scan) und im Detail-Modal
- [x] 4.5 Tabelle (Spalte Lagerplatz) und mobile Liste
- [x] 4.6 Übersetzungen DE/EN; Vitest-Specs für alle neuen/geänderten Komponenten und Services

## 5. Doku & Abschluss PR 1

- [x] 5.1 ADR „Lagerposition aus gespeicherten Fachgrenzen“ (+ Index, arc42 Kap. 9)
- [x] 5.2 README (Lagerung, Einsortier-Hinweis), arc42 (Datenmodell, Laufzeitsicht Platzierung), Release-Info „Unreleased“
- [x] 5.3 Lokale Qualitätsprüfung: `cargo fmt`, `cargo clippy`, `cargo test` (Backend + MCP), `npm test -- --watch=false --coverage`, `npm run build`

# PR 2 – Nutzung: Filter, Inventurliste, MCP, Backup

## 6. Filter

- [ ] 6.1 `collection_query`: Filter `storageUnit`/`compartment`/`unplaced` per `instance_id = ANY(...)`; Integrationstests
- [ ] 6.2 Frontend: Toolbar-Filter Regal/Fach/ohne Platz, in `printFilter` übernommen; Klick auf ein Fach in der Übersicht öffnet die gefilterte Sammlung

## 7. Druck

- [ ] 7.1 `PrintRecord` um Lagerplatz erweitern; `load_records` nutzt die Belegung; Vorlage `inventory` registrieren
- [ ] 7.2 `services/print/inventory.rs`: Gruppen je Regal/Fach, „Ohne Platz“ am Ende, Fortsetzung über Seitenwechsel, Ankreuzfeld, DE/EN
- [ ] 7.3 Tests: Gruppenreihenfolge, ohne Regale, Seitenwechsel, englische Texte, Filter-Umfang mit Regal
- [ ] 7.4 Druck-Dialog: Vorlage „Inventurliste“

## 8. MCP

- [ ] 8.1 `get_user_collection`: Lagerplatz ausgeben
- [ ] 8.2 Tools `get_record_placement` und `get_storage_layout`
- [ ] 8.3 Contract-Tests in `mcp/src/server/contract_tests.rs`

## 9. Backup

- [ ] 9.1 Export Version 3 mit `storage { types, units, boundaries }`
- [ ] 9.2 Restore akzeptiert Version 2 und 3; Typen/Regale (mit Grenzen) per Name zusammenführen, danach `commit`; Tests

## 10. Doku & Abschluss PR 2

- [ ] 10.1 README (Filter, Inventurliste, MCP-Tools, Backup), arc42 (Druckvorlagen), Release-Info „Unreleased“
- [ ] 10.2 Übersetzungen DE/EN und Vitest-Specs für die geänderten Komponenten
- [ ] 10.3 Lokale Qualitätsprüfung wie 5.3
