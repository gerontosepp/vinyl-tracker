## MODIFIED Requirements

### Requirement: Want-to-Have in der PWA
Die PWA MUST unter `/want-to-have` (eigener Menüpunkt) die vorgemerkten Platten im Stil der Sammlung anzeigen. Die Detailansicht MUST Cover, Artist, Titel, Jahr, Format, Genres und Tracklist zeigen und DARF NICHT „Ich höre gerade“, Geschätzter Wert, Plays, Lagerplatz, Zustand oder Sortierung anbieten. Sie MUST „In Bestand übernehmen“ und „Aus Want-to-Have entfernen“ anbieten sowie die Roon-Zonenauswahl und den Abspielen-Button und den Abschnitt „Bezugsquellen“ (siehe dort). Angebotspreise der Bezugsquellen gelten nicht als „Geschätzter Wert“. Alle Texte MUST in Deutsch und Englisch vorliegen.

#### Scenario: Detailansicht
- **WHEN** der Nutzer einen Want-to-Have-Eintrag öffnet
- **THEN** fehlen die Bestandsfelder und die Aktionen „In Bestand übernehmen“, „Aus Want-to-Have entfernen“ und „Abspielen“ sowie der Abschnitt „Bezugsquellen“ sind sichtbar

#### Scenario: Leere Liste
- **WHEN** nichts vorgemerkt ist
- **THEN** zeigt die Seite einen Leer-Zustand mit Hinweis auf Label-Erkennung und Suche

### Requirement: Zugriff per MCP
Die Want-to-Have-Liste MUST über die MCP-Tools `get_want_to_have`, `add_to_want_to_have`, `remove_from_want_to_have` und `get_want_to_have_sources` les- und pflegbar bzw. abfragbar sein (Details im MCP-Spec, „Want-to-Have per MCP“ und „Bezugsquellen per MCP“). Roon-Wiedergabe loggt auch hier kein Hören.

#### Scenario: Vormerken per Assistent
- **WHEN** ein Assistent `add_to_want_to_have` mit einer Discogs-ID aufruft
- **THEN** erscheint die Platte in der Want-to-Have-Liste der PWA und nicht in der Sammlung

## ADDED Requirements

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
