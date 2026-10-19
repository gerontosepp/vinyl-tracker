# ADR-0001: Migration des Backends von Spring Boot (Java) zu Rust (Axum, SQLx, Tokio)

* **Status:** Accepted
* **Datum:** 2026-10-05
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** [Lastenheft Rust-Migration](../rust-migration-lastenheft.md)

---

## Kontext & Problemstellung

Das Backend von Vinyl Tracker wurde ursprünglich mit Java 21 und Spring Boot implementiert. Auf selbst gehosteten Zielsystemen (z. B. Proxmox LXC-Container, Home-Server, Raspberry Pi) zeigte die JVM-Lösung signifikante Nachteile:
* Hoher Basisspeicherverbrauch (RSS) von 400–600 MB selbst im Leerlauf.
* Langsame Kaltstartzeiten von 10–20 Sekunden (erschwert schnelle Neustarts und CI-Test-Zyklen).
* Unvorhersehbare Garbage-Collection-Pausen bei Batch-Operationen (z. B. Synchronisation großer Discogs-Sammlungen).
* Große Docker-Container-Images (> 250 MB).

Ziel war eine schlanke, hochperformante, speichersichere und ressourceneffiziente Backend-Architektur, die auf Kleinsthardware stabil läuft.

## Entscheidungstreiber

* **Ressourceneffizienz:** Minimaler RAM-Verbrauch (< 50 MB RSS) und extrem schnelle Kaltstarts (< 100 ms).
* **Typsicherheit & Speichersicherheit:** Vermeidung von NullPointerExceptions und Race Conditions zur Laufzeit.
* **Wartbare Schichtenarchitektur:** Klare Trennung von HTTP-Routing (`routes/`), Geschäftslogik (`services/`) und Datenzugriff (`models/` / SQLx).
* **Single-Binary-Deployment:** Kompaktes, statisch gelinktes Executable ohne JVM-Laufzeitumgebung.

## Betrachtete Optionen

* **Option 1: Rust mit Axum 0.8, Tokio 1.x und SQLx 0.8 (Gewählt)**
  * *Vorteile:* Native Performance, Zero-Cost-Abstraktionen, Compile-Time-geprüfte SQL-Queries (`sqlx`), extrem kleiner Speicher-Footprint (~20–30 MB RSS), modernste async/await-Engine (`tokio`).
  * *Nachteile:* Höhere Lernkurve (Borrow Checker, Lifetimes), längere Build-Zeiten als bei dynamischen Sprachen.

* **Option 2: Spring Boot Native mit GraalVM AOT Compilation**
  * *Vorteile:* Weiterverwendung des bestehenden Java-Codes.
  * *Nachteile:* Hohe Komplexität durch Reflection-Konfiguration für Discogs-DTOs und SQL-Mapping; extrem lange Build-Zeiten in CI (10–15 Minuten pro Build); weiterhin signifikant höherer Speicherverbrauch als native C/Rust-Programme.

* **Option 3: Go (Golang) mit Gin oder Chi**
  * *Vorteile:* Einfache Syntax, schnelle Kompilierungszeiten, geringer Speicherverbrauch.
  * *Nachteile:* Eingebauter Garbage Collector mit periodischem Overhead; schwächeres Typsystem im Vergleich zu Rust (keine algebraischen Datentypen/Pattern Matching auf Rust-Niveau); kein Compile-Time-geprüfter SQL-Zugriff analog zu SQLx.

## Entscheidung

Das Backend wird vollständig in **Rust (Edition 2024)** unter Verwendung von **Axum 0.8**, **Tokio 1.x**, **SQLx 0.8 (PostgreSQL)** und **Refinery** für Datenbankmigrationen neu implementiert.

> **Hinweis (2026-10-19):** Der Migrations-Teil dieser Entscheidung wurde durch [ADR-0017](0017-datenbank-migrationen-mit-sqlx-migrate.md) abgelöst – Migrationen laufen inzwischen über `sqlx::migrate` statt `refinery`.

Die Architektur erzwingt eine strikte 3-Schichten-Trennung:
1. `routes/`: HTTP-Routing, Parameter-Parsing, OpenAPI/RFC 7807 Fehler-Delegation.
2. `services/`: Reine Geschäftslogik (Discogs-Sync, Zustandseinstufung, Roon-Steuerung, PDF-Generierung).
3. `models/`: Domain-Modelle, Serde-DTOs und SQLx-Abfragen.

## Konsequenzen

### Positive Effekte
* **Drastisch reduzierter Ressourcenverbrauch:** Der Speicherbedarf sinkt von ~500 MB auf ~25 MB RSS im Produktivbetrieb.
* **Extrem schneller Start:** Startzeit des Backend-Dienstes liegt bei unter 50 Millisekunden.
* **Kompakte Docker-Images:** Das fertige Produktions-Image (Scratch/Alpine Basis) ist unter 25 MB groß.
* **Robuste Datenintegrität:** Compile-Time-geprüfte SQL-Statements und strikte Fehlerbehandlung (`Result<T, AppError>`).

### Nachteile & Risiken
* **Strengeres Fehlermanagement:** Asynchrone Lifetimes und Referenzen erfordern sorgfältige Modellierung (z. B. `Arc<AppState>`).
* **Kompilierzeit in CI:** Rust-Builds erfordern Caching-Strategien (`Swatinem/rust-cache@v2`), um CI-Zeiten unter 2–3 Minuten zu halten.
