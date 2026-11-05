## Why

Wer eine Platte vorgemerkt hat, will sie irgendwann kaufen. Dafür muss man bisher selbst bei Discogs und in Shops suchen – und dabei auch erkennen, welche der vielen Pressungen (Erstpressung, Reissues, Länder, Farben) überhaupt infrage kommen. Die Detailansicht soll Bezugsquellen für **alle Vinyl-Versionen** der Platte zeigen.

## What Changes

- Neuer Abschnitt **Bezugsquellen** im Detail einer Want-to-Have-Platte: alle Vinyl-Versionen des Discogs-Masters (die vorgemerkte hervorgehoben), je Version günstigster Discogs-Preis, Anzahl Angebote und Link zum Marktplatz; dazu Suchlinks zu Shops (Discogs, eBay, Amazon, JPC, HHV).
- Neue Endpunkte `GET /api/want-to-have/{id}/sources` und `GET /api/want-to-have/{id}/sources/{release_id}/stats`.
- Discogs-Client: Master-Versionen (`/masters/{id}/versions`), Marktplatz-Kennzahlen (`/marketplace/stats/{id}`), Fehlerabbildung 404/429, zwei neue Caches.
- Neues MCP-Tool `get_want_to_have_sources`.
- Die Detailansicht darf weiterhin keinen „Geschätzten Wert“ zeigen; Angebotspreise sind kein Schätzwert.

Nicht Teil dieser Änderung: Preise in der Listenansicht, einzelne Angebote anderer Verkäufer (die Discogs-API liefert nur Kennzahlen), eBay-API, Preisbenachrichtigungen.

## Capabilities

### Modified Capabilities
- `want-to-have`: Abschnitt „Bezugsquellen“ in der Detailansicht, zwei Endpunkte, MCP-Zugriff.
- `mcp`: neues Tool `get_want_to_have_sources`.

## Impact

- Backend: `clients/discogs.rs`, `models/discogs.rs` (`master_id`), neues `services/purchase_sources.rs`, `want_to_have_service.rs`, `routes/want_to_have.rs`, DTOs in `vinyl-api-types`. Keine Migration.
- Frontend: neue Komponente `shared/components/purchase-sources`, `record-detail-modal`, `ApiService`, i18n (de/en).
- MCP: `client.rs`, `server.rs`, `models.rs`.
- Docs/Specs: Help (de/en), README, Release-Info, arc42, `backend/CLAUDE.md`, `openspec/specs/`.
