# Spezifikation: Roon Core Audio-Integration (Roon)

## 1. Übersicht & Zielsetzung
Ermöglicht die direkte Steuerung von Multi-Room-Wiedergabesystemen über einen lokalen Roon Core. Schallplatten aus der Vinyl Tracker Sammlung können direkt auf aktiven Roon-Audiozonen gestartet oder überwacht werden.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 Anbindung & Protokoll
* Das Backend kommuniziert direkt über das native **MOO (Messages Object Oriented) Protokoll** via WebSockets mit dem Roon Core:
  - Verbindungsaufbau: TCP/WebSocket zu Host und Port des Roon Core (Standard: Port 9330 bzw. 9100).
  - Pairing: Einmalige Autorisierung in den Roon-Einstellungen mit persistenter Token-Speicherung (verschlüsselt mit AEAD AES-256-GCM).
  - Heartbeat & Auto-Reconnect: Überwachung der WebSocket-Verbindung mit automatischem Reconnect bei Verbindungsabriss.

### 2.2 Zonen-Erkennung & Status
* Endpunkt `GET /api/roon/zones` bzw. MCP `get_roon_zones`:
  - Listet alle im Roon Core konfigurierten Zonen mit Namen, Zonen-ID, Lautstärke und aktuellem Playback-Zustand (`playing`, `paused`, `stopped`).
* Endpunkt `GET /api/roon/status` bzw. MCP `get_roon_status`:
  - Gibt Auskunft über Verbindungsstatus, Pairing-Zustand, Name des Roon Cores und die aktuell ausgewählte Standard-Zone.

### 2.3 Wiedergabe-Steuerung (Playback)
* Endpunkt `POST /api/roon/play` bzw. MCP `play_record_on_roon`:
  - Nimmt eine `record_id` oder Discogs `release_id` sowie optional eine `zone_id` entgegen.
  - Sucht in der Roon-Bibliothek nach dem entsprechenden Album anhand von Künstler, Titel und Metadaten.
  - Startet die Wiedergabe auf der Zielzone und protokolliert parallel ein Hör-Event im Vinyl Tracker.
