# Design: Datenbank-Migrationen auf natives `sqlx::migrate` umstellen

## Context
`backend/src/db/migrations.rs` öffnet eine separate `tokio-postgres`-Verbindung (mit Retry-Schleife), legt `refinery_schema_history` an, überträgt bei Bedarf den Stand aus `flyway_schema_history` oder erkennt ihn heuristisch aus dem Schema und führt dann `refinery` aus. Danach baut `main.rs` den `sqlx`-Pool auf.

Relevante Eigenschaften von `sqlx` 0.8.6 (geprüft im Quellcode von `sqlx-core`):
- Dateinamen werden per `splitn(2, '_')` zerlegt, der erste Teil muss als `i64` parsebar sein → `V1__…` ist **nicht** zulässig, `1_…` schon.
- Die Checksumme ist SHA-384 über den Dateiinhalt. Für bereits angewendete Versionen prüft `Migrator::run` die Checksumme und bricht bei Abweichung ab (`VersionMismatch`).
- `Migrator::run` setzt einen Advisory-Lock (`locking: true`) und führt jede Migration in einer Transaktion aus.
- Das Trait `sqlx::migrate::Migrate` stellt `ensure_migrations_table` und `list_applied_migrations` bereit.

Die Migrationen V1–V9 sind nicht idempotent (z. B. `CREATE TABLE app_user` ohne `IF NOT EXISTS`). Eine fehlerhafte Baseline würde also beim Start mit „relation already exists“ abbrechen – laut, aber ohne Datenverlust.

## Goals / Non-Goals

**Goals:**
- Ein einziger DB-Treiber (`sqlx`) und ein einziger Verbindungsweg (inkl. TLS-Konfiguration).
- Bestehende Datenbanken aller drei Herkunftsarten (refinery, Flyway, Hibernate ohne Historie) starten ohne manuellen Eingriff und ohne erneutes Ausführen bereits angewendeter Migrationen.
- Parallel startende Prozesse/Tests sind durch den Advisory-Lock geschützt.

**Non-Goals:**
- Änderungen am Schema selbst.
- Down-Migrationen (`undo`).
- Entfernen der Alt-Historientabellen.

## Decisions

1. **Dateien umbenennen statt eigener `MigrationSource`**
   `V<n>__<name>.sql` → `<n>_<name>.sql`. Inhalt bleibt byte-identisch (die Kommentarzeilen im Dateikopf mit dem alten Namen werden nicht angefasst, da sie in die Checksumme eingehen). Alternative wäre ein eigener Loader, der `Migrator { migrations, .. }` manuell befüllt – mehr Code ohne Mehrwert.
   *Konvention für neue Migrationen*: `<n>_<beschreibung>.sql` mit fortlaufender Nummer (nächste: `10_…`).

2. **Baseline nur, wenn `_sqlx_migrations` leer ist**
   Ablauf in `run_migrations(pool)`:
   1. Verbindung aus dem Pool holen, `ensure_migrations_table()`.
   2. Ist `list_applied_migrations()` leer → `detect_legacy_versions()` ermitteln (refinery → Flyway → Heuristik; erste nicht-leere Quelle gewinnt).
   3. Für jede erkannte Version, die im eingebetteten Migrator existiert: `INSERT INTO _sqlx_migrations (version, description, success, checksum, execution_time) VALUES ($1, $2, TRUE, $3, 0) ON CONFLICT DO NOTHING` mit Beschreibung und Checksumme aus dem `Migrator`.
   4. `MIGRATOR.run(pool)`.
   Schritt 1–3 laufen unter einem eigenen Advisory-Lock (fester Schlüssel, unabhängig vom sqlx-eigenen Migrations-Lock), damit parallel startende Instanzen die Baseline nicht doppelt schreiben. `ON CONFLICT DO NOTHING` macht den Schritt zusätzlich idempotent.
   *Nachtrag aus der Umsetzung:* Auch `ensure_migrations_table()` muss unter dem Lock laufen – gleichzeitige `CREATE TABLE IF NOT EXISTS` können in PostgreSQL mit einer Unique-Verletzung in `pg_type` scheitern (beim ersten Testlauf gegen die Entwicklungs-DB aufgetreten).
   Alle Schema-Prüfungen der Heuristik filtern auf `current_schema()`, damit gleichnamige Tabellen in anderen Schemata nicht fälschlich erkannt werden.

3. **Heuristik unverändert übernehmen**
   Die bestehenden Prüfungen (Tabelle `app_user`, Index `idx_record_cache_discogs`, Spalten `lowest_price`, `format`, `salt`, `roon_host`, `media_condition`, `median_price`) werden 1:1 auf `sqlx`-Queries portiert und in eine eigene, testbare Funktion ausgelagert.

4. **Retry in `init_pool`**
   Der Pool-Aufbau übernimmt die Retry-Schleife (`DATABASE_CONNECT_RETRIES`, Default 15; `DATABASE_CONNECT_RETRY_INTERVAL_SECS`, Default 2). `main.rs`: `init_pool` → `run_migrations(&pool)` → `AppState::new`.

5. **`build.rs`**
   `println!("cargo:rerun-if-changed=migrations");` – damit neue/geänderte Migrationsdateien sicher einen Rebuild auslösen (Empfehlung der sqlx-Dokumentation für `migrate!`).

6. **Tests mit isolierten Datenbanken**
   Baseline-Tests legen pro Test eine temporäre Datenbank an (`CREATE DATABASE vt_mig_<uuid>`), bereiten den jeweiligen Altzustand vor und löschen sie anschließend. Szenarien:
   - Leere DB → alle 9 Migrationen werden ausgeführt; zweiter Lauf ist No-op.
   - Schema per Migrationen erzeugt, nur `refinery_schema_history` (V1–V9) vorhanden → keine Migration wird erneut ausgeführt, `_sqlx_migrations` enthält 9 Einträge.
   - Nur `flyway_schema_history` (Versionen als Text, `success = true`) → wie oben.
   - Schema ohne jede Historie (Teilstand, z. B. bis V6/V7) → Heuristik erkennt den Stand, nur V8–V9 werden ausgeführt.
   - Bereits vorhandene `_sqlx_migrations` → Altquellen werden ignoriert.

## Risks / Trade-offs

- **[Falsche Baseline auf Produktions-DB]** → Abgesichert durch Priorität refinery-Historie (exakt, da vom aktuellen Code geschrieben) und durch die nicht-idempotenten Migrationen, die bei Fehlern laut abbrechen statt still Daten zu verändern. Empfehlung im Release-Hinweis: vor dem Update ein `pg_dump` erstellen.
- **[Rollback auf Vorversion]** → `refinery_schema_history` bleibt unverändert; die alte Version startet weiter. Neue Migrationen (ab V10), die nur in `_sqlx_migrations` erfasst sind, würden von einer alten Version allerdings nicht erkannt → Rollback nur sicher, solange keine neue Migration hinzugekommen ist.
- **[Checksummen-Abweichung durch Editor/Git]** → Zeilenenden-Normalisierung (`.gitattributes`) könnte den Inhalt auf anderen Plattformen ändern. Die CI (Linux) und das Docker-Image bauen auf LF; die Checksumme wird zur Compile-Zeit berechnet und beim Baseline-Schreiben aus demselben Binary verwendet → konsistent.
- **[Breaking Change der internen API]** → `run_migrations(&str)` wird zu `run_migrations(&PgPool)`; betrifft nur Backend-intern und Tests.
