## ADDED Requirements

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
