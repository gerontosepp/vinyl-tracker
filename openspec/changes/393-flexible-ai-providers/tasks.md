# Tasks

## 1. Datenmodell & Migration

- [ ] 1.1 Migration `18_add_ai_connections.sql` anlegen: Tabelle `ai_connection` (Name, `kind`, `base_url`, `model`, verschlüsselter Key, `auth_style`, `extra_headers` JSONB, `is_default`, Zeitstempel), partieller Unique-Index für genau eine Standard-Verbindung pro Nutzer und `label_photo.identify_provider`; mit Migrationstest verifizieren, dass das Schema angewendet wird.
- [ ] 1.2 Backfill idempotent umsetzen: vorhandene `app_user.openrouter_api_key`/`openrouter_model` in eine OpenRouter-Verbindung übernehmen, nur wenn noch keine Verbindung existiert; mit einem Integrationstest gegen eine Bestandsdatenbank verifizieren, dass Key und Modell unverändert ankommen.

## 2. Verbindungsverwaltung & Sicherheit

- [ ] 2.1 Preset-Registry im Backend (OpenRouter, OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek, Together, Fireworks, Ollama, LM Studio, Azure OpenAI, Custom) mit Default-URL, Auth-Art und Key-Pflicht; Unit-Tests für Defaults und unbekannte Presets.
- [ ] 2.2 `AiConnectionService` für Liste, Anlegen, Ändern, Löschen und Standard setzen; Key-Verschlüsselung mit den bestehenden Semantiken (fehlt = behalten, leer = löschen); Integrationstests für 404 bei fremden Verbindungen, genau eine Standard-Verbindung und nie ausgelieferte Keys.
- [ ] 2.3 Base-URL-Validierung implementieren (Schema, Userinfo, Metadata-/Link-Local-Block, HTTPS-Pflicht öffentlich, HTTP nur lokal/privat, optionale `AI_BASE_URL_ALLOWED_HOSTS`); Unit-Tests für alle Fälle inklusive `http://localhost:11434/v1`.
- [ ] 2.4 Routen unter `/api/users/me/ai/connections` und `/api/users/me/ai/presets` mit ProblemDetail-Fehlern anbinden; Routen-Integrationstests für Anlegen, Standard wechseln, Löschen und Validierungsfehler.

## 3. Generischer Chat-Client

- [ ] 3.1 `OpenRouterClient` zu einem generischen OpenAI-kompatiblen Client umbauen (`base_url`, `auth_style` bearer/api-key/none, `extra_headers`, Azure-Deployment-Pfad); Wiremock-Tests für alle Auth-Arten und die Fehlerabbildung 401/403/404/429/Timeout.
- [ ] 3.2 Test-Endpunkt `POST …/{id}/test` mit minimalem Chat-Request und anbieterneutralen Meldungen implementieren; Tests prüfen Erfolg, ungültigen Key und nicht erreichbaren Endpunkt sowie dass der Key nicht in der Antwort erscheint.
- [ ] 3.3 Modellliste `GET …/{id}/models` mit best-effort-Abruf und manueller Eingabe als Fallback implementieren; Tests für verfügbare und nicht verfügbare Liste.
- [ ] 3.4 `AppState` und `config.rs` von der globalen OpenRouter-Base-URL entkoppeln; `cargo test` und `cargo clippy -- -D warnings` laufen grün.

## 4. Label-Erkennung & Kompatibilität

- [ ] 4.1 `LabelIdentificationService` auf die Standard-Verbindung umstellen, `identify_provider` speichern und Fehlermeldungen anbieterneutral formulieren; Tests für erfolgreiche Erkennung, fehlende Verbindung, Anbieterfehler und unveränderte ID-Verifikation.
- [ ] 4.2 Upload- und Retry-Routen von `has_openrouter_key` auf die Standard-Verbindung umstellen und verständliche 400-Meldungen liefern; Routentests für „keine Verbindung“ und „Verbindung vorhanden“.
- [ ] 4.3 `GET`/`PUT /api/users/me/openrouter` als Alias auf die OpenRouter-Verbindung erhalten; Tests für Alt-Client-Antworten und Update-Semantik.
- [ ] 4.4 Label-Inbox-Daten um `identify_provider` ergänzen und die Anzeige „Anbieter · Modell“ in den bestehenden DTOs/Tests absichern.

## 5. PWA

- [ ] 5.1 Typen und `ApiService`-Methoden für Verbindungen, Presets, Test und Modellliste ergänzen; Vitest-Tests für die HTTP-Aufrufe.
- [ ] 5.2 `AiProviderSettingsComponent` mit Liste, Anlegen/Bearbeiten, Preset-Auswahl, Schlüsselfeld, Modellfeld, „Modelle laden“, „Testen“, Standard setzen und Löschen bauen; Komponententests für alle Aktionen und Fehlerzustände.
- [ ] 5.3 `OpenRouterSettingsComponent` durch die neue Komponente ersetzen, Label-Inbox-Anzeige um Anbieter ergänzen und i18n-Keys in Deutsch und Englisch pflegen; `npm test` und `npm run build` laufen grün.
- [ ] 5.4 Datenschutzhinweis und Hilfetexte zur Anbieterwahl in der UI ergänzen; Tests prüfen die sichtbaren Texte und den Leerzustand ohne Verbindung.

## 6. Dokumentation & Abschluss

- [ ] 6.1 ADR-0025 „Anbieterunabhängige KI-Verbindungen“ anlegen, in `docs/adr/README.md` und `docs/arc42.md` verlinken und die Architekturbeschreibung aktualisieren.
- [ ] 6.2 `README.md`, `docs/Help.md`, `docs/Help.en.md` und `docs/Release-Info.md` aktualisieren sowie `node scripts/sync-help.js` und `node scripts/sync-release-info.js` ausführen.
- [ ] 6.3 Qualitätsgate: `cargo fmt --check`, `cargo test`, `cargo clippy --all-targets -- -D warnings`, `npm test -- --watch=false --coverage` und `npm run build`; Coverage ≥ 80 %.
- [ ] 6.4 Code-Review mit `code-review` (effort `high` wegen neuer Endpunkte und Sicherheitslogik), lokalen Docker-Stack aktualisieren und PR mit `Closes #393` anlegen.

## Workflow follow-up

- OpenSpec-Change nach dem Merge archivieren und die Delta-Specs in die Haupt-Specs überführen.
