# Tasks

## 1. Testausweitung für Kern-Services (Steigerung auf >= 80%)

- [x] 1.1 Zusätzliche Unit- & Integrationstests für `services/collection_sync.rs` implementieren und mit `cargo test -- collection_sync` verifizieren
- [x] 1.2 Zusätzliche Tests für `services/scan_service.rs` implementieren und mit `cargo test -- scan_service` verifizieren
- [x] 1.3 Zusätzliche Tests für `services/record_service.rs` (CRUD, Updates, Suche) implementieren und mit `cargo test -- record_service` verifizieren
- [x] 1.4 Unit-Tests für `clients/discogs.rs` mit Mock-Responses implementieren und mit `cargo test -- clients::discogs` verifizieren
- [x] 1.5 Randfall-Tests für `services/marketplace.rs`, `services/image_proxy.rs` und `services/analytics_service.rs` ergänzen und verifizieren

## 2. Lokale Coverage- & Qualitäts-Validierung

- [x] 2.1 Gesamtabdeckung mit `cargo llvm-cov --manifest-path backend/Cargo.toml --summary-only` prüfen und sicherstellen, dass Lines Cover >= 80,00% beträgt
- [x] 2.2 Formatierung und Linter fehlerfrei validieren: `cargo fmt --check` und `cargo clippy -- -D warnings`

## 3. CI-Pipeline Enforcement

- [x] 3.1 `backend-test` Job in `.github/workflows/ci.yml` um `cargo-llvm-cov` Step mit `--fail-under-lines 80` erweitern
- [x] 3.2 CI-Workflow-Syntax lokal überprüfen

## 4. Dokumentation & Qualitätssicherung

- [x] 4.1 `.agent/rules/quality_standards.md` mit dem verbindlichen Schwellenwert von >= 80% für Rust aktualisieren
- [x] 4.2 `docs/Release-Info.md` aktualisieren und mit `node scripts/sync-release-info.js` synchronisieren
