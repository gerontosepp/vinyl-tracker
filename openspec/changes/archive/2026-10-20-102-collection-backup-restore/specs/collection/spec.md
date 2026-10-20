# Delta-Spezifikation: Sammlungs-Verwaltung (Collection)

## ADDED Requirements

### Requirement: JSON-Backup mit Hör-Historie
Das JSON-Backup (`GET /api/collection/export?format=json`) MUST `format_version: 2` und pro Platte die vollständige Hör-Historie des Nutzers (`listen_history`, UTC-Zeitstempel aufsteigend) enthalten.

#### Scenario: Backup exportieren
- **WHEN** der Nutzer ein JSON-Backup herunterlädt
- **THEN** enthält jede Platte neben `listen_count` und `last_played_at` alle Hör-Zeitstempel in `listen_history`.

### Requirement: Sammlung aus JSON-Backup wiederherstellen
Das System MUST ein JSON-Backup über `POST /api/collection/restore` zusammenführend und idempotent wiederherstellen, ohne vorhandene Daten zu löschen.

#### Scenario: Backup in leere Sammlung einspielen
- **GIVEN** die Sammlung des Nutzers ist leer
- **WHEN** der Nutzer ein Backup im Format-Version 2 einspielt
- **THEN** sind Platten, Zustände, Aufnahmedatum und Hör-Historie wie im Backup vorhanden.

#### Scenario: Backup erneut einspielen
- **WHEN** dasselbe Backup ein zweites Mal eingespielt wird
- **THEN** entstehen keine doppelten Platten oder Hör-Events (`listens_added = 0`).

#### Scenario: Zustände zusammenführen
- **GIVEN** eine Platte existiert bereits mit anderen Zuständen
- **WHEN** das Backup einen Zustand enthält
- **THEN** übernimmt das System den Zustand aus dem Backup; fehlt er im Backup, bleibt der vorhandene Wert erhalten.

#### Scenario: Altes Backup ohne Hör-Historie
- **WHEN** ein Backup ohne `listen_history` eingespielt wird
- **THEN** werden Sammlung und Zustände wiederhergestellt, keine Hör-Events angelegt und `listen_history_included: false` gemeldet.

#### Scenario: Ungültiges Backup
- **WHEN** die Datei kein gültiges Backup ist oder ein Eintrag ungültig ist (z. B. fehlende ID, ungültiger Zeitstempel)
- **THEN** antwortet das System mit 400 und RFC-7807-Problem-Details, und die Datenbank bleibt unverändert.

### Requirement: Wiederherstellung in den Einstellungen
Die Einstellungen MUST unter „Datenverwaltung“ das Einspielen eines JSON-Backups mit Dateiauswahl, Bestätigung und Ergebnis-Rückmeldung (DE/EN) anbieten.

#### Scenario: Backup über die Einstellungen einspielen
- **WHEN** der Nutzer eine `.json`-Datei auswählt und die Bestätigung mit der Plattenanzahl akzeptiert
- **THEN** wird das Backup eingespielt und ein Toast meldet die Anzahl wiederhergestellter Platten und Hör-Events.
