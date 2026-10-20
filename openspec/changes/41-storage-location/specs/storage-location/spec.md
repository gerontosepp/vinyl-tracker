## ADDED Requirements

### Requirement: Lagertypen verwalten
Das System MUST pro Nutzer Lagertypen mit Name, Medium (`vinyl` oder `cd`), Zeilen, Spalten (je 1–12) und Kapazität pro Fach in Discs (1–500) speichern. Das Frontend MUST Vorlagen für Kallax 1×4, 2×2, 2×4, 4×4, 5×5 (Platten, vorbelegt mit 70 Discs pro Fach) und das IKEA-CD-Regal 12×1 (11 Discs pro Fach) anbieten.

#### Scenario: Lagertyp aus Vorlage anlegen
- **WHEN** der Nutzer die Vorlage „Kallax 2×4“ wählt und ohne Änderung speichert
- **THEN** existiert ein Lagertyp für Platten mit 2 Zeilen, 4 Spalten (8 Fächer) und 70 Discs pro Fach

#### Scenario: Ungültige Werte
- **WHEN** Zeilen, Spalten oder Kapazität außerhalb der erlaubten Bereiche liegen oder der Name leer ist
- **THEN** antwortet das System mit 400 und RFC-7807-Problem-Details

#### Scenario: Lagertyp in Benutzung
- **WHEN** der Nutzer einen Lagertyp löschen will, dem noch Regale zugeordnet sind
- **THEN** antwortet das System mit 409, und der Typ bleibt erhalten

### Requirement: Regale verwalten
Das System MUST pro Nutzer Regale mit Name (eindeutig je Nutzer), Lagertyp und Reihenfolge speichern. Das Medium eines Regals MUST das seines Lagertyps sein; die Reihenfolge MUST je Medium gelten und änderbar sein.

#### Scenario: Mehrere Regale anlegen
- **WHEN** der Nutzer „Kallax-1“ (Kallax 2×2) und danach „Kallax-2“ (Kallax 2×4) anlegt
- **THEN** stehen für Platten 12 Fächer zur Verfügung, zuerst die 4 von „Kallax-1“, dann die 8 von „Kallax-2“

#### Scenario: Reihenfolge ändern
- **WHEN** der Nutzer „Kallax-2“ vor „Kallax-1“ schiebt
- **THEN** werden die Fächer von „Kallax-2“ zuerst gefüllt

#### Scenario: Fremde Konfiguration
- **WHEN** ein Nutzer Lagertypen oder Regale eines anderen Nutzers lesen oder ändern will
- **THEN** antwortet das System mit 404

### Requirement: Gleichmäßig verteilen
„Neu verteilen“ MUST die Exemplare eines Mediums in Regal-Sortierung (Künstler A–Z ohne „The“, Jahr, Titel) auf alle Fächer aller Regale dieses Mediums verteilen, sodass jedes Fach etwa denselben Füllgrad im Verhältnis zu seiner Kapazität hat. Das System MUST danach die Fachgrenzen (Sortierschlüssel der ersten Platte je Fach) speichern.

#### Scenario: Verteilung über alle Regale
- **WHEN** 600 Discs auf „Kallax-1“ (4 Fächer) und „Kallax-2“ (8 Fächer) mit je 70 Plätzen neu verteilt werden
- **THEN** enthält jedes der 12 Fächer etwa 50 Discs, und jedes Fach hat Luft für neue Platten

#### Scenario: Zeilenweise Fächer
- **WHEN** ein Regal vom Typ 2×4 belegt wird
- **THEN** sind Fach 1–4 die obere Zeile von links nach rechts und Fach 5–8 die untere Zeile, und die Regale folgen in ihrer Reihenfolge

#### Scenario: Vorschau vor dem Verteilen
- **WHEN** der Nutzer „Neu verteilen“ wählt
- **THEN** zeigt das Frontend vor der Bestätigung, wie viele Platten ihr Fach wechseln würden

#### Scenario: Strukturänderung
- **WHEN** ein Regal eines Mediums hinzugefügt, entfernt, umsortiert oder sein Raster geändert wird
- **THEN** verteilt das System dieses Medium automatisch neu, und das Frontend weist darauf hin

#### Scenario: Erste Konfiguration
- **WHEN** für ein Medium das erste Regal angelegt wird
- **THEN** wird die Sammlung dieses Mediums sofort gleichmäßig verteilt

