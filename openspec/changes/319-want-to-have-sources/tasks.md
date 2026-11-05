## 1. Backend

- [x] 1.1 DTOs in `vinyl-api-types` (`PurchaseSourcesDto`, `VinylVersionDto`, `MarketplaceStatsDto`, `ShopLinkDto`)
- [x] 1.2 `DiscogsRelease.master_id`, Modelle für Master-Versionen und Marktplatz-Kennzahlen
- [x] 1.3 Discogs-Client: `get_master_versions`, `get_marketplace_stats`, `try_get_marketplace_stats_nonblocking`, 404/429-Abbildung, zwei Caches
- [x] 1.4 `purchase_sources.rs` (Shop-Links, Versionsliste, Kennzahlen-DTO)
- [x] 1.5 `WantToHaveService::sources` / `version_stats`, Routen `/{id}/sources` und `/{id}/sources/{release_id}/stats`
- [x] 1.6 Backend-Tests (Client, Hilfsfunktionen, Service/Routen) – `cargo fmt`, `cargo test`, `cargo clippy -D warnings`

## 2. MCP

- [x] 2.1 Client-Methoden und Tool `get_want_to_have_sources` (`id`, optional `release_id`)
- [x] 2.2 Contract-Tests

## 3. Frontend

- [x] 3.1 Typen und `ApiService`-Methoden
- [x] 3.2 Komponente `purchase-sources` (aufklappbar, Versionsliste, Shop-Chips, „Preis laden“, Fehler/Retry)
- [x] 3.3 Einbindung in `record-detail-modal` (nur `wantToHave`) und Want-to-Have-Seite
- [x] 3.4 i18n-Keys de/en
- [x] 3.5 Vitest-Tests, Coverage ≥ 80 %, `npm run build`

## 4. Docs & Abschluss

- [x] 4.1 `docs/Help.md` + `docs/Help.en.md`, `README.md`, `docs/Release-Info.md` (Unreleased), `docs/arc42.md`, `backend/CLAUDE.md`
- [x] 4.2 Delta-Specs für `want-to-have` und `mcp` (Haupt-Specs folgen beim Archivieren)
- [ ] 4.3 Code-Review (`code-review`, effort `high` wegen neuer Endpunkte und MCP-Vertrag), lokalen Docker-Stack aktualisieren, PR mit `Closes #319`
