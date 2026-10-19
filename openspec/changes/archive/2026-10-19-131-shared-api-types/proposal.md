# Proposal: Gemeinsame API-Typen für Backend und MCP-Server (#131)

## Why
Der MCP-Server (`mcp/src/models.rs`, 741 Zeilen) pflegt eigene Kopien der Backend-Response-DTOs. 17 Typen existieren doppelt, und sie sind bereits auseinandergelaufen. Ein Feldvergleich zeigt Abweichungen, die zu **Laufzeitfehlern bzw. Datenverlust in MCP-Tools** führen:

| MCP-Tool / Ressource | Backend sendet | MCP erwartet | Folge |
|---|---|---|---|
| `sync_collection`, `add_to_collection` | `status, added, updated, removed, total` | `added_count, removed_count` (Pflichtfelder) | Deserialisierung schlägt fehl → Tool meldet Fehler, obwohl der Sync erfolgreich war |
| `get_top_records`, `vinyl://stats/overview` | `title, recordTitle, artist, thumbUrl, count` | `play_count` (Pflichtfeld) | Fehler, sobald mindestens ein Eintrag existiert |
| `scan_barcode` | `record`, `discogsMatches` | `tracked_record` | Erkannte Platte und Discogs-Vorschläge gehen still verloren |
| `get_recent_listens` | `record: TrackedRecordDto` | `record: RecordDto` (andere Felder) | Platteninformationen unvollständig |
| `get_collection_value`, `vinyl://collection/value` | `minimum/median/maximum: {currency, value}` | `minimum/median/maximum: String` | Deserialisierung schlägt fehl → Tool und Ressource liefern immer einen Fehler |

Die MCP-Tests sind grün, weil ihre Mocks das (falsche) MCP-Format verwenden – der Vertrag zum Backend wird nirgends geprüft.

## What Changes
- **Neue Crate `vinyl-api-types`** (`backend/crates/vinyl-api-types/`) mit den Request-/Response-DTOs der REST-API, die der MCP-Server konsumiert (nur `serde`, keine Abhängigkeit zu `sqlx`/`axum`).
- **Backend** importiert diese Typen statt eigener Definitionen (Re-Export aus `backend/src/models/*`, damit bestehende Pfade gültig bleiben). Das JSON-Format der API ändert sich dadurch **nicht**.
- **MCP-Server** nutzt die gemeinsamen Typen per Path-Dependency; die doppelten Definitionen in `mcp/src/models.rs` entfallen. Es bleiben nur MCP-eigene Typen (Tool-Argumente mit `JsonSchema`, Ressourcen-Typen).
- **Fehlerbehebung in MCP-Tools**: `sync_collection`/`add_to_collection` melden `added/updated/removed/total`; `get_top_records` liefert die Wiedergabeanzahl; `scan_barcode` gibt erkannte Platte und Discogs-Vorschläge zurück; `get_collection_value` liefert Werte mit Währung.
- **Vertragstests**: MCP-Tests verwenden echte, vom Backend-Typ serialisierte Antworten statt handgeschriebener Mocks.

## Capabilities

### New Capabilities
*(Keine)*

### Modified Capabilities
- `mcp`: Neue Anforderung „API-Vertrag zwischen MCP-Server und Backend“ (konsistente Tool-Ergebnisse für Sync, Top-Platten, Scan).

## Impact
- **Backend**: `backend/Cargo.toml` (Path-Dependency), `backend/src/models/*` (Typen wandern in die Crate, Re-Exports bleiben). Docker-Build-Kontext `./backend` bleibt unverändert, da die Crate unterhalb von `backend/` liegt.
- **MCP**: `mcp/Cargo.toml` (Path-Dependency `../backend/crates/vinyl-api-types`), `mcp/src/models.rs`, `mcp/src/server.rs`, `mcp/src/client.rs`, Tests.
- **CI/Release**: Keine Pfadänderungen nötig (Checkout enthält das gesamte Repo); `rust-cache` des MCP-Jobs berücksichtigt die neue Crate automatisch über `Cargo.lock`.
- **Kein Einfluss** auf Frontend, Datenbank oder das JSON-Format der REST-API.

## Out of Scope
- Vereinheitlichung der uneinheitlichen JSON-Feldnamen der API (teils `camelCase`, teils `snake_case`) – das wäre eine Breaking Change für das Frontend.
- Generierung von TypeScript-Typen für das Frontend aus der Crate.
- Gemeinsamer Cargo-Workspace über Backend und MCP.
