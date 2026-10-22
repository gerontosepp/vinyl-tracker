## ADDED Requirements

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
