# Spec Delta

## Purpose

Ermöglicht es Nutzern, externe KI-Modelle über beliebige OpenAI-kompatible Anbieter zu konfigurieren, zu testen und als Standard für automatische Erkennungsaufgaben zu verwenden.

## ADDED Requirements

### Requirement: KI-Verbindungen verwalten

Das Backend MUST pro Nutzer mehrere benannte KI-Verbindungen speichern und über `/api/users/me/ai/connections` auflisten, anlegen, ändern und löschen. Eine Verbindung MUST Name, Preset, Base-URL, Modell, Authentifizierungsart und optional einen Key enthalten. Der Key MUST verschlüsselt gespeichert, nie zurückgegeben und nie geloggt werden; Responses MUST nur `hasApiKey` liefern. Fremde Verbindungen MUST mit 404 beantwortet werden.

#### Scenario: Verbindung anlegen
- **WHEN** der Nutzer eine gültige Verbindung mit Name, Preset, Base-URL, Modell und Key anlegt
- **THEN** antwortet das Backend mit 201, die Verbindung erscheint in der Liste und der Key wird nur als `hasApiKey: true` gemeldet

#### Scenario: Fremde Verbindung
- **WHEN** Nutzer A eine Verbindung von Nutzer B ändert oder löscht
- **THEN** antwortet das Backend mit 404

### Requirement: Standard-Verbindung

Pro Nutzer MUST höchstens eine Verbindung als Standard markiert sein. Nach dem Löschen der Standard-Verbindung MUST eine verbleibende Verbindung Standard werden; ohne verbleibende Verbindung gibt es keinen Standard. Die Standard-Verbindung MUST die automatische Label-Erkennung versorgen, sofern sie nutzbar ist (lokales Preset oder gespeicherter Key).

#### Scenario: Standard wechseln
- **WHEN** der Nutzer eine andere Verbindung als Standard setzt
- **THEN** ist genau diese Verbindung Standard und die vorherige verliert die Markierung

#### Scenario: Standard löschen
- **WHEN** der Nutzer die Standard-Verbindung löscht und eine weitere Verbindung existiert
- **THEN** wird eine verbleibende Verbindung Standard

### Requirement: Anbieter-Presets

Das Backend MUST Presets für OpenRouter, OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, Together, Fireworks, Ollama, LM Studio, Azure OpenAI und Custom bereitstellen. Ein Preset MUST Standard-Base-URL und Authentifizierungsart liefern, die der Nutzer überschreiben kann. Lokale Presets MÜSSEN ohne API-Key funktionieren. Unbekannte Presets MUST mit 400 abgelehnt werden.

#### Scenario: Preset auswählen
- **WHEN** der Nutzer das Preset „OpenAI“ wählt
- **THEN** sind Base-URL und Bearer-Auth vorausgefüllt und bleiben editierbar

#### Scenario: Lokales Modell
- **WHEN** der Nutzer eine Ollama-Verbindung ohne API-Key anlegt
- **THEN** wird die Verbindung gespeichert und kann getestet werden

#### Scenario: Custom-Endpunkt
- **WHEN** der Nutzer ein Custom-Preset mit eigener Base-URL anlegt
- **THEN** verwendet das Backend diese URL unverändert für Chat-Completions-Anfragen

#### Scenario: Unbekanntes Preset
- **WHEN** der Nutzer ein nicht unterstütztes Preset übergibt
- **THEN** antwortet das Backend mit 400 als ProblemDetail

### Requirement: OpenAI-kompatible Schnittstelle

Alle Presets außer Azure OpenAI MUST die OpenAI-kompatible Chat-Completions-Schnittstelle nutzen. Azure OpenAI MUST die `api-key`-Authentifizierung und den Deployment-Pfad unterstützen.

#### Scenario: Azure-Verbindung
- **WHEN** der Nutzer eine Azure-OpenAI-Verbindung anlegt
- **THEN** sendet das Backend den Key im `api-key`-Header und spricht den konfigurierten Deployment-Pfad an

#### Scenario: Preset auswählen
- **WHEN** der Nutzer das Preset „OpenAI“ wählt
- **THEN** sind Base-URL und Bearer-Auth vorausgefüllt und bleiben editierbar

#### Scenario: Lokales Modell
- **WHEN** der Nutzer eine Ollama-Verbindung ohne API-Key anlegt
- **THEN** wird die Verbindung gespeichert und kann getestet werden

#### Scenario: Custom-Endpunkt
- **WHEN** der Nutzer ein Custom-Preset mit eigener Base-URL anlegt
- **THEN** verwendet das Backend diese URL unverändert für Chat-Completions-Anfragen

