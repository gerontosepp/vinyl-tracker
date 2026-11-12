# Proposal: Anbieterunabhängige KI-Verbindungen (#393)

## Why

Die automatische Label-Erkennung spricht heute ausschließlich OpenRouter an: Key und Modell liegen in `app_user.openrouter_api_key` / `openrouter_model`, der Client ist auf OpenRouter-URL, Bearer-Auth und OpenRouter-Fehlertexte festgelegt. Eigene OpenAI-, Anthropic- oder Google-Keys, lokale Modelle (Ollama, LM Studio) und Gateways (LiteLLM) sind damit nicht nutzbar. Ein Anbieterwechsel erfordert heute eine Code-Änderung.

## What Changes

- **Generische Verbindungen statt OpenRouter-Spalten:** Neue Tabelle `ai_connection` mit Name, Preset (`kind`), Base-URL, Modell, verschlüsseltem Key, Auth-Stil und `is_default`. Bestehende OpenRouter-Daten werden verlustfrei als Standard-Verbindung übernommen.
- **Ein OpenAI-kompatibler Client mit Presets:** OpenRouter, OpenAI, Anthropic und Google Gemini (über deren OpenAI-kompatible Endpunkte), Groq, Mistral, DeepSeek, Together, Fireworks, Ollama, LM Studio, Azure OpenAI und Custom. Neue Anbieter brauchen nur einen Preset-Eintrag, keinen neuen Adapter.
- **Verwaltungs-API:** Verbindungen anlegen, ändern, löschen, als Standard setzen, testen und – sofern unterstützt – die Modellliste laden. Keys bleiben write-only.
- **Label-Erkennung nutzt die Standard-Verbindung:** Ohne Standard-Verbindung bleibt das bisherige Verhalten (Foto bleibt `pending`, MCP-Weg unverändert). Das Foto speichert zusätzlich den Anbieter.
- **Einstellungen in der PWA:** Die OpenRouter-Karte wird zu einer Anbieter-Verwaltung mit Preset-Auswahl, Test, Modellliste und Datenschutzhinweis.
- **Sicherheit:** Verschlüsselte Keys, Base-URL-Validierung gegen Metadata-/Link-Local-Ziele, HTTPS-Pflicht für öffentliche Endpunkte, optionale Host-Allowlist.
- **Kompatibilität:** `GET`/`PUT` auf `/api/users/me/openrouter` bleibt vorübergehend als Alias auf die OpenRouter-Verbindung erhalten.

## Capabilities

### New Capabilities

- `ai-providers`: Anbieterunabhängige KI-Verbindungen pro Nutzer (Presets, Base-URL, Modell, Key, Auth, Standard-Verbindung, Test, Modellliste, Sicherheitsregeln).

### Modified Capabilities

- `label-photo`: Die automatische Erkennung nutzt die Standard-KI-Verbindung statt fester OpenRouter-Felder und zeigt Anbieter plus Modell an.

## Impact

- **Backend:** Migration `18_add_ai_connections.sql` mit Backfill; `clients/openrouter.rs` wird zum generischen OpenAI-kompatiblen Client; neuer `AiConnectionService`, neue Routen unter `/api/users/me/ai/connections`; `LabelIdentificationService`, `LabelPhotoService`, `AppState`, `config.rs` und Fehlermeldungen werden anbieterneutral.
- **Frontend:** `OpenRouterSettingsComponent` wird durch eine Anbieter-Verwaltung ersetzt; Typen, `ApiService`, i18n (de/en), Label-Inbox-Anzeige.
- **API:** Neue Endpunkte; alter OpenRouter-Endpunkt als Alias; `label_photo.identify_provider` als neue Spalte.
- **Dokumentation:** ADR-0025, README, `docs/Help.md`/`docs/Help.en.md`, `docs/arc42.md`, `docs/Release-Info.md`, Delta-Specs.
- **Nicht im Umfang:** native Anthropic-/Gemini-Protokolle, automatische Fallback-Kette, Task-Routing, Streaming, Embeddings, Kostenanzeige, OAuth-Login.
