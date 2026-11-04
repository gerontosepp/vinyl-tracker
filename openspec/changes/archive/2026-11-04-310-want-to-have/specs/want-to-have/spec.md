## ADDED Requirements

### Requirement: Platten vormerken
Das Backend MUST über `POST /api/want-to-have` eine Platte per Discogs-Release-ID für den angemeldeten Nutzer vormerken und dabei Artist, Titel, Jahr, Format, Genres und Cover aus Discogs speichern. Ist die Platte bereits im Bestand des Nutzers oder bereits vorgemerkt, MUST das Backend mit 409 als ProblemDetail antworten und keinen Eintrag anlegen. Eine unbekannte Discogs-ID MUST mit 404 beantwortet werden.

#### Scenario: Neue Platte vormerken
- **WHEN** der Nutzer eine Discogs-Release-ID vormerkt, die weder im Bestand noch in Want-to-Have ist
- **THEN** antwortet das Backend mit 201 und dem gespeicherten Eintrag inklusive Zeitpunkt (UTC)

#### Scenario: Bereits im Bestand
- **WHEN** die Release-ID bereits im Bestand des Nutzers liegt
- **THEN** antwortet das Backend mit 409 und legt keinen Eintrag an

#### Scenario: Bereits vorgemerkt
- **WHEN** die Release-ID bereits in Want-to-Have des Nutzers liegt
- **THEN** antwortet das Backend mit 409 und legt keinen zweiten Eintrag an

### Requirement: Want-to-Have-Liste
Das Backend MUST über `GET /api/want-to-have` die vorgemerkten Platten des Nutzers liefern, neueste zuerst; Platten, die der Nutzer inzwischen besitzt (auf anderem Weg hinzugefügt), MUST ausgelassen werden. Nutzer MUST nur eigene Einträge sehen und ändern können; fremde Einträge MUST mit 404 beantwortet werden.

#### Scenario: Eigene Liste
- **WHEN** zwei Nutzer je eine Platte vorgemerkt haben und Nutzer A die Liste abruft
- **THEN** enthält die Antwort nur die Platte von Nutzer A

#### Scenario: Fremder Eintrag
- **WHEN** Nutzer A einen Eintrag von Nutzer B entfernt oder übernimmt
- **THEN** antwortet das Backend mit 404

### Requirement: Entfernen aus Want-to-Have
Das Backend MUST über `DELETE /api/want-to-have/{id}` einen Eintrag des Nutzers löschen.

#### Scenario: Eintrag entfernen
- **WHEN** der Nutzer in der Detailansicht „Aus Want-to-Have entfernen“ wählt
- **THEN** verschwindet der Eintrag aus der Liste und das Backend antwortet mit 204

### Requirement: In Bestand übernehmen
Das Backend MUST über `POST /api/want-to-have/{id}/to-collection` die Platte zum Bestand hinzufügen (wie das reguläre Hinzufügen per Discogs-ID) und danach den Want-to-Have-Eintrag löschen. Der Eintrag MUST zuerst atomar beansprucht werden, sodass ein wiederholter oder paralleler Aufruf keine zweite Kopie anlegt (404 beim zweiten Aufruf); besitzt der Nutzer die Platte bereits, MUST keine weitere Kopie hinzugefügt werden. Schlägt das Hinzufügen fehl, MUST der Eintrag erhalten bleiben.

#### Scenario: Übernahme
- **WHEN** der Nutzer „In Bestand übernehmen“ wählt
- **THEN** liegt die Platte im Bestand, der Eintrag ist aus Want-to-Have verschwunden und die PWA zeigt eine Bestätigung

#### Scenario: Discogs nicht erreichbar
- **WHEN** das Hinzufügen zum Bestand fehlschlägt
- **THEN** bleibt der Eintrag in Want-to-Have und die PWA zeigt einen Fehler-Toast

### Requirement: Want-to-Have in der PWA
Die PWA MUST unter `/want-to-have` (eigener Menüpunkt) die vorgemerkten Platten im Stil der Sammlung anzeigen. Die Detailansicht MUST Cover, Artist, Titel, Jahr, Format, Genres und Tracklist zeigen und DARF NICHT „Ich höre gerade“, Geschätzter Wert, Plays, Lagerplatz, Zustand oder Sortierung anbieten. Sie MUST „In Bestand übernehmen“ und „Aus Want-to-Have entfernen“ anbieten sowie die Roon-Zonenauswahl und den Abspielen-Button. Alle Texte MUST in Deutsch und Englisch vorliegen.

#### Scenario: Detailansicht
- **WHEN** der Nutzer einen Want-to-Have-Eintrag öffnet
- **THEN** fehlen die Bestandsfelder und die Aktionen „In Bestand übernehmen“, „Aus Want-to-Have entfernen“ und „Abspielen“ sind sichtbar

#### Scenario: Leere Liste
- **WHEN** nichts vorgemerkt ist
- **THEN** zeigt die Seite einen Leer-Zustand mit Hinweis auf Label-Erkennung und Suche

### Requirement: Roon-Wiedergabe ohne Listen-Logging
Die PWA MUST Platten aus Want-to-Have über `POST /api/roon/play` mit Artist, Titel und optionaler Zone abspielen. Dabei MUST KEIN Hör-Event geloggt werden; Plays, „zuletzt gehört“ und Statistiken bleiben unverändert.

#### Scenario: Abspielen
- **WHEN** der Nutzer in Want-to-Have „Abspielen“ wählt
- **THEN** startet Roon die Wiedergabe auf der gewählten Zone und es entsteht kein Eintrag im Hörverlauf

### Requirement: Vormerken aus Erkennung und Suche
Die PWA MUST im Ergebnis der Label-Erkennung und bei Treffern der Discogs-Suche „Zu Want-to-Have“ anbieten. Ist die Platte bereits im Bestand oder vorgemerkt, MUST statt des Buttons der Hinweis „Bereits im Bestand“ bzw. „Schon vorgemerkt“ erscheinen.

#### Scenario: Aus der Erkennung vormerken
- **WHEN** der Nutzer bei einem erkannten Label „Zu Want-to-Have“ wählt
- **THEN** bestätigt ein Toast das Vormerken und der Button wird durch „Schon vorgemerkt“ ersetzt

#### Scenario: Bereits im Bestand
- **WHEN** ein Suchtreffer bereits im Bestand liegt
- **THEN** zeigt die Karte „Bereits im Bestand“ statt des Buttons
