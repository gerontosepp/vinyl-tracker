# Architecture Decision Records (ADRs)

Dieses Verzeichnis dokumentiert alle wesentlichen Architektur- und Technologieentscheidungen des Projekts **Vinyl Tracker**.

Als Format dient der bewährte Standard für Architecture Decision Records (angelehnt an MADR und Michael Nygard).

---

## 📋 Übersicht der ADRs

| ID | Datum | Titel | Status |
| :--- | :--- | :--- | :--- |
| [ADR-0001](0001-backend-migration-spring-boot-zu-rust-axum.md) | 2026-10-05 | Migration des Backends von Spring Boot (Java) zu Rust (Axum, SQLx, Tokio) | `Accepted` |
| [ADR-0002](0002-frontend-upgrade-auf-angular-22-und-signals.md) | 2026-10-18 | Modernisierung des Frontends auf Angular 22, Signals und Application Builder | `Accepted` |
| [ADR-0003](0003-nativer-rust-mcp-server-mit-rmcp.md) | 2026-10-17 | Nativer Rust Model Context Protocol (MCP) Server mit `rmcp` SDK | `Accepted` |
| [ADR-0004](0004-aead-aes-256-gcm-kryptografie-fuer-tokens.md) | 2026-10-17 | Kryptografie-Modernisierung auf authentifiziertes AES-256-GCM (AEAD) für Discogs-Tokens | `Accepted` |
| [ADR-0005](0005-direkte-roon-core-integration-via-websocket-moo.md) | 2026-10-17 | Direkte Roon Core Integration via WebSocket und MOO/1 Protokoll | `Accepted` |
| [ADR-0006](0006-rust-test-coverage-enforcement-mit-cargo-llvm-cov.md) | 2026-10-18 | Automatisierte Rust-Testabdeckungsprüfung in der CI-Pipeline via `cargo-llvm-cov` (>= 80%) | `Accepted` |

---

## 🔄 Status-Lifecycle

* **Proposed**: Die Entscheidung wurde vorgeschlagen und befindet sich im Diskussions- / Review-Prozess.
* **Accepted**: Die Entscheidung wurde angenommen und wird umgesetzt bzw. ist bereits aktiv.
* **Rejected**: Der Vorschlag wurde nach Abwägung der Alternativen verworfen.
* **Deprecated**: Die Entscheidung ist nicht mehr aktuell, wurde aber bisher durch keine direkte Nachfolgeentscheidung abgelöst.
* **Superseded**: Die Entscheidung wurde durch einen neueren ADR ersetzt (mit Referenz auf `ADR-XXXX`).

---

## 📝 Vorlage für neue ADRs

Neue ADRs werden nach folgendem Schema unter `docs/adr/XXXX-titel.md` angelegt:

```markdown
# ADR-XXXX: [Prägnanter Titel]

* **Status:** [Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-YYYY]
* **Datum:** YYYY-MM-DD
* **Beteiligte:** [Namen / Rollen]
* **Kontextbezug:** [GitHub Issue #...]

---

## Kontext & Problemstellung

[Welches Problem soll gelöst werden? Welche technischen, fachlichen oder operativen Rahmenbedingungen existieren?]

## Entscheidungstreiber

* [z. B. Performance, Speicherverbrauch, Wartbarkeit, Sicherheit, Entwicklungsgeschwindigkeit]

## Betrachtete Optionen

* **Option 1:** [Beschreibung]
* **Option 2:** [Beschreibung]
* **Option 3:** [Beschreibung]

## Entscheidung

[Gewählte Option und detaillierte Begründung]

## Konsequenzen

### Positive Effekte
* ...

### Nachteile & Risiken
* ...
```
