# Proposal: Sammlung aus JSON-Backup wiederherstellen (#102)

## Why
Seit #42 kann die Sammlung als JSON-Backup exportiert werden, es gibt aber keinen Weg zurück: Ein Backup lässt sich in der Web-App nicht wieder einspielen. Außerdem enthält das Backup nur `listen_count` und `last_played_at` pro Platte – die Hör-Historie (einzelne Hör-Events mit Zeitstempel) geht bei einer Wiederherstellung verloren, obwohl die Spezifikation ein vollständiges Disaster-Recovery-Backup verlangt.

## What Changes
1. **JSON-Backup, Format-Version 2** (`GET /api/collection/export?format=json`):
   - Neues Top-Level-Feld `format_version: 2`.
   - Jede Platte erhält zusätzlich `listen_history`: alle Hör-Zeitstempel des Nutzers für diese Platte (UTC, RFC 3339 mit Mikrosekunden, aufsteigend).
   - Alle bisherigen Felder bleiben unverändert (abwärtskompatibel für Leser).
2. **Neuer Endpunkt `POST /api/collection/restore`** (JSON-Body = Backup-Datei):
   - Zusammenführen statt Ersetzen: es wird nichts gelöscht, mehrfaches Einspielen ist idempotent.
   - `record_cache`: fehlende Platten werden angelegt; bei vorhandenen Platten werden nur leere Felder (Cover, Jahr, Format, Preise, Genres) ergänzt – der Cache wird von allen Nutzern geteilt und ist i. d. R. aktueller als das Backup.
   - `collection_item`: Upsert über `(user_id, instance_id)`; Zustände (`media_condition`, `sleeve_condition`) aus dem Backup überschreiben vorhandene Werte, leere Backup-Werte überschreiben nichts; `added_at` bleibt bei vorhandenen Einträgen erhalten.
   - `listen_event`: Hör-Events aus `listen_history` werden angelegt, sofern für Nutzer, Platte und Zeitstempel (mikrosekundengenau, wie exportiert) noch keines existiert.
   - Alte Backups (ohne `listen_history`) stellen Sammlung und Zustände wieder her, aber keine Hörzähler; die Antwort meldet das (`listen_history_included: false`).
   - Validierung mit RFC 7807 Problem Details (400) bei ungültigem JSON oder ungültigen Einträgen; alles läuft in einer Transaktion (alles oder nichts).
   - Body-Limit für diesen Endpunkt 25 MB, Zeitlimit wie Export (Long-Running).
3. **Frontend** (Einstellungen → Datenverwaltung):
   - Button „Backup wiederherstellen (JSON)“ mit Dateiauswahl (`.json`), Bestätigungsdialog mit Anzahl der Platten, Ladeindikator, Ergebnis-Toast; DE/EN.
4. **Nicht im Umfang**: MCP-Tool für die Wiederherstellung, Modus „Ersetzen“, Wiederherstellung von CSV/PDF.
