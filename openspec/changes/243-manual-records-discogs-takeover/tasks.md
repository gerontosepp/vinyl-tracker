# Tasks

## 1. Datenbank und Alias-Auflösung

- [x] 1.1 Migration `backend/migrations/15_add_manual_record_alias.sql` mit Tabelle `manual_record_alias` (design.md, Entscheidung 3) anlegen; prüfen, dass `cargo test` die Migration auf frischer und bestehender DB anwendet
- [x] 1.2 `scan_service.rs`: Bei negativer QR-ID nach der manuellen Platte den Alias (`user_id` + `instance_id` → `collection_item`) auflösen und ein Hör-Ereignis erfassen; Integrationstests für „Alias trifft“, „Alias ins Leere“ und „fremder Nutzer“ grün

## 2. Kandidatensuche

- [x] 2.1 Release-Upsert (`record_cache` + Genres) aus `CollectionSyncService::add_release_and_sync` in eine Funktion mit `&mut Transaction` auslagern, ohne Verhaltensänderung; bestehende Sync-Tests bleiben grün
- [x] 2.2 `manual_takeover_service.rs` mit `candidates()` anlegen: bis zu drei Suchen, Zusammenführen nach Release-ID, Limit 10, `in_collection` je Kandidat; Unit-/Integrationstests mit gemocktem Discogs (wiremock) für Barcode-Treffer, leere Felder (Suche übersprungen), Duplikate und keinen Treffer
- [x] 2.3 Route `GET /api/records/{id}/discogs-candidates` mit 404 für Discogs-Platten oder fremde Platten und 400 ohne Token; DTO in `vinyl-api-types`; Routen-Tests grün

## 3. Übernahme

- [x] 3.1 `takeover()` für `new_copy` gemäß design.md, Entscheidung 2 (Discogs hinzufügen, eine Transaktion, Kompensation per `delete_release_instance`); Integrationstest prüft erhaltene Hör-Ereignisse, Zustände, `sort_key`, umgeschriebene `storage_boundary`, Alias, gelöschtes Cover und gelöschte manuelle Zeile
- [x] 3.2 `takeover()` für `merge` (Ziel-Exemplar, 400 ohne bzw. bei mehrdeutigem Ziel, kein Discogs-Aufruf); Integrationstest prüft die zusammengeführte Hör-Historie und den Alias auf das vorhandene Exemplar
- [x] 3.3 Fehlerpfade testen: Discogs-Hinzufügen schlägt fehl (Platte bleibt manuell); Fehler nach dem Hinzufügen – getestet über einen fehlschlagenden Release-Abruf, der denselben Kompensationspfad wie ein DB-Fehler nimmt (Exemplar wird bei Discogs wieder gelöscht); Release bereits im geteilten Cache eines anderen Nutzers (kein Konflikt)
- [x] 3.4 Best-Effort-Nachlauf: Zustände in die Discogs-Felder schreiben und Preis abfragen; Fehler werden nur geloggt; Test: die Platte trägt den Discogs-Preis, ein Fehler im Nachlauf lässt die Übernahme bestehen
- [x] 3.5 Route `POST /api/records/{id}/takeover` mit Antwort inklusive Platzierung (`StorageService::commit_all`); Routen-Tests für beide Modi; Test: ein anschließender Discogs-Sync (gemockt) erzeugt kein Duplikat
- [x] 3.6 ADR-0023 um einen Nachtrag „Übernahme nach Discogs“ ergänzen und arc42 (Schema: `manual_record_alias`, neue Endpunkte) aktualisieren

## 4. Backup

- [x] 4.1 `BACKUP_FORMAT_VERSION = 5` mit `manual_aliases` im Export; Restore trägt Aliase per Upsert ein, Versionen 3 und 4 bleiben lesbar; Roundtrip-Test und Test mit einem v4-Backup grün

## 5. Frontend

- [x] 5.1 API-Service-Methoden und Typen für Kandidaten und Übernahme; Unit-Tests mit `HttpTestingController`
- [x] 5.2 `record-detail-modal`: Button „Bei Discogs prüfen“ (nur bei manuellen Platten), Kandidatenliste in der Darstellung der Label-Inbox mit Hinweis „bereits in der Sammlung“ sowie Meldungen für „Kein Treffer“ und „Kein Discogs-Token“; Komponententests grün
- [x] 5.3 Bestätigungsdialog: Standard „Zweites Exemplar“; „Zusammenführen“ nur, wenn der Release in der Sammlung ist, mit Zielauswahl bei mehreren Exemplaren und Hinweis auf verlorene Felder; nach Erfolg Detail und Sammlung neu laden und die Platzierung anzeigen; Komponententests für beide Modi und den Fehlerfall
- [x] 5.4 „Bei Discogs eintragen“: Link auf `https://www.discogs.com/release/add` (neuer Tab) und „Daten kopieren“ (Clipboard); Komponententest prüft den kopierten Text
- [x] 5.5 Übersetzungen (de/en) und In-App-Hilfe zu manuellen Platten ergänzen; `npm run lint` und `npm test` ohne neue Fehler

## 6. MCP

- [x] 6.1 Client-Methoden und Tools `create_manual_record`, `check_manual_record`, `take_over_manual_record` in `mcp/src/server.rs` (mit Bestätigungshinweis in der Beschreibung); Prompts zur Label-Erkennung bieten `create_manual_record` an; Vertragstests in `mcp/src/server/contract_tests.rs` grün
- [x] 6.2 `mcp/README.md` um die neuen Tools ergänzen

## 7. Abschluss

- [ ] 7.1 README und `docs/Release-Info.md` aktualisieren; Issue #243 auf den reduzierten Umfang (keine automatische Prüfung) anpassen
- [ ] 7.2 Gesamtprüfung: `cargo clippy --all-targets -- -D warnings`, `cargo llvm-cov --summary-only --fail-under-lines 80`, Frontend-Tests; lokalen Docker-Stack neu bauen und eine manuelle Platte end-to-end übernehmen (Prüfen → Übernehmen → altes QR-Etikett scannen)

## Workflow follow-up

- Etappe 1 (`242-manual-records`) vorher archivieren, damit die Delta-Spezifikationen von #242 in `openspec/specs/collection` landen.
- Nach Merge die Änderung archivieren (`/opsx-archive`).
