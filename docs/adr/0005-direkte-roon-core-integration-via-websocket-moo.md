# ADR-0005: Direkte Roon Core Integration via WebSocket und MOO/1 Protokoll

* **Status:** Accepted
* **Datum:** 2026-10-17
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#67](https://github.com/gerontosepp/vinyl-tracker/issues/67), [#68](https://github.com/gerontosepp/vinyl-tracker/issues/68), [#69](https://github.com/gerontosepp/vinyl-tracker/issues/69)

---

## Kontext & Problemstellung

Vinyl Tracker soll es Nutzern ermöglichen, beim Betrachten oder Scannen eines Albums im Detail-Modal sofort die digitale Wiedergabe auf dem heimischen Audio-System zu starten ("Auf Roon abspielen" / Play Now).

Roon stellt kein klassisches öffentliches Cloud-REST-API bereit, sondern nutzt ein proprietäres lokales Protokoll namens **MOO/1** (Message Oriented Over-the-wire) über WebSockets im lokalen Netzwerk (LAN), ergänzt durch UDP-Broadcast-Discovery auf Port 9003.

Es war zu entscheiden, wie die Anbindung zwischen Vinyl Tracker und dem lokalen Roon Core architektonisch umgesetzt wird.

## Entscheidungstreiber

* **Geringe Komplexität der Infrastruktur:** Keine Notwendigkeit für zusätzliche Docker-Container, Node.js-Bridges oder externe Roon-Extensions.
* **Latenz & Responsivität:** Direkte WebSocket-Verbindung für sofortige Zonenabfrage und verzögerungsfreien Wiedergabestart.
* **Sicherheit:** Kapselung der Roon-Credentials und Zonen-Konfiguration auf Benutzerebene im Backend.

## Betrachtete Optionen

* **Option 1: Direkte Roon MOO/1 WebSocket-Implementierung im Rust-Backend (Gewählt)**
  * *Vorteile:* Vollständig autark im Backend integriert (`services/roon/moo.rs`, `services/roon/client.rs`); keine Drittanbieter-Services erforderlich; extrem schnelle Reaktionen; saubere Zustandsverwaltung per Tokio WebSocket Stream (`tokio-tungstenite`).
  * *Nachteile:* Das Roon MOO/1-Nachrichten-Framing (Header-Blöcke, Body, Request/Response-IDs, Continuation-Frames) musste in Rust nativ auscodiert und getestet werden.

* **Option 2: Externe Node.js Roon Extension Bridge (Docker-Container)**
  * *Vorteile:* Nutzung der offiziellen `roon-api` NPM-Pakete von Roon Labs.
  * *Nachteile:* Erfordert einen zusätzlichen Container in Docker Compose; erhöht den Speicherverbrauch um ~80 MB; komplexere Fehlerdiagnose bei Verbindungsausfällen zwischen Backend, Bridge und Core.

* **Option 3: Roon Cloud / Webhooks**
  * *Vorteile:* Keine LAN-Verbindung erforderlich.
  * *Nachteile:* Technisch nicht möglich, da Roon Labs keine öffentlichen Cloud-Streaming-APIs anbietet; Roon Core agiert strikt im lokalen Netzwerk.

## Entscheidung

Das Rust-Backend implementiert einen **nativen MOO/1-Protokoll-Client** direkt über WebSockets (`tokio-tungstenite`):
1. **Discovery:** Automatisches Auffinden des Roon Cores via UDP SO_BROADCAST auf Port 9003 oder manuelle Host/Port-Konfiguration in den Benutzereinstellungen.
2. **Pairing & Authentifizierung:** Das Backend registriert sich als offizielle Roon Extension (`com.vinyltracker.app`), empfängt ein Pairing-Token und speichert dieses benutzerbezogen in der Datenbank.
3. **Zonen & Transport:** Abfrage verfügbarer Ausgabezonen (`/api/roon/zones`), Statusabfrage (`/api/roon/status`) und Auslösen von Wiedergabebefehlen (`/api/roon/play`) mit automatischer Auflösung von Künstler und Albumtitel in der Roon-Mediathek.

## Konsequenzen

### Positive Effekte
* **Single-Service-Setup:** Kein zusätzlicher Roon-Bridge-Container in `docker-compose.yml` nötig.
* **Echtzeit-Feedback:** Zonen- und Wiedergabestatus stehen dem Web-Frontend und dem MCP-Server verzögerungsfrei zur Verfügung.
* **Saubere Modularisierung:** Reines Rust-Modul (`services/roon/`) mit separater Unit-Test-Suite für MOO-Framing und Ping/Pong-Handling.

### Nachteile & Risiken
* **Protokoll-Wartung:** Änderungen im proprietären Roon MOO/1-Protokoll müssen eigenständig im Rust-Code gepflegt werden (wobei das MOO/1-Protokoll seit Jahren stabil ist).
