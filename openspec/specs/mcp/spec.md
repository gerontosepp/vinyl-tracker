# Spezifikation: Model Context Protocol Server (MCP)

## 1. Übersicht & Zielsetzung
Stellt einen nativen Model Context Protocol (MCP) Server bereit, über den KI-Assistenten (wie Claude Desktop, Google Antigravity, Cursor) semantische Aktionen und Abfragen auf der Vinyl-Sammlung, dem Hardware-Scanner und der Roon-Audioausgabe direkt ausführen können.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 Architektur & Transport
* Implementiert in Rust unter Verwendung des offiziellen `rmcp`-Crates (Model Context Protocol SDK).
* Transport: Standardmäßig **Stdio** (Standard Input/Output) mit JSON-RPC 2.0 Nachrichtenübertragung.
* Das Binary `vinyl-tracker-mcp` kommuniziert über die REST-API des Vinyl Tracker Backends oder greift mit konfiguriertem API-Token auf die Backend-Dienste zu.

### 2.2 Registrierte Tools (Werkzeuge)
Aktuell umfasst der MCP-Server 22 registrierte Werkzeuge in folgenden Kategorien:

1. **Sammlungsabfragen**:
   - `get_user_collection`: Ruft Alben der Sammlung mit Filtern (Genre, Jahr, Suchbegriff, Sortierung) ab.
   - `get_record_details`: Liefert Detailinformationen zu einem spezifischen Tonträger.
   - `get_random_record`: Schlägt ein zufälliges Album aus der Sammlung vor (z. B. für Hörempfehlungen).
   - `get_top_records`: Liefert die meistgehörten Alben.
   - `get_unplayed_records`: Findet ungespielte Platten (*Shelf Warmers*).
   - `get_recent_listens`: Ruft die Chronologie der letzten Hör-Ereignisse ab.
   - `get_genre_breakdown`: Liefert die Verteilung der Genres in der Sammlung.
   - `get_collection_value`: Berechnet den geschätzten Gesamtwert der Sammlung.
2. **Sammlungs-Management**:
   - `add_to_collection`: Fügt ein Release via Discogs Release-ID zur Sammlung hinzu.
   - `remove_from_collection`: Entfernt ein Album aus der lokalen Sammlung.
   - `update_record_condition`: Aktualisiert Zustandseinstufungen (`media_condition`, `sleeve_condition`).
   - `refresh_collection_prices`: Aktualisiert Marktschätzpreise über die Discogs Marketplace API.
   - `sync_collection`: Gleicht die lokale Sammlung mit dem Discogs-Konto ab.
3. **Wiedergabe & Listen-Tracking**:
   - `log_record_listen`: Protokolliert ein Hör-Event für eine Platte.
   - `reset_all_listens`: Setzt die Hörhistorie zurück (mit Sicherheitsbestätigung).
   - `play_record_on_roon`: Startet ein Album auf einer Roon-Audiozone.
   - `get_roon_zones`: Listet alle verfügbaren Roon-Zonen auf.
   - `get_roon_status`: Prüft Verbindungs- und Pairing-Status des Roon Cores.
4. **Barcode & Scanning**:
   - `scan_barcode`: Simuliert oder verarbeitet einen Barcode-Scan (EAN/UPC).
   - `delete_scan`: Löscht einen temporären Scan-Eintrag.
   - `search_discogs`: Sucht in der Discogs-Datenbank nach Künstlern, Alben oder Katalognummern.
5. **Benutzerverwaltung**:
   - `get_current_user`: Gibt Profil- und Berechtigungsinformationen des aktiven Nutzers zurück.

### 2.3 Validierung & Fehlerbehandlung
* Jedes Tool definiert ein striktes JSON-Schema für Parameter.
* Fehler (Netzwerk, Token ungültig, Ressource nicht gefunden) werden als strukturierte JSON-RPC Fehlerobjekte zurückgegeben.