### Requirement: Einsortieren nach festen Grenzen
Das System MUST jedes Exemplar dem Fach zuordnen, in dessen gespeicherten Bereich sein Sortierschlüssel fällt. Ein Exemplar MUST so viele Plätze belegen, wie es Discs hat, und MUST NOT auf zwei Fächer verteilt werden. Neue oder entfernte Platten MUST NOT andere Platten verschieben, solange kein Fach überläuft.

#### Scenario: Platz im Zielfach
- **WHEN** eine neue Platte alphabetisch in Fach 5 fällt und Fach 5 noch Platz hat
- **THEN** liegt sie in Fach 5, und keine andere Platte wechselt ihr Fach

#### Scenario: Platte entfernt
- **WHEN** eine Platte aus der Sammlung entfernt wird
- **THEN** bleiben alle anderen Platten in ihren Fächern, und das Fach hat entsprechend mehr Luft

#### Scenario: Keine Regale für das Medium
- **WHEN** für CDs kein Regal angelegt ist
- **THEN** haben CDs keinen Lagerplatz, und die Oberfläche zeigt keinen Lagerplatz statt einer Fehlermeldung

### Requirement: Volles Fach ausgleichen
Überschreitet ein Fach seine Kapazität, MUST das System Randplatten in Richtung des nächstgelegenen Fachs mit ausreichend Platz verschieben (bei gleicher Entfernung mit weniger Verschiebungen, sonst nach rechts), die Fachgrenzen entsprechend anpassen und speichern. Ist kein Fach mit Platz vorhanden, MUST das System die überzähligen Exemplare am Ende der Sortierung als „ohne Platz“ führen.

#### Scenario: Ausgleich zum Nachbarn
- **WHEN** eine neue Platte in das volle Fach 5 fällt, Fach 6 voll ist und Fach 4 Platz hat
- **THEN** wandert die erste Platte aus Fach 5 nach Fach 4, die Grenze zwischen Fach 4 und 5 wird angepasst, und alle anderen Fächer bleiben unverändert

#### Scenario: Zu wenig Platz insgesamt
- **WHEN** die Sammlung eines Mediums mehr Discs enthält, als alle Regale fassen
- **THEN** gelten die überzähligen Exemplare als „ohne Platz“, und die Übersicht nennt ihre Anzahl

#### Scenario: Platte größer als ein Fach
- **WHEN** eine Box mehr Discs hat als die Kapazität eines Fachs
- **THEN** wird sie als „übergroß“ gekennzeichnet und zählt in ihrem Fach nur bis zur Kapazität, ohne Ausgleich auszulösen

#### Scenario: Änderungen außerhalb der App
- **WHEN** der Discogs-Sync neue Platten importiert
- **THEN** werden sie genauso einsortiert und volle Fächer ausgeglichen

### Requirement: Anzahl der Discs
Das System MUST pro Release die Anzahl der Discs des jeweiligen Mediums aus den Discogs-Formatangaben (Feld `qty`) speichern. Fehlen sie, MUST es 2 für Formate „Double LP“/„Double CD“ und sonst 1 annehmen.

#### Scenario: Box-Set
- **WHEN** ein Release laut Discogs das Format „Vinyl“ mit `qty` 5 hat
- **THEN** belegt jedes Exemplar 5 Plätze

### Requirement: Lagerplatz ausgeben
Das System MUST in den Sammlungseinträgen und in den Platten-Details den Lagerplatz (Regalname, Fachnummer, Zeile, Spalte) oder `null` ausgeben. Die Platten-Details MUST zusätzlich die Nachbarn im Regal (vorheriges und nächstes Exemplar) enthalten.

#### Scenario: Detail einer Platte
- **WHEN** der Nutzer die Details einer Platte abruft, die in „Kallax-1“, Fach 3 liegt
- **THEN** enthält die Antwort Regal „Kallax-1“, Fach 3, Zeile 1, Spalte 3 sowie Künstler und Titel der Nachbarn

### Requirement: Einsortier-Hinweis
Das System MUST über `GET /api/storage/placement/{discogsId}` für eine Platte der Sammlung ihren Lagerplatz, ihre Nachbarn und die Exemplare liefern, die beim Einsortieren dieser Platte durch den Ausgleich voller Fächer in ein anderes Fach wandern. Das Frontend MUST den Hinweis nach dem Hinzufügen einer Platte und auf Wunsch im Detail-Modal anzeigen.

#### Scenario: Neue Platte einsortieren
- **WHEN** der Nutzer eine Platte hinzufügt, die in das volle Fach 3 von „Kallax-2“ gehört, und Fach 4 Platz hat
- **THEN** zeigt das Frontend „Kallax-2 · Fach 3 (Zeile 1, Spalte 3), nach X, vor Y“ und dass die letzte Platte aus Fach 3 (Künstler – Titel) nach Fach 4 wandert

