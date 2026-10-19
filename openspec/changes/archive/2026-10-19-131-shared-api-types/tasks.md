# Tasks

## 1. Crate anlegen

- [x] 1.1 `backend/crates/vinyl-api-types/` mit `Cargo.toml` (edition 2024, `serde`) und Modulstruktur `analytics`, `collection`, `discogs`, `record`, `roon`, `scan`, `user` anlegen
- [x] 1.2 Vom MCP-Server genutzte Backend-DTOs inkl. transitiver Feldtypen 1:1 (Attribute unverändert) in die Crate verschieben; `LoginRequestDto` und `RoonPlayResponseDto` um fehlende `Serialize`/`Deserialize`-Derives ergänzen
- [x] 1.3 Roundtrip-Tests für Typen mit `rename`-Attributen (JSON-Feldnamen festschreiben)

## 2. Backend umstellen

- [x] 2.1 Path-Dependency in `backend/Cargo.toml`; verschobene Definitionen in `backend/src/models/*` durch `pub use vinyl_api_types::…` ersetzen
- [x] 2.2 Backend-Pflicht-Checks: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `cargo llvm-cov --fail-under-lines 80`
- [x] 2.3 Docker-Image des Backends bauen (Build-Kontext `./backend` unverändert)

## 3. MCP-Server umstellen

- [x] 3.1 Path-Dependency `../backend/crates/vinyl-api-types` in `mcp/Cargo.toml`
- [x] 3.2 Doppelte Response-Typen aus `mcp/src/models.rs` entfernen; `client.rs` auf die gemeinsamen Typen umstellen
- [x] 3.3 Tool- und Ressourcen-Ausgaben in `server.rs` korrigieren (`sync_collection`, `add_to_collection`, `get_top_records`, `scan_barcode`, `get_collection_value`, `vinyl://collection/value`, `vinyl://stats/overview`)
- [x] 3.4 Mock-Server-Testhilfe (`axum` als `dev-dependency`) anlegen; Vertragstests für die fünf betroffenen Tools über `VinylApiClient` mit vom Backend-Typ serialisierten Antworten
- [x] 3.5 MCP-Checks: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` in `mcp/`

## 4. Verifikation

- [x] 4.1 MCP-Server gegen das lokal laufende Backend starten und `sync_collection`/`get_top_records`/`get_collection_value`/`scan_barcode` per JSON-RPC über stdio aufrufen
  *Ergebnis:* Vorher-/Nachher-Vergleich mit dem alten Release-Binary und einem temporären Testbenutzer (danach gelöscht): `get_top_records`, `vinyl://stats/overview` und `scan_barcode` (Platte) sind behoben. `sync_collection` und `get_collection_value` benötigen ein verbundenes Discogs-Konto und wurden live nur bis zur Backend-Fehlermeldung geprüft; ihr Erfolgsfall ist durch die Vertragstests abgedeckt.
- [x] 4.2 Release-Build des MCP-Servers (`cargo build --release` in `mcp/`) prüfen

## 5. Dokumentation

- [x] 5.1 README (MCP-Abschnitt, Projektstruktur) und arc42 (Bausteinsicht: neue Crate) aktualisieren
- [x] 5.2 `docs/Release-Info.md` unter „Unreleased“ (inkl. Hinweis: MCP-Binary und Backend müssen aus derselben Version stammen), `node scripts/sync-release-info.js`
