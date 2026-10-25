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

### Requirement: Manuelle Platten anlegen und verwalten
Der Nutzer MUST Platten und CDs ohne Discogs-Eintrag manuell anlegen können (Pflicht: Künstler, Titel, Format; optional u. a. Jahr, Label, Katalognummer, Land, Barcode, Genres, Zustand, Notizen, eigener Wert, Cover). Manuelle Platten MUST in Sammlung, Regal, Statistik, Backup und Druck erscheinen und als „Manuell“ gekennzeichnet sein.

#### Scenario: Anlegen aus der Label-Inbox
- **WHEN** die Erkennung eines Label-Fotos keinen Discogs-Treffer findet
- **THEN** bietet die Inbox „Manuell anlegen“ an, mit aus dem Label gelesenen Feldern vorausgefüllt

#### Scenario: Anlegen mit Cover
- **WHEN** der Nutzer eine manuelle Platte mit Cover-Foto speichert
- **THEN** erscheint sie mit Cover und Badge „Manuell“ in der Sammlung und der Regalplatz wird angezeigt

### Requirement: Discogs-Sync schützt manuelle Platten
Der Discogs-Sync MUST manuelle Platten unverändert lassen, und für manuelle Platten MUST keine Discogs-Schnittstelle aufgerufen werden.

#### Scenario: Sync nach dem Anlegen
- **WHEN** nach dem Anlegen einer manuellen Platte der Discogs-Sync läuft
- **THEN** ist die manuelle Platte weiterhin in der Sammlung

### Requirement: Manuelle Platten per Scanner
Barcode und QR-Code einer manuellen Platte MUST lokal aufgelöst werden und ein Hör-Ereignis erfassen.

#### Scenario: Barcode einer manuellen Platte scannen
- **WHEN** der Nutzer den hinterlegten Barcode einer manuellen Platte scannt
- **THEN** wird die Platte ohne Discogs-Abfrage gefunden und als gehört erfasst

### Requirement: Backup mit manuellen Platten
Das JSON-Backup MUST manuelle Platten inklusive Cover enthalten (`format_version: 4`), und die Wiederherstellung MUST sie anhand von `manualUid` ohne Duplikate zusammenführen.

#### Scenario: Backup wiederherstellen
- **WHEN** ein Backup mit manuellen Platten in eine Instanz eingespielt wird, die diese bereits enthält
- **THEN** werden die vorhandenen Einträge aktualisiert und keine doppelt angelegt

### Requirement: Manuelle Platte bei Discogs prüfen
Die Detailansicht einer manuellen Platte MUST die Aktion „Bei Discogs prüfen“ anbieten. Die Prüfung MUST nach Barcode, nach Katalognummer + Label und nach Künstler + Titel suchen, soweit diese Felder gesetzt sind, und die Treffer ohne Duplikate als Kandidaten liefern. Jeder Kandidat MUST anzeigen, ob der Release bereits als Discogs-Exemplar in der Sammlung des Nutzers ist. Die Prüfung MUST nichts verändern.

#### Scenario: Kandidaten gefunden
- **WHEN** der Nutzer bei einer manuellen Platte mit Barcode „Bei Discogs prüfen“ wählt und Discogs den Barcode kennt
- **THEN** werden die passenden Releases mit Cover, Label, Katalognummer, Land und Jahr als Kandidaten angezeigt

#### Scenario: Kein Treffer
- **WHEN** keine der Suchen einen Treffer liefert
- **THEN** meldet die App „Kein Treffer bei Discogs“ und die Platte bleibt unverändert manuell

#### Scenario: Ohne Discogs-Token
- **WHEN** der Nutzer keinen Discogs-Token hinterlegt hat
- **THEN** antwortet das Backend mit 400 und die App weist auf die fehlende Discogs-Verbindung hin

#### Scenario: Keine manuelle Platte
- **WHEN** die Prüfung für eine Discogs-Platte oder eine fremde manuelle Platte aufgerufen wird
- **THEN** antwortet das Backend mit 404

### Requirement: Manuelle Platte nach Bestätigung übernehmen
Eine manuelle Platte MUST nur nach ausdrücklicher Bestätigung eines Kandidaten zur Discogs-Platte werden. Bei der Übernahme als neues Exemplar MUST der Release der Discogs-Sammlung hinzugefügt werden, und die Platte MUST danach `source = discogs` mit echter Release- und Exemplar-ID haben. Hör-Historie, Regalplatz, Zustände und eigener Sortier-String MUST erhalten bleiben. Schlägt ein Schritt fehl, MUST die Platte unverändert manuell bleiben.

#### Scenario: Übernahme als neues Exemplar
- **WHEN** der Nutzer einen Kandidaten wählt und die Übernahme bestätigt
- **THEN** ist der Release in der Discogs-Sammlung, die Platte erscheint ohne Badge „Manuell“ mit Discogs-Daten, und ihre Hör-Ereignisse, Zustände und ihr Sortier-String sind unverändert

