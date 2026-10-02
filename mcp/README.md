# Vinyl Tracker MCP Server 🎵 (Rust)

Ein hochperformanter **Model Context Protocol (MCP) Server** in Rust, der die Dienste des **Vinyl Tracker Backends** vollständig für KI-Assistenten (Antigravity IDE, Claude Desktop, Cursor etc.) bereitstellt.

Der Server implementiert **Option 1 (REST-Client)**: Er kommuniziert direkt über die REST-API mit dem Spring Boot Backend. Dadurch werden alle zentralen Validierungs-, Synchronisations- (Discogs API) und Caching-Mechanismen des Backends wiederverwendet.

---

## ⚡ Highlights

- **Offizielles Rust MCP SDK:** Basiert auf `rmcp` (v3.5) mit voller Protokollkonformität (stdio Transport).
- **Robuste Authentifizierung:** Unterstützt automatischen Login via Benutzername & Passwort mit Token-Lifecycle-Management sowie direkte JWT-Bearer-Tokens.
- **Kompakt & Null-Overhead:** Native Binärdatei (~10 MB), startet in Millisekunden und benötigt keine Runtime-Interpreter (Python/Node).
- **Saubere Standard-I/O-Trennung:** Protokoll-Nachrichten laufen strikt über `stdout`, strukturierte Logs und Fehlermeldungen über `stderr`.

---

## 📋 Bereitgestellte MCP-Tools

| Tool-Name | Beschreibung | Parameter |
| :--- | :--- | :--- |
| `get_user_collection` | Ruft die persönliche Vinyl-Sammlung ab | `page` (int), `per_page` (int), `sort` (`artist`, `listens`, `addedAt`), `sort_order` (`asc`, `desc`), `min_plays` (int), `search` (str) |
| `sync_collection` | Startet den bidirektionalen Abgleich mit Discogs | *keine* |
| `scan_barcode` | Protokolliert ein Hör-Event via Barcode oder QR-Code | `barcode` (str, z. B. `discogs-id:12345` oder UPC/EAN) |
| `delete_scan` | Löscht ein einzelnes Hör-Event | `id` (int) |
| `reset_all_listens` | Setzt alle Hör-Events des Nutzers zurück | *keine* |
| `get_recent_listens` | Historie der zuletzt gehörten Platten | `from` (YYYY-MM-DD), `to` (YYYY-MM-DD) |
| `get_top_records` | Meistgehörte Alben im Zeitraum | `from` (YYYY-MM-DD), `to` (YYYY-MM-DD) |
| `get_collection_value` | Schätzwert der Sammlung von Discogs (min, med, max) | *keine* |
| `get_genre_breakdown` | Verteilung der Genres in der Sammlung | *keine* |
| `get_current_user` | Profilinformationen des eingeloggten Nutzers | *keine* |

---

## 🛠️ Installation & Bauen

### Voraussetzungen
- **Rust Toolchain:** Version 1.88+ (z. B. via `rustup` oder Homebrew `brew install rust`)
- **Vinyl Tracker Backend:** Laufendes Spring Boot Backend (z. B. via Docker `docker compose up -d` oder lokal auf Port 8080)

### 1. Repository-Verzeichnis aufrufen
```bash
cd /Users/opolm/develop/AntiGrafity/mcp
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
/Users/opolm/develop/AntiGrafity/mcp/target/release/vinyl-mcp-server
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
      "command": "/Users/opolm/develop/AntiGrafity/mcp/target/release/vinyl-mcp-server",
      "env": {
        "VINYL_API_URL": "http://localhost:8080",
        "VINYL_USERNAME": "opolm",
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
      "command": "/Users/opolm/develop/AntiGrafity/mcp/target/release/vinyl-mcp-server",
      "env": {
        "VINYL_API_URL": "http://localhost:8080",
        "VINYL_USERNAME": "opolm",
        "VINYL_PASSWORD": "dein_passwort"
      }
    }
  }
}
```

### 3. Cursor / VS Code (Cline / Roo-Code)
In den MCP-Einstellungen der jeweiligen Erweiterung hinzufügen:
- **Command:** `/Users/opolm/develop/AntiGrafity/mcp/target/release/vinyl-mcp-server`
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
