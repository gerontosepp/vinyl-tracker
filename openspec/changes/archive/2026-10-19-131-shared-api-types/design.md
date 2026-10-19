# Design: Gemeinsame API-Typen für Backend und MCP-Server

## Context
- Backend (`backend/`, Crate `backend-rs`) definiert DTOs in `backend/src/models/{analytics,collection,discogs,record,roon,scan,user}.rs`. Einige davon dienen gleichzeitig zur Deserialisierung von Discogs-Antworten (`DiscogsFormat`, `DiscogsTrack`, …) und sind über `BasicInformation`/`RecordDetailDto` Teil der eigenen REST-Antworten.
- MCP-Server (`mcp/`, Crate `vinyl-mcp-server`) definiert in `mcp/src/models.rs` 17 gleichnamige Kopien plus abweichend benannte Varianten (`CollectionValueDto` ↔ `CollectionValueResponse`, `RoonPlayResponse` ↔ `RoonPlayResponseDto`, `Pagination` ↔ `DiscogsPagination`, `Artist`/`TrackDto`/`FormatDto`/`LabelDto` ↔ `Discogs*`), teils mit tolerierenden `alias`-Attributen und `Option`-Feldern.
- Backend wird per Docker mit Build-Kontext `./backend` gebaut; der MCP-Server wird in CI (`working-directory: ./mcp`) und in `release.yml` aus vollständigem Checkout gebaut.
- Nur `AppUser` nutzt `sqlx::FromRow`; Inherent-`impl`-Blöcke existieren nur für `AppUser` und `ParsedCollectionFilter` – beide bleiben im Backend.

## Goals / Non-Goals

**Goals:**
- Eine einzige Definition jedes Request-/Response-Typs, den der MCP-Server gegen die REST-API verwendet.
- Unverändertes JSON-Format der REST-API (Frontend unberührt).
- Vertragstests, die echte Backend-Serialisierungen durch den MCP-Client laufen lassen.

**Non-Goals:**
- Umbenennung von JSON-Feldern, gemeinsamer Cargo-Workspace, TypeScript-Generierung.

## Decisions

1. **Ort der Crate: `backend/crates/vinyl-api-types/`**
   Liegt innerhalb des Docker-Build-Kontexts des Backends → `backend/Dockerfile` und alle Compose-Dateien bleiben unverändert. Der MCP-Server referenziert sie per `path = "../backend/crates/vinyl-api-types"`.
   *Alternative:* `crates/` im Repo-Root mit Build-Kontext `.` für das Backend – erfordert Änderungen an Dockerfile, drei Compose-Dateien und dem Publish-Job; kein Mehrwert für dieses Ziel.
   *Alternative:* Gemeinsamer Workspace – verschiebt `target/`-Pfade (Release-Workflow, Caches) und ist hier nicht nötig.

2. **Inhalt der Crate**
   Nur `serde`-Typen (Abhängigkeiten: `serde`, `serde_json` nur für Tests). Module spiegeln die Backend-Struktur: `analytics`, `collection`, `discogs`, `record`, `roon`, `scan`, `user`. Aufgenommen werden alle Typen, die der MCP-Server sendet oder empfängt, plus deren transitive Feldtypen. Backend-interne Typen (`AppUser`, `ParsedCollectionFilter`, `CollectionQueryParams`, Discogs-Folder-/Feld-Typen nur für den Discogs-Client) bleiben im Backend.
   Typen, die bisher nur `Deserialize` bzw. nur `Serialize` ableiten (`LoginRequestDto`, `RoonPlayResponseDto`), erhalten beide Derives, damit sie in beide Richtungen nutzbar sind.

3. **Backend-Integration per Re-Export**
   `backend/src/models/<modul>.rs` ersetzt die verschobenen Definitionen durch `pub use vinyl_api_types::<modul>::{…};`. Bestehende Importpfade (`crate::models::scan::TrackedRecordDto`) bleiben gültig → minimaler Diff in Routes/Services.

4. **MCP-Integration**
   `mcp/src/models.rs` behält nur MCP-eigene Typen: Tool-Argumente (`*Args`, mit `schemars::JsonSchema`) und `CollectionSummaryResource`. Response-Typen kommen aus `vinyl_api_types`. MCP-eigene Duplikate mit abweichendem Namen (`CollectionValueDto`, `RoonPlayResponse`, `RecordDto`, `Pagination`, `Artist`, `TrackDto`, `FormatDto`, `LabelDto`) entfallen zugunsten der Backend-Typen.
   Tool-Ausgaben in `server.rs` werden an die korrekten Felder angepasst (z. B. `Sync completed: {added} added, {updated} updated, {removed} removed ({total} total)`).

5. **Vertragstests**
   Im MCP-Crate: Tests, die Antworten mit den Typen aus `vinyl-api-types` erzeugen und über einen lokalen Mock-HTTP-Server an `VinylApiClient` ausliefern, für `sync_collection`, `get_top_records`, `scan_barcode`, `get_collection_value`. Bisher deserialisieren die MCP-Tests nur handgeschriebenes JSON – das Mock-Server-Muster ist neu und wird analog zu den Discogs-Client-Tests im Backend mit `axum` als `dev-dependency` umgesetzt. Die bisherigen handgeschriebenen JSON-Tests in `mcp/src/models.rs` entfallen mit den Typen bzw. wandern als Roundtrip-Tests in die Crate. In der Crate selbst: Roundtrip-Tests (serialisieren → deserialisieren) für Typen mit `rename`-Attributen, um das JSON-Format festzuschreiben.

6. **Nachtrag aus der Umsetzung: Crate als Workspace-Mitglied des Backends**
   `backend/Cargo.toml` erhält `[workspace] members = ["crates/vinyl-api-types"]` und `default-members = [".", "crates/vinyl-api-types"]`. Ohne das würden `cargo test`, `clippy` und `llvm-cov` im Backend die Tests der Crate nicht ausführen (Path-Dependencies werden nicht mitgetestet). Der Non-Goal „gemeinsamer Workspace über Backend und MCP“ bleibt bestehen. Die CI prüft die Formatierung deshalb mit `cargo fmt --all -- --check`.
   Zusätzlich nutzt der MCP-Client die gemeinsamen Request-Typen (`ScanRequest`, `RoonPlayRequestDto`, `UpdateConditionRequestDto`, `LoginRequestDto`) statt `serde_json::json!`-Payloads; `get_genre_breakdown` liefert `Vec<GenreBreakdownItem>` statt `serde_json::Value`.

## Risks / Trade-offs

- **[Strengere Deserialisierung im MCP]** Die bisherigen `Option`-Felder/`alias`-Attribute tolerierten Abweichungen; die gemeinsamen Typen sind exakt. → Genau das ist gewollt (Vertragsfehler werden sichtbar), betrifft aber nur MCP und Backend aus demselben Repo-Stand. Ein MCP-Binary muss zur Backend-Version passen – im Release-Hinweis erwähnen.
- **[Versehentliche API-Änderung beim Verschieben]** → Typen werden 1:1 verschoben (Attribute unverändert); Roundtrip-Tests plus bestehende Backend-Integrationstests sichern das JSON-Format ab.
- **[MCP-Build ohne Backend-Verzeichnis]** Wer `mcp/` isoliert kopiert, kann nicht mehr bauen. → Akzeptiert; Builds erfolgen immer aus dem vollständigen Repo.
