# Delta-Spezifikation: Model Context Protocol Server (MCP)

## ADDED Requirements

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
