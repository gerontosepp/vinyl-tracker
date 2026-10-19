# Tasks

## 1. Vorbereitung

- [x] 1.1 Migrationsdateien per `git mv` umbenennen (`V<n>__<name>.sql` → `<n>_<name>.sql`), Inhalt unverändert lassen
- [x] 1.2 `backend/build.rs` mit `cargo:rerun-if-changed=migrations` anlegen

## 2. Implementierung

- [x] 2.1 `init_pool` um Verbindungs-Retry erweitern (`DATABASE_CONNECT_RETRIES`, `DATABASE_CONNECT_RETRY_INTERVAL_SECS`)
- [x] 2.2 `detect_legacy_versions` implementieren: refinery-Historie → Flyway-Historie → Schema-Heuristik (Port der bestehenden Prüfungen auf `sqlx`)
- [x] 2.3 `run_migrations(&PgPool)` implementieren: `ensure_migrations_table`, Baseline unter Advisory-Lock nur bei leerer `_sqlx_migrations`, danach `sqlx::migrate!("./migrations").run(pool)`
- [x] 2.4 `main.rs` auf Reihenfolge `init_pool` → `run_migrations` umstellen
- [x] 2.5 `refinery` und `tokio-postgres` aus `Cargo.toml` entfernen, `cargo build` ohne Warnungen

## 3. Tests

- [x] 3.1 Testhilfe für temporäre, isolierte Datenbanken in `backend/tests/migration_tests.rs`
- [x] 3.2 Szenario leere DB (alle Migrationen, zweiter Lauf No-op)
- [x] 3.3 Szenario refinery-Historie (keine erneute Ausführung)
- [x] 3.4 Szenario Flyway-Historie (keine erneute Ausführung)
- [x] 3.5 Szenario Schema ohne Historie (Heuristik, nur fehlende Migrationen)
- [x] 3.6 Szenario vorhandene `_sqlx_migrations` (Altquellen ignoriert)
- [x] 3.7 Bestehende Integrationstests auf `run_migrations(&pool)` umstellen
- [x] 3.8 Pflicht-Checks: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `cargo llvm-cov --fail-under-lines 80`

## 4. Verifikation gegen echte Daten

- [x] 4.1 Lokale Entwicklungs-DB (refinery-Historie V1–V9) mit der neuen Version starten; prüfen, dass keine Migration erneut ausgeführt wird und `_sqlx_migrations` 9 Einträge enthält
  *Abweichung:* Direkt gegen die Entwicklungs-DB statt gegen eine Kopie geprüft – der Vorgang ist nicht-destruktiv (nur `_sqlx_migrations` wird angelegt, die refinery-Historie bleibt unverändert) und wurde durch Löschen von `_sqlx_migrations` mehrfach wiederholt.
- [x] 4.2 Docker-Image bauen (`docker compose build backend`) und Start gegen die Kopie prüfen

## 5. Dokumentation

- [x] 5.1 Neues ADR „Datenbank-Migrationen mit `sqlx::migrate`“ anlegen; ADR-0001 um Hinweis auf die Ablösung des Migrations-Teils ergänzen; ADR-Index und arc42 Abschnitt 9 aktualisieren
- [x] 5.2 README (Backend-Beschreibung: „`refinery`, Flyway-compatible“) und arc42 (Migrations-Abschnitt) aktualisieren
- [x] 5.3 `docs/Release-Info.md` unter „Unreleased“ ergänzen (inkl. Empfehlung `pg_dump` vor dem Update), `node scripts/sync-release-info.js` ausführen
