# Proposal: Rust Testabdeckung >= 80% & CI-Pipeline Enforcement

## Why
Die Frontend-Testabdeckung wird in der CI-Pipeline bereits mit einer harten Schranke von > 80% über Karma überwacht. Für das Rust-Backend existiert bisher jedoch noch kein automatisierter Schwellenwert-Check in GitHub Actions. Aktuell liegt die Zeilenabdeckung bei ca. 66,8% (6617 Zeilen Code). Um die Zuverlässigkeit und Robustheit des Backends nachhaltig abzusichern und Regressionen bei künftigen Features zu verhindern, muss die Abdeckung durch gezielte Unit- und Integrationstests auf mindestens 80% angehoben und als harter Gatekeeper in der Pipeline verankert werden (beschlossen in ADR-0006).

## What Changes
- **Gezielte Testausweitung**:
  - `services/collection_sync.rs`: Tests für Discogs-Sammlungs-Synchronisation, Re-Sync-Logik und Fehlerbehandlung (aktuell 13,3% -> Ziel >= 80%).
  - `clients/discogs.rs`: Unit-Tests mit Mocks (z. B. via `wiremock` oder HTTP-Mocking) für Discogs Client Endpunkte (aktuell 17,6% -> Ziel >= 70%).
  - `services/scan_service.rs`: Zusätzliche Tests für Barcode-Verarbeitung, temporäre Scans und Zuordnungen (aktuell 36,1% -> Ziel >= 80%).
  - `services/record_service.rs`: Ausbau der Tests für Alben-Updates, Löschungen und Suchfilter (aktuell 64,1% -> Ziel >= 85%).
  - `services/marketplace.rs`: Testabdeckung für Preis-Refresh und Randfälle (aktuell 59,3% -> Ziel >= 85%).
  - `services/image_proxy.rs` & `services/analytics_service.rs`: Ergänzende Unit-Tests für Caching und Analytics.
- **CI-Pipeline Enforcement**:
  - Erweiterung des Jobs `backend-test` in `.github/workflows/ci.yml` um die Installation von `cargo-llvm-cov` und die Durchsetzung von `cargo llvm-cov --no-report --fail-under-lines 80`.
- **Qualitäts- und Dokumentations-Update**:
  - Aktualisierung von `.agent/rules/quality_standards.md` und `docs/Release-Info.md`.

## Capabilities

### New Capabilities
*(Keine neuen fachlichen Domänen; reine Qualitäts- und Tooling-Erweiterung)*

### Modified Capabilities
*(Keine Spezifikations-Deltas erforderlich, da keine fachlichen Domänenanforderungen geändert werden; `skip_specs: true` ist gesetzt)*

## Impact
- **Backend Codebase**: `backend/src/` und `backend/tests/` (nur zusätzliche Testmodule und Testfunktionen, keine destruktiven API-Änderungen).
- **CI Workflow**: `.github/workflows/ci.yml` bricht künftig ab, wenn die Backend-Testabdeckung unter 80% fällt.
- **Entwicklungs-Richtlinien**: `quality_standards.md` verpflichtet künftig zur Einhaltung des 80%-Schwellenwerts.
