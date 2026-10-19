# Delta-Spezifikation: Model Context Protocol Server (MCP)

## ADDED Requirements

### Requirement: Sammlungs-Export über MCP Tool
Der MCP-Server bietet das Tool `export_collection`, um die vollständige Sammlung des Benutzers in den Formaten `json` oder `csv` zu exportieren.

#### Scenario: Export der Sammlung als JSON
- **GIVEN** der authentifizierte Benutzer hat Alben in der Sammlung
- **WHEN** der MCP-Client das Tool `export_collection` mit `format: "json"` aufruft
- **THEN** gibt der Server die exportierten Sammlungsdaten als JSON-Zeichenkette zurück.

#### Scenario: Export der Sammlung als CSV
- **GIVEN** der authentifizierte Benutzer hat Alben in der Sammlung
- **WHEN** der MCP-Client das Tool `export_collection` mit `format: "csv"` aufruft
- **THEN** gibt der Server die exportierten Sammlungsdaten im tabellarischen CSV-Format zurück.

### Requirement: Bereitstellung von MCP Resources
Der MCP-Server stellt strukturierte Kontextdaten über das `vinyl://`-URI-Schema als lesbare Ressourcen bereit:
- `vinyl://collection/summary`: Sammlungsübersicht (Anzahl Alben, Formatverteilung Vinyl vs. CD, ungespielte Platten).
- `vinyl://collection/value`: Aktueller Schätzwert der Sammlung (Minimum, Median, Maximum).
- `vinyl://stats/overview`: Hörstatistiken (Top-Platten, zuletzt gespielte Alben).

#### Scenario: Abruf der Sammlungsübersicht
- **WHEN** der MCP-Client die Ressource `vinyl://collection/summary` anfragt
- **THEN** liefert der Server die Zusammenfassung der Sammlung als strukturierte JSON-Ressource zurück.

#### Scenario: Abruf des Schätzwerts
- **WHEN** der MCP-Client die Ressource `vinyl://collection/value` anfragt
- **THEN** liefert der Server die Schätzwerte der Sammlung als Ressource zurück.

#### Scenario: Abruf der Hörstatistiken
- **WHEN** der MCP-Client die Ressource `vinyl://stats/overview` anfragt
- **THEN** liefert der Server die Übersicht der zuletzt gespielten und meistgehörten Alben zurück.

### Requirement: Bereitstellung von interaktiven MCP Prompts
Der MCP-Server stellt vordefinierte Prompt-Vorlagen für LLMs zur Verfügung:
- `recommend_record`: Prompt für Genre- und stimmungsbasierte Plattenempfehlungen aus der eigenen Sammlung.
- `grading_audit`: Prompt zur Identifikation von Alben mit fehlender Goldmine-Zustandsbewertung und geführten Vervollständigung.

#### Scenario: Aufruf des Plattenempfehlungs-Prompts
- **WHEN** der MCP-Client den Prompt `recommend_record` mit optionalen Parametern `genre` und `mood` abruft
- **THEN** generiert der Server eine strukturierte Prompt-Nachricht mit Anweisungen zur Sammlungsanalyse und Albenempfehlung.

#### Scenario: Aufruf des Grading-Audit-Prompts
- **WHEN** der MCP-Client den Prompt `grading_audit` abruft
- **THEN** generiert der Server eine strukturierte Prompt-Nachricht zur Überprüfung unbewerteter Alben.
