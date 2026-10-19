# Proposal: Datenbank-Migrationen auf natives `sqlx::migrate` umstellen (#128)

## Why
Das Backend nutzt für den gesamten Datenzugriff `sqlx` (inkl. aktiviertem Feature `migrate`), führt Schema-Migrationen aber über einen zweiten, parallelen Stack aus `refinery` + `tokio-postgres` aus. Das bedeutet zwei PostgreSQL-Treiber, zwei Verbindungswege (TLS-Konfiguration nur bei `sqlx`, `tokio-postgres` verbindet mit `NoTls`), doppelte Retry-Logik und ~300 Zeilen Sonderlogik in `backend/src/db/migrations.rs`. Zudem führt `refinery` Migrationen ohne Advisory-Lock aus – parallel startende Instanzen bzw. Integrationstests können sich gegenseitig stören.

`sqlx::migrate!` bettet Migrationen zur Compile-Zeit ein, sichert sie per PostgreSQL-Advisory-Lock ab, prüft Checksummen bereits angewendeter Migrationen und läuft über den vorhandenen Connection-Pool.

## What Changes
- **Migrationen über `sqlx::migrate!`**: `run_migrations` nimmt künftig den bestehenden `PgPool` entgegen und führt `sqlx::migrate!("./migrations")` aus. Tabelle für die Historie: `_sqlx_migrations`.
- **Umbenennung der Migrationsdateien**: `V1__initial_schema.sql` → `1_initial_schema.sql` usw. (sqlx erwartet `<VERSION>_<BESCHREIBUNG>.sql`). Der Dateiinhalt bleibt byte-identisch.
- **Einmalige Baseline-Übernahme** beim ersten Start, wenn `_sqlx_migrations` leer ist. Quelle der bereits angewendeten Versionen, in dieser Priorität:
  1. `refinery_schema_history` (aktueller Stand aller Rust-Deployments)
  2. `flyway_schema_history` (Altbestand aus der Spring-Boot-Zeit)
  3. Heuristische Schema-Erkennung (bestehende Logik für Hibernate-Schemata ohne Historie)
  Für jede erkannte Version wird ein Eintrag mit der sqlx-Checksumme der Datei in `_sqlx_migrations` geschrieben; anschließend führt sqlx nur noch fehlende Migrationen aus.
- **Verbindungs-Retry** wandert aus `run_migrations` in `init_pool` (gleiche Env-Variablen `DATABASE_CONNECT_RETRIES`, `DATABASE_CONNECT_RETRY_INTERVAL_SECS`).
- **Entfernte Abhängigkeiten**: `refinery`, `tokio-postgres`.
- **Dokumentation**: neues ADR (Ablösung des Migrations-Teils von ADR-0001), README, arc42, Release-Info.

## Capabilities

### New Capabilities
*(Keine – reine technische Umstellung ohne fachliche Verhaltensänderung)*

### Modified Capabilities
*(Keine Spezifikations-Deltas erforderlich; `skip_specs: true` ist gesetzt)*

## Impact
- **Backend**: `backend/src/db/` (Migrationen, Pool), `backend/src/main.rs` (Reihenfolge Pool → Migrationen), `backend/Cargo.toml`, `backend/migrations/` (Umbenennung), neues `backend/build.rs` (Rebuild bei geänderten Migrationen).
- **Tests**: 14 Aufrufe von `run_migrations` in `backend/tests/` werden auf die Pool-Signatur angepasst; neue Tests für die Baseline-Übernahme.
- **Bestehende Datenbanken**: Beim ersten Start nach dem Update wird `_sqlx_migrations` einmalig befüllt. `refinery_schema_history` und `flyway_schema_history` bleiben unverändert erhalten (Rollback auf die Vorversion bleibt möglich).
- **Kein Einfluss** auf API, Frontend, MCP-Server oder Datenmodell.

## Out of Scope
- Löschen von `refinery_schema_history` / `flyway_schema_history` (frühestens in einem Folge-Release, wenn kein Rollback mehr nötig ist).
- Umstellung der Queries auf compile-time-geprüfte `sqlx::query!`-Makros.
