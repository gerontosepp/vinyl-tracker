# Tasks

## 1. Backend: Modul-Grundgerüst & Datenbeschaffung

- [x] 1.1 `services/print/` anlegen (`mod.rs`, `layout.rs`): `PrintTemplate` (kebab-case, `avery-3474` | `scan-list` | `qr-cards`), `PrintScope` (`all` | `filter` | `ids`), `PrintOptions` (`language` de/en, `start_position`), `PrintRecord`, Trait `PrintRenderer`; Unit-Tests für Deserialisierung und Validierung (unbekannte Vorlage, Startposition 0/25, > 5 000 IDs → 400) mit `cargo test --lib print`
- [x] 1.2 Layout-Helfer aus `qr_pdf_service` nach `layout.rs` verschieben und erweitern (Kürzen auf max. 2 Zeilen mit „…“, QR-Rasterbild, Text-/Rechteck-Ops, `Labels` de/en); Unit-Tests für Zeilenumbruch und Kürzen inkl. Umlauten
- [x] 1.3 `PrintService::load_records` über `CollectionQueryService::get_collection_for_export` (Künstler-Sortierung als Standard, Filter-Umfang, ID-Einschränkung, ein Eintrag je Exemplar, leerer Umfang → 400); Integrationstests in `backend/tests/print_tests.rs`

## 2. Backend: Vorlagen

- [x] 2.1 `qr_cards.rs`: bisheriges Layout aus `qr_pdf_service` übernehmen; bestehende Tests (Überschrift, 9 pro Seite, Paginierung) dorthin verschieben und grün halten
- [x] 2.2 `avery.rs`: 3×8-Raster 70×37 mm, oberer Rand 0,5 mm, Innenabstand 4 mm, QR 24 mm, Titel/Künstler je max. 2 Zeilen, ID; Startposition. Unit-Tests: 25 Platten → 2 Seiten; Startposition 23 mit 3 Platten → 2 Seiten; Positionsberechnung für Etikett 1, 3, 4, 24 liegt im Raster; keine Seitenüberschrift im PDF-Text
- [x] 2.3 `scan_list.rs`: Kopf mit Titel/Datum/Anzahl, Spaltenköpfe je Seite, Zeilen mit QR 18 mm, „Seite x von y“, de/en. Unit-Tests: Seitenanzahl bei 1/10/11/25 Platten, Spaltenköpfe und Seitenzahl in beiden Sprachen im PDF-Text
- [x] 2.4 Test: Titel mit Umlauten und nicht-lateinischen Zeichen erzeugt in allen drei Vorlagen ein gültiges PDF (`%PDF`, per `lopdf` ladbar)

## 3. Backend: API

- [x] 3.1 `routes/print.rs`: `POST /api/print` (Auth, JSON-Body, PDF-Antwort mit `Content-Disposition: attachment; filename="vinyl_<vorlage>.pdf"`), unter `/api/print` einhängen, `/api/print` in `LONG_RUNNING_PATHS` aufnehmen; Integrationstests: 401, 400 (Vorlage, Startposition, leerer Umfang), 200 je Vorlage und Umfang
- [x] 3.2 Alte Routen `/api/collection/qr-codes/all|selected`, `QrCodeRequest`/`QrCodeItem` (Backend) und `qr_pdf_service.rs` entfernen; `cargo fmt --all -- --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` und `cargo llvm-cov --summary-only --fail-under-lines 80` grün
- [x] 3.3 ADR „Druck-Modul mit Vorlagen-Renderern“ in `docs/adr/` anlegen, in `docs/adr/README.md` und arc42 Abschnitt 9 verlinken; arc42 Services-Liste und Laufzeitszenarien 6.3/6.6 auf `POST /api/print` aktualisieren

## 4. Frontend

- [x] 4.1 Typen (`PrintTemplate`, `PrintScope`, `PrintRequest`) und `ApiService.print()` (Blob); `downloadQrCodes`/`downloadQrCodesSelected` entfernen; `npx ng build` ohne TS-Fehler
- [x] 4.2 `shared/components/print-dialog`: Vorlagenwahl, Umfang (je nach Kontext), Start-Etikett 1–24 nur bei Etiketten, Hinweis „mit 100 % drucken“, Ladezustand, Download, Fehler-Toast bei offenem Dialog; Übersetzungen DE/EN; Vitest-Tests für Request-Aufbau je Umfang/Vorlage, Validierung der Startposition, Erfolg und Fehler
- [x] 4.3 Sammlung: Toolbar-Button öffnet den Dialog (Auswahl → „Auswahl“, sonst „aktuelle Filter“ mit den aktuellen Filter-Signalen); Tests in `collection.component.spec.ts` / Toolbar-Spec anpassen
- [x] 4.4 Einstellungen: QR-Button öffnet den Dialog mit „ganze Sammlung“, `window.confirm` entfällt; Tests in `settings.component.spec.ts` anpassen
- [x] 4.5 `npm test -- --watch=false --coverage` (≥ 80 %) und `npm run build` grün; E2E-Specs auf den neuen Dialog prüfen und ggf. anpassen

- [x] 4.6 CDs bei Etiketten: Auswahl merkt sich ihre CDs, Dialog zählt die CDs im Umfang (Filter/ganze Sammlung über die Sammlungsabfrage mit Kategorie „CDs“) und bietet „CDs auslassen“ (voreingestellt; Auswahl ohne CD-IDs bzw. Filter auf „Platten“) oder „Auch die CDs drucken“; Vitest-Tests für alle Umfänge, nur CDs, laufende/fehlgeschlagene Zählung und andere Vorlagen

## 5. Dokumentation & Abnahme

- [x] 5.1 README (Feature-Liste: Druck-Modul statt QR-Export), `docs/Release-Info.md` unter „Unreleased“ inkl. Hinweis auf entfallene QR-Endpunkte, `node scripts/sync-release-info.js`
- [x] 5.2 Manuelle Abnahme im lokalen Stack: je Vorlage ein PDF erzeugen; Avery-PDF mit 100 % auf Normalpapier drucken und gegen einen Avery-3474-Bogen halten (Ränder, Raster, Innenabstand); QR-Code eines Etiketts und der Scan-Liste mit dem Scanner erfolgreich lesen

## Workflow follow-up

- PR gegen `develop` mit `Closes #157` und `Closes #56`; Merge nur auf ausdrückliche Anweisung.
- OpenSpec-Change nach dem Merge in einem separaten PR archivieren.