#### Scenario: Unbekanntes Preset
- **WHEN** der Nutzer ein nicht unterstütztes Preset übergibt
- **THEN** antwortet das Backend mit 400 als ProblemDetail

### Requirement: Verbindung testen

Das Backend MUST über `POST /api/users/me/ai/connections/{id}/test` einen minimalen Chat-Request an die Verbindung senden und das Ergebnis melden. Bei Erfolg MUST die Antwort den verwendeten Anbieter und das Modell enthalten. Bei ungültigem Key (401/403), unbekanntem Modell oder Endpunkt (404), Rate-Limit (429) und Timeout MUST das Backend eine verständliche, anbieterneutrale Fehlermeldung als ProblemDetail liefern. Der Test DARF den Key nicht in der Antwort oder im Log offenlegen.

#### Scenario: Erfolgreicher Test
- **WHEN** der Nutzer eine korrekt konfigurierte Verbindung testet
- **THEN** meldet das Backend Erfolg mit Anbieter und Modell

#### Scenario: Ungültiger Key
- **WHEN** der Anbieter den Key mit 401 oder 403 ablehnt
- **THEN** erhält der Nutzer die Meldung, dass der API-Key abgelehnt wurde

#### Scenario: Nicht erreichbarer Endpunkt
- **WHEN** die Base-URL nicht erreichbar ist oder in ein Timeout läuft
- **THEN** erhält der Nutzer eine Meldung zu Erreichbarkeit bzw. Zeitüberschreitung

### Requirement: Modellliste laden

Das Backend MUST über `GET /api/users/me/ai/connections/{id}/models` die Modellliste des Anbieters abrufen, sofern dieser eine OpenAI-kompatible `/models`-Schnittstelle anbietet. Die Antwort MUST die Modell-IDs enthalten. Bietet der Anbieter keine Modellliste an, MUST das Backend dies als solchen Zustand melden, ohne die Verbindung unbrauchbar zu machen. Die manuelle Eingabe einer Modell-ID MUST immer möglich bleiben.

#### Scenario: Modellliste verfügbar
- **WHEN** der Nutzer für OpenRouter die Modellliste lädt
- **THEN** enthält die Antwort die vom Anbieter gemeldeten Modell-IDs

#### Scenario: Keine Modellliste
- **WHEN** der Anbieter keinen `/models`-Endpunkt anbietet
- **THEN** meldet das Backend, dass die Liste nicht verfügbar ist, und das manuell eingetragene Modell bleibt gespeichert

### Requirement: Base-URL-Sicherheit

Das Backend MUST Base-URLs vor dem Speichern und vor jeder Anfrage validieren. Erlaubt sind nur `http`- und `https`-URLs ohne Benutzerinformationen. Metadata- und Link-Local-Ziele MÜSSEN abgelehnt werden. Öffentliche Endpunkte MÜSSEN HTTPS verwenden; HTTP DARF nur für Loopback und private Netze zugelassen werden. Eine optionale Umgebungsvariable MUST eine Host-Allowlist für Mehrbenutzer-Deployments ermöglichen.

#### Scenario: Metadata-Ziel
- **WHEN** der Nutzer eine Base-URL auf ein Link-Local- oder Metadata-Ziel einträgt
- **THEN** lehnt das Backend die Verbindung mit 400 ab

#### Scenario: Öffentliches HTTP
- **WHEN** der Nutzer eine öffentliche Base-URL ohne TLS einträgt
- **THEN** lehnt das Backend die Verbindung mit 400 ab

#### Scenario: Lokaler HTTP-Endpunkt
- **WHEN** der Nutzer `http://localhost:11434/v1` für Ollama einträgt
- **THEN** wird die Verbindung akzeptiert

### Requirement: Bestehende OpenRouter-Konfiguration übernehmen

Beim Upgrade MUST das Backend vorhandene `openrouter_api_key`- und `openrouter_model`-Werte in eine Standard-Verbindung mit dem Preset OpenRouter übernehmen, sodass die Label-Erkennung ohne erneute Key-Eingabe weiterläuft. `GET` und `PUT /api/users/me/openrouter` MÜSSEN vorübergehend als Alias auf diese Verbindung weiter funktionieren.

#### Scenario: Upgrade mit vorhandenem Key
- **WHEN** ein Nutzer mit gespeichertem OpenRouter-Key die neue Version startet
- **THEN** existiert eine OpenRouter-Verbindung als Standard und die Label-Erkennung nutzt den bisherigen Key und das bisherige Modell

#### Scenario: Alter Endpunkt
- **WHEN** ein alter Client `GET /api/users/me/openrouter` aufruft
- **THEN** liefert das Backend dieselben Felder wie bisher aus der OpenRouter-Verbindung
