# Model Context Protocol Server (MCP)

## Purpose
Stellt einen nativen Model Context Protocol (MCP) Server in Rust bereit, über den KI-Assistenten (wie Claude Desktop, Google Antigravity, Cursor) semantische Aktionen und Abfragen auf der Vinyl-Sammlung, dem Hardware-Scanner und der Roon-Audioausgabe direkt ausführen können.

## Requirements

### Requirement: MCP Server-Architektur und Stdio-Transport
Der Server stellt die MCP-Dienste über Standard Input/Output (Stdio) mit JSON-RPC 2.0 Nachrichtenübertragung bereit und nutzt die REST-API des Backends zur Datensynchronisation und Ausführung.

#### Scenario: Tool-Initialisierung über Stdio
- **WHEN** ein MCP-Client den Server über `stdio` startet und die `initialize`-Methode aufruft
- **THEN** meldet der Server seine Server-Informationen und deklarierten Fähigkeiten erfolgreich zurück.

### Requirement: Bereitstellung registrierter MCP-Tools
Der Server stellt spezialisierte Tools für Sammlungsabfragen, Sammlungs-Management, Roon-Wiedergabe, Hardware-Scanning und Benutzerverwaltung bereit:
- Sammlungsabfragen (`get_user_collection`, `get_record_details`, `get_random_record`, `get_top_records`, `get_unplayed_records`, `get_recent_listens`, `get_genre_breakdown`, `get_collection_value`)
- Sammlungs-Management (`add_to_collection`, `remove_from_collection`, `update_record_condition`, `refresh_collection_prices`, `sync_collection`)
- Wiedergabe & Tracking (`log_record_listen`, `reset_all_listens`, `play_record_on_roon`, `get_roon_zones`, `get_roon_status`)
- Barcode & Scanning (`scan_barcode`, `delete_scan`, `search_discogs`)
- Profil (`get_current_user`)

#### Scenario: Ausführung eines registrierten Tools
- **WHEN** der MCP-Client ein gültiges registriertes Tool mit passenden Parametern aufruft
- **THEN** führt der Server den entsprechenden Backend-Request aus und liefert das Ergebnis im standardisierten MCP-Tool-Format zurück.

### Requirement: Validierung und strukturierte Fehlerbehandlung
Jedes Tool definiert ein striktes JSON-Schema für Parameter. Fehler werden als strukturierte JSON-RPC Fehlerobjekte zurückgegeben.

#### Scenario: Validierungsfehler bei ungültigen Parametern
- **WHEN** ein Tool mit ungültigen Parametern aufgerufen wird
- **THEN** antwortet der Server mit einem standardisierten JSON-RPC Fehlercode und einer aussagekräftigen Fehlermeldung.

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

### Requirement: API-Vertrag zwischen MCP-Server und Backend
Der MCP-Server MUST Backend-Antworten mit denselben Datentypen deserialisieren, mit denen das Backend sie serialisiert (gemeinsame Crate `vinyl-api-types`). Tool-Ergebnisse SHALL die vom Backend gelieferten Informationen vollständig wiedergeben.

#### Scenario: Ergebnis einer Sammlungs-Synchronisation
- **GIVEN** der authentifizierte Benutzer hat ein verbundenes Discogs-Konto
- **WHEN** der MCP-Client das Tool `sync_collection` aufruft und das Backend die Synchronisation erfolgreich abschließt
- **THEN** meldet der Server die Anzahl hinzugefügter, aktualisierter und entfernter Alben sowie die Gesamtzahl der Sammlung.

#### Scenario: Ergebnis nach dem Hinzufügen eines Albums
- **WHEN** der MCP-Client das Tool `add_to_collection` mit einer gültigen Discogs-Release-ID aufruft
- **THEN** bestätigt der Server das Hinzufügen und meldet das Ergebnis der anschließenden Synchronisation (hinzugefügt, aktualisiert, entfernt, gesamt).

#### Scenario: Meistgespielte Platten mit Wiedergabeanzahl
- **GIVEN** der Benutzer hat mindestens eine Platte gehört
- **WHEN** der MCP-Client das Tool `get_top_records` aufruft oder die Ressource `vinyl://stats/overview` anfragt
- **THEN** liefert der Server die meistgespielten Platten jeweils mit Titel, Künstler und Wiedergabeanzahl.

#### Scenario: Schätzwert der Sammlung
- **GIVEN** der Benutzer hat ein verbundenes Discogs-Konto
- **WHEN** der MCP-Client das Tool `get_collection_value` aufruft oder die Ressource `vinyl://collection/value` anfragt
- **THEN** liefert der Server Minimum, Median und Maximum jeweils mit Betrag und Währung.

#### Scenario: Barcode-Scan mit erkannter Platte
- **WHEN** der MCP-Client das Tool `scan_barcode` mit einem Barcode aufruft, der einer Platte der Sammlung zugeordnet ist
- **THEN** enthält das Ergebnis die erkannte Platte (Discogs-ID, Titel, Künstler).

#### Scenario: Barcode-Scan ohne Treffer in der Sammlung
- **WHEN** der MCP-Client das Tool `scan_barcode` mit einem Barcode aufruft, der nicht in der Sammlung ist, für den Discogs aber Releases kennt
- **THEN** enthält das Ergebnis die Discogs-Vorschläge, damit der Benutzer eines der Releases hinzufügen kann.

### Requirement: Meistgespielte Interpreten per MCP
Der MCP-Server MUST das Tool `get_top_artists` mit optionalem Zeitraum (`from`, `to` als `YYYY-MM-DD`) bereitstellen, das die Rangliste aus `GET /api/analytics/top-artists` mit Interpret, Hördurchgängen und Anzahl der Releases ausgibt.

#### Scenario: Wen höre ich am meisten?
- **WHEN** ein MCP-Client `get_top_artists` ohne Zeitraum aufruft
- **THEN** erhält er die Interpreten absteigend nach Hördurchgängen mit Anzahl der Hördurchgänge und Releases
