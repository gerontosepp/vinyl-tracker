# Design: Rust Testabdeckung >= 80% & CI Enforcement

## Context
Aktuell liegt die Zeilenabdeckung der Rust-Backend-Codebase bei 66,8% (6617 Zeilen). Zur Erreichung des Qualitätsziels von mindestens 80% müssen mindestens 872 zusätzliche Zeilen durch reale Unit- und Integrationstests abgedeckt werden. Die Werkzeugbasis bildet `cargo-llvm-cov` (Version 0.9.1), das im Gegensatz zu Tarpaulin oder gcov LLVM-basierte Instrumentierung ohne Performance-Einbußen und mit vollständiger Unterstützung von Async-Code (Tokio 1.x) bietet.

## Goals / Non-Goals

**Goals:**
- Erhöhung der Gesamtzeilenabdeckung (`lines cover`) im Backend auf mindestens 80,0%.
- Ergänzung echter, assertions-basierter Unit- und Integrationstests in den schwach abgedeckten Services (`collection_sync`, `scan_service`, `record_service`, `discogs`, `marketplace`).
- Verankerung des Checks `cargo llvm-cov --fail-under-lines 80` in `.github/workflows/ci.yml`.

**Non-Goals:**
- Erzeugen von leeren "Mock"-Tests nur zur künstlichen Aufblähung der Metrik (Strict Assertion Rule).
- Änderung der Produktions-API-Routen oder Datenmodelle.
- Abdeckung des MCP-Servers oder des Frontends in diesem Change (Frontend hat bereits > 80% Karma-Gate; MCP wird separat getestet).

## Decisions

1. **Test-Struktur**:
   - Für Datenbank- und SQL-Operationen: Nutzung von Unit-Tests mit Mocks bzw. Erweiterung der Integrationstests in `backend/tests/common/` mit temporären Test-Datenbanken / Transaktions-Rollbacks.
   - Für externe HTTP-APIs (Discogs): Nutzung von Mock-HTTP-Clients oder WireMock zur Simulation realer Discogs-Antworten und Fehlerfälle (429 Rate Limit, 404 Not Found, 500 Internal Error).
2. **CI-Integration**:
   - Nutzung von `taiki-e/install-action@cargo-llvm-cov` in GitHub Actions.
   - Der Schritt wird nach den regulären Tests im Job `backend-test` ausgeführt.

## Risks / Trade-offs

- **[Laufzeit der CI-Pipeline]** → `cargo-llvm-cov` compiliert und führt Tests mit Source-Based Code Coverage aus. Da wir `rust-cache` verwenden und die Tests bereits schnell laufen (< 2s), bleibt der Overhead minimal (< 20s).
- **[Flaky Tests durch parallele DB-Zugriffe]** → Tests in `backend/tests/` nutzen isolierte Test-Records oder isolierte User-IDs, um Interferenzen zu vermeiden.
