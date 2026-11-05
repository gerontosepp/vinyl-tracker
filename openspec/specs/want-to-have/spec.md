# want-to-have Specification

## Purpose
Platten, die der Nutzer erst anhören möchte (z. B. per Label-Erkennung oder Scan gefunden), werden in einer Want-to-Have-Liste vorgemerkt, über Roon abgespielt (ohne Hör-Event) und bei Bedarf in den Bestand übernommen oder entfernt.

## Requirements

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
Die PWA MUST unter `/want-to-have` (eigener Menüpunkt) die vorgemerkten Platten im Stil der Sammlung anzeigen. Die Detailansicht MUST Cover, Artist, Titel, Jahr, Format, Genres und Tracklist zeigen und DARF NICHT „Ich höre gerade“, Geschätzter Wert, Plays, Lagerplatz, Zustand oder Sortierung anbieten. Sie MUST „In Bestand übernehmen“ und „Aus Want-to-Have entfernen“ anbieten sowie die Roon-Zonenauswahl und den Abspielen-Button und den Abschnitt „Bezugsquellen“ (siehe dort). Angebotspreise der Bezugsquellen gelten nicht als „Geschätzter Wert“. Alle Texte MUST in Deutsch und Englisch vorliegen.

#### Scenario: Detailansicht
- **WHEN** der Nutzer einen Want-to-Have-Eintrag öffnet
- **THEN** fehlen die Bestandsfelder und die Aktionen „In Bestand übernehmen“, „Aus Want-to-Have entfernen“ und „Abspielen“ sowie der Abschnitt „Bezugsquellen“ sind sichtbar

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

### Requirement: Zugriff per MCP
Die Want-to-Have-Liste MUST über die MCP-Tools `get_want_to_have`, `add_to_want_to_have`, `remove_from_want_to_have` und `get_want_to_have_sources` les- und pflegbar bzw. abfragbar sein (Details im MCP-Spec, „Want-to-Have per MCP“ und „Bezugsquellen per MCP“). Roon-Wiedergabe loggt auch hier kein Hören.

#### Scenario: Vormerken per Assistent
- **WHEN** ein Assistent `add_to_want_to_have` mit einer Discogs-ID aufruft
- **THEN** erscheint die Platte in der Want-to-Have-Liste der PWA und nicht in der Sammlung

### Requirement: Bezugsquellen abrufen
Das Backend MUST über `GET /api/want-to-have/{id}/sources` für einen Eintrag des Nutzers alle Vinyl-Versionen des Discogs-Masters liefern (höchstens 300, nach Erscheinungsdatum; `total_versions` und `truncated` geben die Kürzung an), die vorgemerkte Version zuerst und mit `is_wanted`. Jede Version MUST Release-ID, Titel, Label, Katalognummer, Land, Erscheinungsdatum, Format, Link zum Discogs-Marktplatz und optional `stats` (günstigster Preis in EUR, Anzahl Angebote, `blocked_from_sale`) enthalten. `stats` MUST nur für die ersten 5 Versionen und nur gefüllt werden, wenn das Discogs-Limit dies ohne Wartezeit erlaubt; sonst ist es `null`. Hat die Platte keinen Master (oder existiert er nicht mehr), MUST die Antwort nur die vorgemerkte Release enthalten. Die Antwort MUST Suchlinks zu Shops (Discogs, eBay, Amazon, JPC, HHV) enthalten. Fremde oder unbekannte Einträge MUST mit 404, fehlendes Discogs-Token mit 400 und ein erreichtes Discogs-Limit mit 429 als ProblemDetail beantwortet werden. Ergebnisse MUST gecacht werden (Versionen 24 h, Kennzahlen 1 h).

#### Scenario: Platte mit Master
- **WHEN** der Nutzer die Bezugsquellen eines Eintrags abruft, dessen Release zu einem Master mit 8 Vinyl-Versionen gehört
- **THEN** enthält die Antwort 8 Versionen, die vorgemerkte steht an erster Stelle mit `is_wanted` und nur die ersten 5 haben `stats`

#### Scenario: Platte ohne Master
- **WHEN** die Release keinen Master hat
- **THEN** enthält die Antwort nur die vorgemerkte Version

#### Scenario: Fremder Eintrag
- **WHEN** Nutzer A die Bezugsquellen eines Eintrags von Nutzer B abruft
- **THEN** antwortet das Backend mit 404

### Requirement: Kennzahlen einer Version abrufen
Das Backend MUST über `GET /api/want-to-have/{id}/sources/{release_id}/stats` die Marktplatz-Kennzahlen einer einzelnen Version liefern. Als `release_id` MUST nur die vorgemerkte Release oder eine Vinyl-Version ihres Masters zugelassen sein; jede andere MUST mit 404 beantwortet werden, ohne Discogs nach Kennzahlen zu fragen.

#### Scenario: Kennzahlen nachladen
- **WHEN** der Nutzer die Kennzahlen einer Version aus der Versionsliste abruft
- **THEN** antwortet das Backend mit günstigstem Preis, Anzahl Angebote und `blocked_from_sale`

#### Scenario: Fremde Release
- **WHEN** die Release-ID nicht zu den Versionen des Masters gehört
- **THEN** antwortet das Backend mit 404

### Requirement: Bezugsquellen in der PWA
Die Detailansicht eines Want-to-Have-Eintrags MUST einen aufklappbaren Abschnitt „Bezugsquellen“ zeigen, der erst beim Aufklappen lädt. Er MUST die Shop-Suchlinks (in neuem Tab, `rel="noopener noreferrer"`) und die Versionen zeigen, die vorgemerkte hervorgehoben mit „Gesuchte Version“, je Version Label · Katalognummer · Land · Jahr · Format, „ab X €“ und Anzahl Angebote bzw. „Derzeit nicht im Angebot“ und einen Link zum Discogs-Marktplatz. Versionen ohne Kennzahlen MUST einen Button „Preis laden“ bieten. Zunächst MUST 10 Versionen angezeigt werden, die übrigen per „Alle n Versionen anzeigen“. Bei erreichtem Discogs-Limit MUST ein Hinweis mit „Erneut versuchen“ erscheinen. Der Abschnitt DARF NICHT in der Sammlungs-Detailansicht erscheinen. Alle Texte MUST in Deutsch und Englisch vorliegen.

#### Scenario: Aufklappen
- **WHEN** der Nutzer den Abschnitt „Bezugsquellen“ aufklappt
- **THEN** werden die Versionen geladen und mit Preisen und Shop-Links angezeigt

#### Scenario: Preis nachladen
- **WHEN** der Nutzer bei einer Version ohne Kennzahlen „Preis laden“ wählt
- **THEN** erscheinen günstigster Preis und Anzahl Angebote dieser Version

#### Scenario: Discogs-Limit
- **WHEN** Discogs das Limit meldet
- **THEN** zeigt der Abschnitt einen Hinweis mit „Erneut versuchen“, der Rest der Detailansicht funktioniert weiter