#### Scenario: Keine Verschiebung
- **WHEN** im Zielfach noch Platz ist
- **THEN** meldet der Hinweis, dass keine anderen Platten umgestellt werden müssen

#### Scenario: Kein Regal konfiguriert
- **WHEN** für das Medium der Platte kein Regal existiert
- **THEN** zeigt das Frontend nach dem Hinzufügen keinen Einsortier-Hinweis, sondern wie bisher nur die Erfolgsmeldung

### Requirement: Regal-Übersicht
Das System MUST über `GET /api/storage/layout` je Medium die Regale mit ihren Fächern (Belegung, Kapazität, Anzahl, erster und letzter Künstler) und die Anzahl der Exemplare ohne Platz liefern. Das Frontend MUST in der Sammlung eine Ansicht „Regale“ bieten, die jedes Regal als Raster mit Füllstand und Künstlerbereich je Fach darstellt und Lagertypen und Regale verwalten lässt (DE/EN).

#### Scenario: Übersicht ansehen
- **WHEN** der Nutzer in der Sammlung die Ansicht „Regale“ öffnet
- **THEN** sieht er „Kallax-1“ als 2×2-Raster, jedes Fach mit z. B. „Abba – Beatles“ und Füllstand „68 / 70“

#### Scenario: Regale verwalten
- **WHEN** Regale existieren und der Nutzer „Regale verwalten“ wählt
- **THEN** zeigt die Ansicht Lagertypen und Regale zum Anlegen, Bearbeiten, Umsortieren und Löschen; vor dem ersten Regal ist die Verwaltung direkt geöffnet

#### Scenario: Neu verteilen auslösen
- **WHEN** der Nutzer in der Übersicht eines Mediums „Neu verteilen“ wählt und die Vorschau bestätigt
- **THEN** werden die Fächer dieses Mediums gleichmäßig neu belegt und die Übersicht aktualisiert

#### Scenario: Fach öffnen
- **WHEN** der Nutzer in der Übersicht auf ein Fach klickt
- **THEN** öffnet sich die Sammlung gefiltert auf dieses Regal und Fach

### Requirement: Nach Lagerplatz filtern
`GET /api/collection` MUST die Filter `storage_unit` (Regal-ID oder `unplaced`) und optional `compartment` (Fachnummer) unterstützen und mit den übrigen Filtern kombinieren. Die Toolbar MUST diese Filter anbieten, wenn Regale konfiguriert sind.

#### Scenario: Fach filtern
- **WHEN** der Nutzer nach „Kallax-1“, Fach 2 filtert
- **THEN** enthält das Ergebnis genau die Exemplare, die laut Belegung in diesem Fach liegen

#### Scenario: Ohne Platz filtern
- **WHEN** der Nutzer „Ohne Platz“ wählt
- **THEN** enthält das Ergebnis die Exemplare ohne Platz, einschließlich der Exemplare eines Mediums ohne Regale

### Requirement: Lagerung im Backup
Der JSON-Export MUST Lagertypen sowie Regale mit ihren Fachgrenzen enthalten (Format-Version 3). Die Wiederherstellung MUST fehlende Lagertypen und Regale anhand des Namens anlegen und vorhandene unverändert lassen; Backups der Version 2 MUST weiterhin wiederhergestellt werden können.

#### Scenario: Konfiguration wiederherstellen
- **WHEN** ein Backup mit „Kallax-1“ in eine Installation ohne Regale eingespielt wird
- **THEN** existieren danach Lagertyp und Regal „Kallax-1“ mit gleicher Reihenfolge und denselben Fachgrenzen

#### Scenario: Vorhandene Regale
- **WHEN** die Installation bereits Regale für das Medium hat
- **THEN** bleiben deren Fachgrenzen unverändert, fehlende Regale werden ohne Grenzen hinten angefügt

### Requirement: Lagerung über MCP
Der MCP-Server MUST den Lagerplatz in `get_user_collection` ausgeben und die Tools `get_record_placement` (Lagerplatz, Nachbarn und Verschiebungen zu einer Discogs-ID) und `get_storage_layout` (Regal-Übersicht) bereitstellen.

#### Scenario: Wohin mit der neuen Platte
- **WHEN** ein MCP-Client `get_record_placement` mit der Discogs-ID einer gerade hinzugefügten Platte aufruft
- **THEN** erhält er Regal, Fach und Nachbarn; die nötigen Verschiebungen nennt bereits `add_to_collection`