#### Scenario: Regalplatz bleibt erhalten
- **WHEN** eine manuelle Platte, die eine Fachgrenze im Regal bildet, übernommen wird
- **THEN** zeigt die Fachgrenze danach auf das neue Exemplar und die Platte steht im selben Fach

#### Scenario: Discogs lehnt das Hinzufügen ab
- **WHEN** das Hinzufügen zur Discogs-Sammlung fehlschlägt
- **THEN** meldet die App den Fehler und die Platte bleibt manuell mit allen Daten

#### Scenario: Discogs-Sync nach der Übernahme
- **WHEN** nach der Übernahme der Discogs-Sync läuft
- **THEN** gibt es die Platte genau einmal in der Sammlung

### Requirement: Cover und Wert nach der Übernahme
Nach der Übernahme MUST das eigene Cover gelöscht und das Discogs-Bild angezeigt werden. Der eigene Wert MUST entfallen und durch den Discogs-Preis ersetzt werden: Die Übernahme MUST den Preis des Releases abfragen; liefert Discogs keinen, MUST der Preis-Refresh ihn später nachtragen.

#### Scenario: Eigenes Cover entfällt
- **WHEN** eine manuelle Platte mit eigenem Cover übernommen wird
- **THEN** zeigt die Sammlung das Discogs-Bild und die öffentliche Cover-URL der manuellen Platte antwortet mit 404

#### Scenario: Wert wird ersetzt
- **WHEN** eine manuelle Platte mit eigenem Wert übernommen wird und Discogs für den Release einen Preis kennt
- **THEN** trägt die Platte danach den Discogs-Preis und der eigene Wert zählt nicht mehr zum Sammlungswert

### Requirement: Übernahme bei vorhandenem Discogs-Exemplar
Ist der gewählte Release bereits als Discogs-Exemplar in der Sammlung, MUST die Bestätigung die Wahl zwischen „Zweites Exemplar“ (Standard) und „Zusammenführen“ anbieten. Beim Zusammenführen MUST die Hör-Historie zum gewählten vorhandenen Exemplar wandern, die manuelle Platte MUST gelöscht werden, und bei Discogs MUST nichts hinzugefügt werden.

#### Scenario: Zweites Exemplar
- **WHEN** der Release schon in der Sammlung ist und der Nutzer mit „Zweites Exemplar“ bestätigt
- **THEN** wird bei Discogs ein weiteres Exemplar angelegt und die Sammlung enthält zwei Exemplare des Releases

#### Scenario: Zusammenführen
- **WHEN** der Release schon in der Sammlung ist und der Nutzer mit „Zusammenführen“ bestätigt
- **THEN** enthält die Sammlung nur noch das vorhandene Exemplar, dessen Hör-Historie um die Hör-Ereignisse der manuellen Platte ergänzt ist, und die Discogs-Sammlung ist unverändert

#### Scenario: Zusammenführen ohne vorhandenes Exemplar
- **WHEN** „Zusammenführen“ für einen Release angefordert wird, der nicht in der Sammlung ist
- **THEN** antwortet das Backend mit 400 und nichts wird verändert

### Requirement: Alte IDs übernommener Platten auflösen
Die negative ID einer übernommenen oder zusammengeführten Platte MUST für den Nutzer weiter auf das Exemplar verweisen, zu dem sie wurde. QR-Codes `discogs-id:-n` MUST darüber aufgelöst werden und ein Hör-Ereignis erfassen. Die Zuordnung MUST im JSON-Backup enthalten sein und bei der Wiederherstellung übernommen werden.

#### Scenario: Altes QR-Etikett scannen
- **WHEN** der Nutzer nach der Übernahme das gedruckte Etikett `discogs-id:-7` der früheren manuellen Platte scannt
- **THEN** wird das übernommene Exemplar gefunden und als gehört erfasst

#### Scenario: Etikett einer zusammengeführten Platte
- **WHEN** der Nutzer das Etikett einer zusammengeführten manuellen Platte scannt
- **THEN** wird das vorhandene Exemplar gefunden, in das sie zusammengeführt wurde

#### Scenario: Älteres Backup nach der Übernahme einspielen
- **WHEN** ein Backup von vor der Übernahme eingespielt wird, das die Platte noch als manuelle Platte enthält
- **THEN** wird keine manuelle Platte neu angelegt; ihre Hör-Ereignisse kommen zum übernommenen Exemplar, dessen Daten unverändert bleiben

### Requirement: Manuelle Platte bei Discogs eintragen
Die Detailansicht einer manuellen Platte MUST einen Link zum Discogs-Formular „Add Release“ anbieten sowie die Daten der Platte (Künstler, Titel, Format, Jahr, Label, Katalognummer, Land, Barcode, Notizen) als kopierbaren Text.

#### Scenario: Daten kopieren
- **WHEN** der Nutzer „Bei Discogs eintragen“ wählt
- **THEN** öffnet sich das Discogs-Formular in einem neuen Tab und die Daten der Platte lassen sich mit einem Klick in die Zwischenablage kopieren
