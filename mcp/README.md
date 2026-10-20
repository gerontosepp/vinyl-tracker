# Vinyl Tracker MCP Server 🎵 (Rust)

Ein hochperformanter **Model Context Protocol (MCP) Server** in Rust, der die Dienste des **Vinyl Tracker Backends** vollständig für KI-Assistenten (Antigravity IDE, Claude Desktop, Cursor etc.) bereitstellt.

Der Server implementiert **Option 1 (REST-Client)**: Er kommuniziert direkt über die REST-API mit dem Vinyl Tracker Backend (Rust/Axum). Dadurch werden alle zentralen Validierungs-, Synchronisations- (Discogs API) und Caching-Mechanismen des Backends wiederverwendet.

---

## ⚡ Highlights

- **Offizielles Rust MCP SDK:** Basiert auf `rmcp` (v3.5) mit voller Protokollkonformität (stdio Transport).
- **Robuste Authentifizierung:** Unterstützt automatischen Login via Benutzername & Passwort mit Token-Lifecycle-Management sowie direkte JWT-Bearer-Tokens.
- **Kompakt & Null-Overhead:** Native Binärdatei (~10 MB), startet in Millisekunden und benötigt keine Runtime-Interpreter (Python/Node).
- **Saubere Standard-I/O-Trennung:** Protokoll-Nachrichten laufen strikt über `stdout`, strukturierte Logs und Fehlermeldungen über `stderr`.
- **Ressourcen & Prompts:** Unterstützt MCP-Ressourcen (`vinyl://`) und interaktive LLM-Prompts (Empfehlungen & Grading-Audits).

---

## 📋 Bereitgestellte MCP-Tools

| Tool-Name | Beschreibung | Parameter |
| :--- | :--- | :--- |
| `get_user_collection` | Ruft die persönliche Vinyl-Sammlung ab, mit berechnetem Lagerplatz (`storage`) bei konfigurierten Regalen | `page` (int), `per_page` (int), `sort` (`artist`, `listens`, `addedAt`), `sort_order` (`asc`, `desc`), `min_plays` (int), `search` (str), `storage_unit` (Regal-ID oder `unplaced`, optional), `compartment` (int, optional) |
| `sync_collection` | Startet den bidirektionalen Abgleich mit Discogs | *keine* |
| `add_to_collection` | Fügt ein Album via Discogs-Release-ID zur Sammlung hinzu, gleicht ab und nennt den Lagerplatz samt nötiger Verschiebungen | `release_id` (int) |
| `remove_from_collection` | Entfernt ein Album aus der Sammlung und von Discogs | `release_id` (int), `instance_id` (int, optional) |
| `scan_barcode` | Protokolliert ein Hör-Event via Barcode oder QR-Code | `barcode` (str, z. B. `discogs-id:12345` oder UPC/EAN) |
| `log_record_listen` | Protokolliert ein Hör-Event direkt per Record-ID oder Release-ID | `id` (int) |
| `delete_scan` | Löscht ein einzelnes Hör-Event | `id` (int) |
| `reset_all_listens` | Setzt alle Hör-Events des Nutzers zurück | *keine* |
| `get_recent_listens` | Historie der zuletzt gehörten Platten | `from` (YYYY-MM-DD), `to` (YYYY-MM-DD) |
| `get_top_records` | Meistgehörte Alben im Zeitraum | `from` (YYYY-MM-DD), `to` (YYYY-MM-DD) |
| `get_collection_value` | Schätzwert der Sammlung von Discogs (min, med, max) | *keine* |
| `get_genre_breakdown` | Verteilung der Genres in der Sammlung | *keine* |
| `get_current_user` | Profilinformationen des eingeloggten Nutzers | *keine* |
| `get_random_record` | Zufällige Plattenempfehlung mit Genre- und Ungespielt-Filter | `genre` (str, optional), `unplayed_only` (bool, default `false`) |
| `get_unplayed_records` | Ungespielte Platten der Sammlung ("Shelf of Shame") | `page` (int), `per_page` (int) |
| `get_record_details` | Vollständige Album-Details mit Tracklist, Formaten, Labels & Play-History | `id` (int, interne Record-ID oder Discogs-Release-ID) |
| `search_discogs` | Globale Discogs-Datenbanksuche nach Alben/Künstlern | `query` (str), `type` (str, optional), `page` (int), `per_page` (int) |
| `get_roon_zones` | Ruft aktive Roon-Audiozonen und Ausgaberäume ab | *keine* |
| `get_roon_status` | Prüft Verbindungs- und Pairing-Status des lokalen Roon Cores | *keine* |
| `play_record_on_roon` | Startet direkte Wiedergabe ('Play Now') eines Albums auf einem konfigurierten Roon Core | `artist` (str), `title` (str), `zone_id` (str, optional) |
| `update_record_condition` | Aktualisiert die Goldmine-Zustandseinstufung (Media/Sleeve) einer Platte | `id` (int), `media_condition` (str, optional), `sleeve_condition` (str, optional) |
| `refresh_collection_prices` | Aktualisiert Discogs-Marktpreise (Min, Median) der Sammlung | `only_missing` (bool, optional, default `true`) |
| `export_collection` | Exportiert die komplette Nutzersammlung als strukturierte Daten | `format` (`json` oder `csv`) |
| `get_record_placement` | Lagerplatz einer Platte: Regal, Fach (Zeile/Spalte) und Nachbarn | `discogs_id` (int) |
| `get_storage_layout` | Regal-Übersicht je Medium mit Füllstand und Künstlerbereich pro Fach | *keine* |

