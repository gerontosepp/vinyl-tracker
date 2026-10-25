## ADDED Requirements

### Requirement: Manuelle Platte per MCP anlegen
Der MCP-Server MUST das Tool `create_manual_record` bereitstellen, das eine manuelle Platte mit denselben Feldern und Pflichtfeldern wie die App anlegt (Pflicht: `artist`, `title`, `format`) und die neue Platte inklusive ihrer ID liefert. Ein Cover lässt sich über MCP nicht hochladen.

#### Scenario: Platte anlegen
- **WHEN** der Client `create_manual_record` mit Künstler, Titel und Format aufruft
- **THEN** existiert die Platte als manuelle Platte in der Sammlung und das Ergebnis enthält ihre negative ID

#### Scenario: Pflichtfeld fehlt
- **WHEN** der Titel fehlt
- **THEN** liefert das Tool einen Validierungsfehler und legt nichts an

### Requirement: Manuelle Platte per MCP prüfen
Der MCP-Server MUST das Tool `check_manual_record` (`id`) bereitstellen, das dieselben Kandidaten wie „Bei Discogs prüfen“ in der App liefert, jeweils mit der Angabe, ob der Release schon in der Sammlung ist. Das Tool MUST nichts verändern.

#### Scenario: Kandidaten abrufen
- **WHEN** der Client `check_manual_record` für eine manuelle Platte aufruft
- **THEN** enthält das Ergebnis die Discogs-Kandidaten mit Release-ID, Titel, Label, Katalognummer, Jahr und der Kennzeichnung „bereits in der Sammlung“

### Requirement: Manuelle Platte per MCP übernehmen
Der MCP-Server MUST das Tool `take_over_manual_record` (`id`, `release_id`, optional `mode`: `new_copy` (Standard) oder `merge`, bei `merge` optional `target_instance_id`) bereitstellen. Die Tool-Beschreibung MUST festhalten, dass es nur nach ausdrücklicher Bestätigung des Nutzers aufgerufen werden darf. Das Verhalten MUST der Übernahme in der App entsprechen.

#### Scenario: Übernahme per MCP
- **WHEN** der Client nach Bestätigung des Nutzers `take_over_manual_record` mit einer Release-ID aufruft
- **THEN** ist die Platte eine Discogs-Platte mit unveränderter Hör-Historie und das Ergebnis enthält die neue Exemplar-ID

#### Scenario: Zusammenführen ohne eindeutiges Ziel
- **WHEN** `mode: "merge"` ohne `target_instance_id` aufgerufen wird und der Release mehrfach in der Sammlung ist
- **THEN** liefert das Tool einen Fehler, der die möglichen Exemplar-IDs nennt, und verändert nichts
