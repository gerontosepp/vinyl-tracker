## ADDED Requirements

### Requirement: Strukturierte Discogs-Suche
Das MCP-Tool `search_discogs` und `GET /api/discogs/search` MUST neben dem Freitext `query` die Filter `catno`, `label`, `artist`, `release_title`, `year`, `country` und `format` akzeptieren und an Discogs weiterreichen. Mindestens `query` oder ein Filter MUST gesetzt sein. Suchergebnisse MUST die Labels enthalten; `get_record_details` MUST die Identifiers (z. B. Matrix/Runout) und Notizen des Releases liefern, auch für Releases außerhalb der Sammlung.

#### Scenario: Suche nach Katalognummer und Label
- **WHEN** der MCP-Client `search_discogs` mit `catno: "SHVL 804"` und `label: "Harvest"` aufruft
- **THEN** sucht das Backend bei Discogs mit diesen Filtern und liefert passende Releases inklusive Labels

#### Scenario: Suche ohne Kriterien
- **WHEN** weder `query` noch ein Filter gesetzt ist
- **THEN** antwortet das Backend mit 400

### Requirement: Label-Inbox über MCP
Der MCP-Server MUST das Tool `get_label_inbox` (optional `limit`, Standard 5) bereitstellen, das offene Label-Fotos als Bild-Inhalt (`image/jpeg`) zusammen mit ihren IDs liefert, sowie `resolve_label_photo` (`id`, `status`, optional `discogs_id`) zum Abschließen.

#### Scenario: Inbox abrufen
- **WHEN** der Client `get_label_inbox` aufruft und zwei Fotos offen sind
- **THEN** enthält das Ergebnis einen Text-Block mit den IDs und zwei Bild-Blöcke

#### Scenario: Foto abschließen
- **WHEN** der Client `resolve_label_photo` mit `status: "identified"` und einer Discogs-ID aufruft
- **THEN** ist das Foto nicht mehr in der Inbox

### Requirement: Prompts zur Label-Erkennung
Der MCP-Server MUST die Prompts `identify_record_from_label` und `process_label_inbox` bereitstellen. Beide MUST Claude anleiten, Label-Angaben zu lesen, strukturiert zu suchen, Kandidaten über `get_record_details` zu prüfen und erst nach Bestätigung des Nutzers `add_to_collection` bzw. `scan_barcode` aufzurufen.

#### Scenario: Prompt abrufen
- **WHEN** der Client den Prompt `identify_record_from_label` abruft
- **THEN** enthält er die Anweisung, vor dem Hinzufügen die Bestätigung des Nutzers einzuholen
