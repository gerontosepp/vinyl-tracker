# ADR-0017: Datenbank-Migrationen mit `sqlx::migrate` statt `refinery`

* **Status:** Accepted
* **Datum:** 2026-10-19
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#128](https://github.com/gerontosepp/vinyl-tracker/issues/128), OpenSpec-Change `128-sqlx-native-migrations`, löst den Migrations-Teil von [ADR-0001](0001-backend-migration-spring-boot-zu-rust-axum.md) ab

---

## Kontext & Problemstellung

Mit [ADR-0001](0001-backend-migration-spring-boot-zu-rust-axum.md) wurde `refinery` für Schema-Migrationen gewählt, weil es Flyway-kompatible Dateinamen (`V<n>__<name>.sql`) unterstützt und so den Übergang von Spring Boot erleichterte. Der Datenzugriff läuft jedoch vollständig über `sqlx`. Daraus ergab sich ein zweiter Stack:

* zwei PostgreSQL-Treiber (`sqlx`, `tokio-postgres`) und zwei Verbindungswege – der Migrationsweg verband fest mit `NoTls`,
* doppelte Retry-Logik und ~300 Zeilen Sonderlogik für die Übernahme von Flyway-/Hibernate-Altbeständen,
* kein Advisory-Lock: parallel startende Instanzen bzw. Integrationstests konnten gleichzeitig migrieren.

## Entscheidungstreiber

* **Wartbarkeit:** Ein Treiber, ein Verbindungsweg, weniger Abhängigkeiten.
* **Sicherheit:** Einheitliche TLS-Konfiguration für alle DB-Verbindungen.
* **Robustheit:** Schutz vor parallelen Migrationsläufen.
* **Kompatibilität:** Bestehende Datenbanken (refinery, Flyway, Hibernate ohne Historie) müssen ohne manuellen Eingriff weiterlaufen.

## Betrachtete Optionen

* **Option 1: `sqlx::migrate!` mit einmaliger Baseline-Übernahme (Gewählt)**
  * *Vorteile:* Bereits vorhandene Abhängigkeit (Feature `migrate`); Migrationen zur Compile-Zeit eingebettet; Advisory-Lock; Checksummen-Prüfung angewendeter Migrationen; läuft über den bestehenden Pool.
  * *Nachteile:* Dateien müssen umbenannt werden (`<n>_<name>.sql`); einmalige Übernahme der Historie nötig.

* **Option 2: `refinery` beibehalten, aber über `sqlx` ansteuern**
  * *Vorteile:* Keine Umbenennung.
  * *Nachteile:* `refinery` unterstützt `sqlx` nicht als Treiber; zweiter Treiber bliebe bestehen.

* **Option 3: Eigene `MigrationSource` für `V<n>__`-Dateinamen**
  * *Vorteile:* Flyway-Dateinamen blieben erhalten.
  * *Nachteile:* Eigener Loader-Code ohne fachlichen Mehrwert; die Flyway-Kompatibilität wird nach dem Abschluss der Java-Ablösung nicht mehr benötigt.

## Entscheidung

* Migrationen liegen als `backend/migrations/<n>_<beschreibung>.sql` vor und werden per `sqlx::migrate!("./migrations")` eingebettet (`backend/build.rs` erzwingt den Rebuild bei Änderungen). Historie: Tabelle `_sqlx_migrations`.
* `run_migrations(&PgPool)` legt unter einem eigenen Advisory-Lock `_sqlx_migrations` an und übernimmt – nur wenn diese leer ist – die bereits angewendeten Versionen aus `refinery_schema_history`, sonst `flyway_schema_history` (`success = true`), sonst per Schema-Heuristik. Übernommene Einträge erhalten die sqlx-Checksumme der Datei und `execution_time = 0`.
* Anschließend führt `sqlx` nur fehlende Migrationen aus.
* `refinery_schema_history` und `flyway_schema_history` bleiben unverändert erhalten.
* Der Verbindungs-Retry (`DATABASE_CONNECT_RETRIES`, `DATABASE_CONNECT_RETRY_INTERVAL_SECS`) liegt in `init_pool`.

## Konsequenzen

### Positive Effekte
* `refinery` und `tokio-postgres` entfallen; alle DB-Verbindungen nutzen denselben Pool und dieselbe TLS-Konfiguration.
* Parallele Migrationsläufe sind sicher (getestet mit drei gleichzeitigen Läufen auf einer frischen Datenbank).
* Nachträglich veränderte, bereits angewendete Migrationsdateien werden beim Start erkannt (Checksummen-Fehler).

### Nachteile & Risiken
* **Namenskonvention:** Neue Migrationen heißen `<n>_<beschreibung>.sql` (nächste: `10_…`), nicht mehr `V<n>__…`.
* **Rollback:** Ein Rückschritt auf eine Version mit `refinery` ist möglich, solange keine neue Migration (ab `10_…`) hinzugekommen ist – diese wäre nur in `_sqlx_migrations` erfasst.
* **Unveränderlichkeit:** Bereits ausgelieferte Migrationsdateien dürfen nicht mehr editiert werden (auch keine Kommentare), sonst bricht der Start mit einem Checksummen-Fehler ab.
