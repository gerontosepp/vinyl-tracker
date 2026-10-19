# Roon Core Audio-Integration (Roon)

## Purpose
Ermöglicht die direkte Steuerung von Multi-Room-Wiedergabesystemen über einen lokalen Roon Core. Schallplatten aus der Vinyl Tracker Sammlung können direkt auf aktiven Roon-Audiozonen gestartet oder überwacht werden.

## Requirements

### Requirement: MOO-Protokollanbindung und Pairing
Das Backend kommuniziert direkt über das native MOO (Messages Object Oriented) Protokoll via WebSockets mit dem Roon Core mit Heartbeat und automatischer Wiederverbindung.

#### Scenario: Verbindungsaufbau zum Roon Core
- **WHEN** die Roon-Verbindung initialisiert wird
- **THEN** baut das Backend eine WebSocket-Verbindung zum konfigurierten Roon Core auf und speichert den Autorisierungs-Token verschlüsselt.

### Requirement: Zonen-Erkennung und Statusabfrage
Das System stellt Endpunkte zur Abfrage aller aktiven Audiozonen und des Core-Verbindungsstatus bereit (`GET /api/roon/zones` und `GET /api/roon/status`).

#### Scenario: Zonen auflisten
- **WHEN** der Client oder das MCP-Tool `GET /api/roon/zones` anfragt
- **THEN** gibt das Backend die Liste aller verfügbaren Roon-Zonen mit ID, Name und Wiedergabestatus zurück.

### Requirement: Album-Wiedergabe auf Roon-Zone
Das System ermöglicht das Starten eines Albums auf einer angegebenen Zielzone (`POST /api/roon/play`).

#### Scenario: Album abspielen
- **WHEN** ein Abspielbefehl mit Record-ID und optionaler Zone-ID gesendet wird
- **THEN** durchsucht das System die Roon-Bibliothek nach dem Album, startet die Wiedergabe auf der Zielzone und protokolliert parallel ein Hör-Event.