---

## 📦 Bereitgestellte MCP-Ressourcen

| URI | Name | MIME-Type | Beschreibung |
| :--- | :--- | :--- | :--- |
| `vinyl://collection/summary` | `collection_summary` | `application/json` | Gesamtübersicht der Sammlung (Gesamtzahl, Vinyl vs. CD, ungespielte Alben, Genreverteilung) |
| `vinyl://collection/value` | `collection_value` | `application/json` | Schätzwerte der Sammlung nach Discogs-Marktplatz (Minimum, Median, Maximum) |
| `vinyl://stats/overview` | `stats_overview` | `application/json` | Zusammenfassung der Hörstatistiken (Top-Platten und jüngste Hör-Events) |

---

## 💡 Bereitgestellte MCP-Prompts

| Prompt-Name | Beschreibung | Argumente |
| :--- | :--- | :--- |
| `recommend_record` | Kuratierte Empfehlungsvorlage für Vinyl-Alben basierend auf Genre und Stimmung | `genre` (str, optional), `mood` (str, optional) |
| `grading_audit` | Interaktive Prüfung und Einstufung unbewerteter Alben nach Goldmine-Standard | `limit` (int, optional, Standard: 10) |

---

## 🛠️ Installation & Bauen

### Option A: Fertige Binärdatei herunterladen (Kein Rust erforderlich)
Ab jedem Release stehen vorkompilierte Archive direkt unter **GitHub Releases** bereit:
* **Linux (x86_64):** `vinyl-mcp-server-linux-x86_64.tar.gz` (ideal für Proxmox, Ubuntu, Debian)
* **macOS (Apple Silicon):** `vinyl-mcp-server-macos-aarch64.tar.gz` (für M1/M2/M3/M4 Macs)

Einfach entpacken und den Pfad in deiner `mcp_config.json` eintragen.

### Option B: Aus dem Quellcode bauen
#### Voraussetzungen
- **Rust Toolchain:** Version 1.88+ (z. B. via `rustup` oder Homebrew `brew install rust`)
- **Vinyl Tracker Backend:** Laufendes Rust/Axum-Backend (z. B. via Docker `docker compose up -d` oder lokal auf Port 8080) **aus derselben Version** wie der MCP-Server – beide nutzen die gemeinsamen API-Typen aus `backend/crates/vinyl-api-types`, daher muss der vollständige Repo-Checkout zum Bauen vorhanden sein

### 1. Repository-Verzeichnis aufrufen
```bash
cd mcp
```

### 2. Tests ausführen
```bash
cargo test
```

### 3. Release-Binärdatei kompilieren
```bash
cargo build --release
```
Die erzeugte Binärdatei liegt anschließend unter:
```
./target/release/vinyl-mcp-server
```

---

## ⚙️ Konfiguration (Umgebungsvariablen)

Der Server liest Konfigurationswerte aus Umgebungsvariablen oder einer optionalen `.env`-Datei:

| Variable | Beschreibung | Standardwert |
| :--- | :--- | :--- |
| `VINYL_API_URL` | URL des Vinyl Tracker Backends | `http://localhost:8080` |
| `VINYL_USERNAME` | Benutzername für automatischen Login | *(optional)* |
| `VINYL_PASSWORD` | Passwort für automatischen Login | *(optional)* |
| `VINYL_AUTH_TOKEN` | Alternativ: direkter JWT Bearer Token | *(optional)* |

> **Hinweis zur Authentifizierung:** Wenn `VINYL_USERNAME` und `VINYL_PASSWORD` konfiguriert sind, führt der MCP-Server beim Start automatisch einen Login gegen `/api/users/login` durch, speichert das Session-Token im Speicher und erneuert es bei Bedarf.

---

## 🔌 Einbindung in KI-Tools

### 1. Antigravity IDE
Füge den Server in deine globale oder Workspace-spezifische MCP-Konfiguration ein (z. B. `~/.gemini/antigravity-ide/mcp_config.json` oder `~/.gemini/config/mcp_config.json`):

```json
{
  "mcpServers": {
    "vinyl-tracker": {
      "command": "/path/to/vinyl-tracker/mcp/target/release/vinyl-mcp-server",
      "env": {
        "VINYL_API_URL": "http://localhost:8080",
        "VINYL_USERNAME": "dein_benutzername",
        "VINYL_PASSWORD": "dein_passwort"
      }
    }
  }
}
```

### 2. Claude Desktop
Bearbeite die Datei `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vinyl-tracker": {
      "command": "/path/to/vinyl-tracker/mcp/target/release/vinyl-mcp-server",
      "env": {
        "VINYL_API_URL": "http://localhost:8080",
        "VINYL_USERNAME": "dein_benutzername",
        "VINYL_PASSWORD": "dein_passwort"
      }
    }
  }
}
```

### 3. Cursor / VS Code (Cline / Roo-Code)
In den MCP-Einstellungen der jeweiligen Erweiterung hinzufügen:
- **Command:** `/path/to/vinyl-tracker/mcp/target/release/vinyl-mcp-server`
- **Env:**
  - `VINYL_API_URL`: `http://localhost:8080`
  - `VINYL_USERNAME`: `dein_benutzername`
  - `VINYL_PASSWORD`: `dein_passwort`

---

## 🚀 Direkter Funktionstest (Terminal)

Du kannst die Tools und das MCP-Protokoll direkt über die Befehlszeile testen:

```bash
# Initialisierung und Tool-Liste abfragen
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | ./target/release/vinyl-mcp-server
```
