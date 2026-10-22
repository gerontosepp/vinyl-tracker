# Proposal: Eigener Sortier-String pro Platte (#213)

## Why

Die automatische Regal-Sortierung (Künstler ohne führenden Artikel, dann Jahr und Titel) passt nicht immer zur physischen Ablage: *Les Paul* soll unter **L** stehen, ein Soloalbum neben der Band, ein Sampler unter einem Stichwort. Der Nutzer soll den Sortier-String in der Detailansicht einer Platte selbst festlegen können.

## What Changes

- Neue Spalte `collection_item.sort_key` (Migration 12). Der Wert gilt pro Nutzer für alle Exemplare eines Releases.
- Der Sortier-String ersetzt beim Sortieren den automatischen Künstler-Schlüssel (Groß-/Kleinschreibung egal); Jahr und Titel bleiben nachrangige Kriterien. Das gilt für die Künstler-Sortierung der Sammlung und für die Regalbelegung.
- `PATCH /api/records/{id}/sort-key` mit `{ "sort_key": "…" }` setzt den Wert, `null` oder ein leerer String setzt ihn zurück (max. 200 Zeichen). Antwort: Album-Details.
- Album-Details (`RecordDetailDto`) liefern `sort_key` (eigener Wert) und `default_sort_key` (automatischer Schlüssel).
- Detailansicht: Eingabefeld „Sortierung“ mit dem automatischen Schlüssel als Platzhalter, Speichern und Zurücksetzen.
- JSON-Backup exportiert und stellt `sort_key` wieder her (optionales Feld, `format_version` bleibt 3).

Nicht im Umfang: MCP-Tool zum Setzen, Sortier-String pro Künstler statt pro Platte.

## Capabilities

### Modified Capabilities
- `collection`: eigener Sortier-String pro Platte.

## Impact

- Backend: Migration `12_add_sort_key_to_collection_item.sql`, `SHELF_ARTIST_KEY_SQL`, `RecordService`, Route `records`, Backup (Export/Restore), DTOs in `vinyl-api-types`.
- Frontend: Detail-Dialog, `ApiService`, Typen, Übersetzungen, Neuladen der Sammlung nach Änderung.
