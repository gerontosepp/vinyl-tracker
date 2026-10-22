# Proposal: Plattenerkennung per Label-Foto über MCP (#208)

## Why

Ältere Platten haben oft keinen Barcode, der Barcode-Scan greift dann nicht. Claude kann eine Pressung anhand eines Fotos des Platten-Labels (Künstler, Titel, Label, Katalognummer, Land, Jahr, Matrix) identifizieren. Die Erkennung soll ohne Anthropic API-Key über das Claude-Abo laufen – in Claude Desktop/Code mit dem angebundenen MCP-Server.

## What Changes

- **Strukturierte Discogs-Suche**: `GET /api/discogs/search` und das MCP-Tool `search_discogs` akzeptieren zusätzlich `catno`, `label`, `artist`, `release_title`, `year`, `country`, `format`. Der Freitext `query` wird optional, solange mindestens ein Filter gesetzt ist.
- Suchergebnisse enthalten die **Labels**, Release-Details die **Identifiers** (Matrix/Runout, Label Code, Rights Society) und die Release-Notizen.
- **MCP-Prompt `identify_record_from_label`**: geführter Ablauf Label lesen → strukturiert suchen → Kandidaten prüfen → Bestätigung → hinzufügen bzw. als gehört loggen.
- **Label-Inbox**: Auf der Scanner-Seite der PWA lässt sich ein Label fotografieren. Das Backend speichert das Foto verkleinert (≤ 1568 px, JPEG, ohne EXIF) in `label_photo`. Das MCP-Tool `get_label_inbox` liefert offene Fotos als Bild-Inhalt an Claude, `resolve_label_photo` schließt sie ab, der Prompt `process_label_inbox` arbeitet die Inbox ab.

Nicht im Umfang: Aufruf der Claude API aus dem Backend, Remote-MCP (HTTP-Transport) für die Claude-Mobile-App, Verwaltungsansicht der Inbox in der PWA.

## Capabilities

### New Capabilities
- `label-photo`: Label-Fotos aufnehmen, speichern und über MCP abarbeiten.

### Modified Capabilities
- `mcp`: strukturierte Discogs-Suche, neue Tools `get_label_inbox` / `resolve_label_photo`, neue Prompts.

## Impact

- Backend: Migration `11_create_label_photo.sql`, `LabelPhotoService`, Route `/api/label-photos`, Discogs-Client (`DiscogsSearchFilter`), DTOs in `vinyl-api-types`.
- Frontend: Scanner-Komponente (Button „Label fotografieren“, Badge offener Fotos), `ApiService`, Übersetzungen.
- MCP: `search_discogs`-Argumente, zwei Tools, zwei Prompts, Abhängigkeit `base64`.
