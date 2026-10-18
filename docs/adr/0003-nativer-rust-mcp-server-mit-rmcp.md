# ADR-0003: Nativer Rust Model Context Protocol (MCP) Server mit `rmcp` SDK

* **Status:** Accepted
* **Datum:** 2026-10-17
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#106](https://github.com/gerontosepp/vinyl-tracker/issues/106), [#107](https://github.com/gerontosepp/vinyl-tracker/issues/107), Pull Requests [#109](https://github.com/gerontosepp/vinyl-tracker/pull/109), [#110](https://github.com/gerontosepp/vinyl-tracker/pull/110)

---

## Kontext & Problemstellung

Moderne KI-Assistenten (wie Antigravity IDE, Claude Desktop, Cursor) unterstützen das Model Context Protocol (MCP), um externe Tools und Ressourcen standardisiert aufzurufen. Für Vinyl Tracker sollte eine Möglichkeit geschaffen werden, damit LLMs direkt mit der Plattensammlung interagieren können (z. B. Sammlungsabfrage, Barcode-Scanning, Alben hinzufügen, Marktpreise aktualisieren, Zustandseinstufung und Roon-Wiedergabe).

Dabei war die Architektur des MCP-Servers zu definieren:
* Soll der Server in Rust, Node.js oder Python realisiert werden?
* Soll er direkt auf die PostgreSQL-Datenbank zugreifen oder als Client gegen die REST-API des Vinyl Tracker Backends arbeiten?

## Entscheidungstreiber

* **Wiederverwendung von Geschäftslogik:** Validierungsregeln, Discogs-Rate-Limiting (Governor), Moka-Caching und Roon-WebSocket-Verbindungen liegen im Backend und dürfen nicht dupliziert werden.
* **Minimale Laufzeit-Abhängigkeiten:** Endanwender und Desktop-Clients sollen keine Python- oder Node.js-Runtimes installieren müssen.
* **Performance & Protokolltreue:** Sofortiger Start (stdio-Transport) ohne Interpreter-Latenz; saubere Trennung von `stdout` (MCP JSON-RPC) und `stderr` (Logs).
* **Multi-Plattform-Auslieferung:** Vorkompilierte Binärdateien für Linux (x86_64) und macOS (Apple Silicon aarch64).

## Betrachtete Optionen

* **Option 1: Nativer Rust MCP Server via REST-API-Client mit `rmcp` (Gewählt)**
  * *Vorteile:* Ein einziges, kompaktes Executable (~10 MB); startet in wenigen Millisekunden; delegiert alle Aktionen an das laufende Backend; reaktiviert Session-Tokens automatisch via Login-Lifecycle; null Redundanz in der Geschäftslogik.
  * *Nachteile:* Erfordert ein laufendes Backend (lokal oder im Netzwerk).

* **Option 2: MCP-Server mit direktem Datenbankzugriff (PostgreSQL / SQLx)**
  * *Vorteile:* Funktioniert unabhängig von einem laufenden HTTP-Backend.
  * *Nachteile:* Umgeht alle Caching-, Rate-Limiting-, Discogs- und Roon-Dienste; doppelte Pflege von SQL-Queries und Verschlüsselungslogik; erfordert direkte DB-Netzwerkfreigabe.

* **Option 3: TypeScript / Node.js MCP Server (z. B. via `@modelcontextprotocol/sdk`)**
  * *Vorteile:* Weite Verbreitung in Beispieldokumentationen.
  * *Nachteile:* Erfordert installierte Node.js-Runtime auf Client-Systemen; spürbar höherer Speicherbedarf; zusätzlicher Technologie-Stack neben dem Rust-Backend.

## Entscheidung

Der MCP-Server wird als eigenständige, native Rust-Applikation (`mcp/`) unter Verwendung des offiziellen Rust MCP SDKs **`rmcp` (v3.5)** nach **Option 1 (REST-Client)** implementiert.

Architektur-Merkmale:
* **Kommunikation:** Über HTTP/REST mit dem Backend (`reqwest` HTTP-Client).
* **Authentifizierung:** Unterstützt automatischen Login via Benutzername/Passwort mit In-Memory-Token-Refresh sowie direkte JWT-Bearer-Tokens.
* **Protokoll-Isolation:** JSON-RPC-Nachrichten laufen strikt über `stdout`, Logging und Diagnostics ausschließlich über `stderr`.
* **CI/CD:** Automatische Kompilierung nativer Binärdateien für macOS (Apple Silicon `macos-latest`) und Linux (`self-hosted, linux`) bei jedem Release.

## Konsequenzen

### Positive Effekte
* **Umfangreiches Toolset:** Derzeit 22 dedizierte MCP-Tools für Sammlungsverwaltung, Discogs-Suche, Analytics, Grading und Roon-Multiroom-Steuerung.
* **Zero Runtime Overhead:** Keine Notwendigkeit für Python virtualenvs oder `npm install`.
* **Sichere API-Kapselung:** Alle Berechtigungs-, Krypto- und Validierungsregeln des Backends werden automatisch durchgesetzt.

### Nachteile & Risiken
* **Backend-Abhängigkeit:** Für die Ausführung der Tools muss das Backend erreichbar sein (Default: `http://localhost:8080`).
