## ADDED Requirements

### Requirement: Meistgespielte Interpreten per MCP
Der MCP-Server MUST das Tool `get_top_artists` mit optionalem Zeitraum (`from`, `to` als `YYYY-MM-DD`) bereitstellen, das die Rangliste aus `GET /api/analytics/top-artists` mit Interpret, Hördurchgängen und Anzahl der Releases ausgibt.

#### Scenario: Wen höre ich am meisten?
- **WHEN** ein MCP-Client `get_top_artists` ohne Zeitraum aufruft
- **THEN** erhält er die Interpreten absteigend nach Hördurchgängen mit Anzahl der Hördurchgänge und Releases
