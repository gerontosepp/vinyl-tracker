## ADDED Requirements

### Requirement: Bezugsquellen per MCP
Der MCP-Server MUST das Tool `get_want_to_have_sources` (`id`, die Listen-ID; optional `release_id`) bereitstellen und dafür `GET /api/want-to-have/{id}/sources` bzw. `…/sources/{release_id}/stats` nutzen. Ohne `release_id` MUST das Tool die Versionsliste mit Marktplatz-Kennzahlen (soweit geladen) und den Shop-Suchlinks liefern, mit `release_id` die Kennzahlen dieser Version. Die Tool-Beschreibung MUST darauf hinweisen, dass Kennzahlen nur für die ersten Versionen vorliegen und das Discogs-Limit schont. Backend-Fehler (404, 429, 400) MUST als verständliche Fehlermeldung des Tools erscheinen.

#### Scenario: Überblick
- **WHEN** der Client `get_want_to_have_sources` mit einer Listen-ID aufruft
- **THEN** enthält das Ergebnis die Versionen (vorgemerkte mit `is_wanted`) und die Shop-Links

#### Scenario: Kennzahlen einer Version
- **WHEN** der Client zusätzlich eine `release_id` aus der Versionsliste übergibt
- **THEN** liefert das Tool günstigsten Preis und Anzahl Angebote dieser Version

#### Scenario: Unbekannter Eintrag
- **WHEN** die Listen-ID unbekannt ist
- **THEN** liefert das Tool einen Fehler mit dem Backend-Status 404
