# Spezifikation: Sammlungs-Verwaltung (Collection)

## Purpose
Die Sammlungs-Verwaltung bildet das funktionale Herzstück von Vinyl Tracker. Sie ermöglicht das Erfassen, Organisieren, Sortieren, Exportieren und Protokollieren physischer Schallplatten (Vinyl Releases) und zugehöriger Abspielvorgänge.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 Datenmodell & Entitäten
* **`records` (Tonträger)**:
  - Pflichtfelder: `id` (UUID/Integer), `title` (Titel), `artist` (Künstler), `release_year` (Erscheinungsjahr), `discogs_id` (eindeutige Discogs-Release-ID).
  - Zusätzliche Metadaten: `format` (z. B. LP, 2xLP, 7", 12"), `genres` & `styles` (JSON-Array), `label`, `catalog_number`, `cover_image_url`.
  - Zustandsbewertung: `media_condition` und `sleeve_condition` (Goldmine-Notation: M, NM, VG+, VG, G+, G, F, P).
  - Zeitstempel: `created_at`, `updated_at`, `last_played_at` (jeweils strikt in UTC).
* **`listen_events` (Hör-Protokoll)**:
  - Pflichtfelder: `id`, `record_id`, `played_at` (UTC).

### 2.2 Natürliche Kallax-Sortierung (Regal-Collation)
* Schallplatten müssen für die physische Regalablage (z. B. IKEA Kallax) nach Künstlernamen sortiert werden können:
  - Führende Artikel in gängigen Sprachen (`The `, `Die `, `Der `, `Das `, `A `, `An `, `Les `, `Le `, `La `) werden bei der Indexierung/Sortierung ignoriert (z. B. "The Beatles" sortiert unter "Beatles, The").
  - Deutsche Umlaute und Akzente werden normalisiert (`ä` -> `ae` oder Basisvokal `a`).
  - Sonderzeichen und Satzzeichen werden für den Sortierschlüssel bereinigt.

### 2.3 Sammlungs-Export & Backup
* **CSV-Export**: Tabellarische Übersicht aller erfassten Platten mit Kernmetadaten und Zuständen.
* **JSON-Backup**: Vollständiges Disaster-Recovery-Backup mit allen Relationen, Zeitstempeln und benutzerdefinierten Notizen.
* **Vektor-PDF-Export**: Druckfertige Inventarliste mit Alben-Covern und scannbaren QR-Codes (vektorbasiert via `printpdf`).

### 2.4 Hör-Historie & Statistiken
* Manuelles Protokollieren via Dashboard, MCP-Tool (`log_record_listen`) oder nach erfolgreichem Barcode-Scan.
* Automatische Aktualisierung des Feldes `last_played_at` auf den aktuellen UTC-Zeitstempel.
* Dashboard-Metriken: Zuletzt gehörte Alben, ungespielte Platten (*Shelf Warmers*), Top-Künstler und Genre-Verteilung.

---

## Requirements

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

### Requirement: Eigener Sortier-String pro Platte
Der Nutzer MUST für eine Platte seiner Sammlung einen eigenen Sortier-String festlegen können (`PATCH /api/records/{id}/sort-key`, max. 200 Zeichen). Ist er gesetzt, MUST er bei der Künstler-Sortierung der Sammlung und bei der Regalbelegung anstelle des automatischen Künstler-Schlüssels (Künstler ohne führenden Artikel) verwendet werden, ohne Beachtung der Groß-/Kleinschreibung; Jahr und Titel bleiben nachrangige Kriterien. Der Wert MUST für alle Exemplare des Releases gelten, in den Album-Details (`sort_key`, `default_sort_key`) erscheinen und im JSON-Backup enthalten sein.

#### Scenario: Sortier-String setzen
- **WHEN** der Nutzer für *Les Paul – The Hit Makers!* den Sortier-String „Les Paul“ speichert
- **THEN** steht die Platte in der Künstler-Sortierung unter **L** statt unter **P**

#### Scenario: Sortier-String zurücksetzen
- **WHEN** der Nutzer den Sortier-String leert
- **THEN** wird wieder der automatische Schlüssel verwendet und `sort_key` ist `null`

#### Scenario: Platte nicht in der Sammlung
- **WHEN** der Sortier-String für eine Platte gesetzt wird, die nicht in der Sammlung ist
- **THEN** antwortet das Backend mit 404
