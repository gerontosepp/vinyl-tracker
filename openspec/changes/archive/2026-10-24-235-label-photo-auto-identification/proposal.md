# Proposal: Plattenerkennung per Label-Foto direkt in der App (#235)

## Why

Die Label-Erkennung läuft bisher nur über den MCP-Prompt `process_label_inbox` in Claude Desktop/Code. Die App soll fotografierte Labels selbst erkennen und den Treffer zur Bestätigung vorlegen.

## What Changes

- OpenRouter-API-Key (verschlüsselt) und Modell pro Nutzer: `GET`/`PUT /api/users/me/openrouter`.
- Nach dem Upload erkennt das Backend das Foto im Hintergrund mit einem Vision-Modell über OpenRouter; nur lesende Tools (`search_discogs`, `get_record_details`, `submit_identification`), vorgeschlagene IDs müssen aus Tool-Ergebnissen stammen.
- `label_photo` speichert Zustand (`queued`/`running`/`done`/`error`), Vorschlag (JSONB), Fehler und Modell (Migration 13); `POST /api/label-photos/{id}/identify` stellt erneut ein.
- Label-Inbox: Vorschlagskarte mit Alternativen, Hinzufügen (mit Regalplatz), Nur abschließen, Erneut erkennen; Aktualisierung während der Erkennung.
- Gemeinsame Leseanleitung `LABEL_READING_STEPS` für MCP-Prompts und Backend.

Nicht im Umfang: Kostenanzeige pro Foto, Erkennung ohne Discogs-Token.

## Capabilities

### Modified Capabilities
- `label-photo`: automatische Erkennung in der App.

## Impact

- Backend: Migration `13_add_label_identification.sql`, `clients/openrouter.rs`, `LabelIdentificationService`, `OpenRouterSettingsService`, Routen, `AppState`.
- Frontend: Einstellungen (`OpenRouterSettingsComponent`), Label-Inbox (`LabelPhotoCardComponent`), Scanner-Toast, Übersetzungen.
- MCP: Prompts nutzen `LABEL_READING_STEPS`.
