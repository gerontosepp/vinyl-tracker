# listening-statistics Specification

## Purpose
TBD - created by archiving change 178-top-artists. Update Purpose after archive.

## Requirements

### Requirement: Meistgespielte Interpreten
`GET /api/analytics/top-artists` (optional `from`, `to` wie `/api/analytics/top`) MUST die bis zu 10 Interpreten mit den meisten Hördurchgängen des Nutzers im Zeitraum liefern, absteigend nach Anzahl. Jeder Eintrag MUST Interpret, Hördurchgänge, Anzahl gehörter Releases und bis zu 4 Cover-URLs der meistgehörten Releases enthalten.

#### Scenario: Interpreten über mehrere Alben
- **WHEN** der Nutzer im Zeitraum 3× „Abbey Road“ und 2× „Help!“ der Beatles sowie 4× „Kind of Blue“ von Miles Davis gehört hat
- **THEN** steht „The Beatles“ mit 5 Hördurchgängen und 2 Releases vor „Miles Davis“ mit 4 und 1, und das erste Cover der Beatles ist das von „Abbey Road“

#### Scenario: Zeitraum
- **WHEN** `from` und `to` angegeben sind
- **THEN** zählen nur Hördurchgänge innerhalb dieser Tage; ohne gültigen Zeitraum zählen alle

#### Scenario: Ohne Interpret
- **WHEN** ein gehörtes Release keinen Interpreten hat
- **THEN** zählt es für keinen Eintrag der Rangliste

### Requirement: Interpreten-Tab auf der Startseite
Der Block „Meistgespielte Alben“ MUST die Tabs „Alben“ und „Interpreten“ anbieten; der Zeitraum-Filter des Blocks MUST für beide gelten. Der Tab „Interpreten“ MUST je Eintrag Rang, eine Cover-Collage (1 Cover vollflächig, 2 nebeneinander, 3–4 als 2×2, ohne Cover ein Platzhalter), den Interpreten, die Anzahl der gehörten Alben und die Anzahl der Hördurchgänge zeigen (DE/EN).

#### Scenario: Tab wechseln
- **WHEN** der Nutzer den Tab „Interpreten“ wählt und danach den Zeitraum „7 Tage“
- **THEN** zeigt der Block die Interpreten-Rangliste der letzten 7 Tage

#### Scenario: Collage
- **WHEN** ein Interpret drei gehörte Releases mit Cover hat
- **THEN** zeigt sein Bild die drei Cover als 2×2-Collage

### Requirement: Interpret in der Sammlung öffnen
Ein Klick auf einen Interpreten MUST die Sammlung mit der Suche nach dem Interpreten öffnen. Die Sammlung MUST eine Suche aus dem URL-Parameter `search` übernehmen.

#### Scenario: Klick auf Interpret
- **WHEN** der Nutzer auf „Miles Davis“ klickt
- **THEN** öffnet sich `/collection?search=Miles%20Davis` mit der Suche „Miles Davis“ im Suchfeld und den passenden Platten
