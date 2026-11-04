## 1. Backend

- [x] 1.1 Migration `17_add_want_to_have_item.sql` (Tabelle, `UNIQUE (user_id, discogs_id)`, Index auf `user_id`)
- [x] 1.2 Modell/DTOs (`vinyl-api-types`) und `want_to_have_service.rs` (Liste, Hinzufügen mit Duplikatprüfung, Entfernen, Übernahme transaktional)
- [x] 1.3 Route `want_to_have.rs` (`GET/POST /api/want-to-have`, `DELETE /{id}`, `POST /{id}/to-collection`), Registrierung in `routes/mod.rs`, ProblemDetail-Fehler (404/409)
- [x] 1.4 Besessene Platten aus der Liste ausblenden, Übernahme beansprucht den Eintrag atomar
- [x] 1.5 Backend-Tests (Service + Routen: Nutzertrennung, 409, 404, Übernahme-Rollback) – `cargo fmt`, `cargo test`, `cargo clippy -D warnings`

## 2. Frontend

- [x] 2.1 `ApiService`-Methoden und Modelle für Want-to-Have
- [x] 2.2 Seite `features/want-to-have` (Liste, Leer-Zustand), Route `/want-to-have`, Navigationseintrag
- [x] 2.3 Detailansicht ohne Bestandsfelder mit „In Bestand übernehmen“, „Aus Want-to-Have entfernen“, Roon-Zone + Abspielen ohne Listen-Log
- [x] 2.4 Button „Zu Want-to-Have“ / Hinweise in Label-Inbox und Discogs-Suche
- [x] 2.5 i18n-Keys de/en, Tooltips für Icon-Buttons
- [x] 2.6 Vitest-Tests (Komponenten, Service, Roon-Play ohne Log), Coverage ≥ 80 %, `npm run build`

## 3. Docs & Abschluss

- [x] 3.1 `docs/Help.md` + `docs/Help.en.md`, `README.md`, `docs/Release-Info.md` (Unreleased), `docs/arc42.md` (Schema)
- [x] 3.2 `openspec/specs/` prüfen (label-photo, collection, roon) und Delta-Specs konsistent halten
- [ ] 3.3 Code-Review (`code-review`, effort `high` wegen Migration/neuer Endpunkte), lokalen Docker-Stack aktualisieren, PR mit `Closes #310`
