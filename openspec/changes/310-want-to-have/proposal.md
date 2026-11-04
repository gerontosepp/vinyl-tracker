## Why

Mit „Platte am Label erkennen“ wird eine Platte anhand eines Bildes (z. B. einer Besprechung in der Zeitschrift MINT) identifiziert. Um hineinzuhören, muss das Album bisher mühsam manuell in Roon gesucht werden. Erkannte Platten sollen deshalb in einem Want-to-Have-Bereich vorgemerkt und direkt über Roon angehört werden können, ohne sie in den Bestand aufzunehmen.

## What Changes

- Neuer Bereich **Want-to-Have** (eigener Menüpunkt, Route `/want-to-have`) mit Liste der vorgemerkten Platten pro Nutzer.
- Neue Tabelle `want_to_have_item` (Migration) und neue API unter `/api/want-to-have` (Liste, Hinzufügen, Entfernen, Übernahme in den Bestand).
- Button „Zu Want-to-Have“ im Ergebnis der Label-Erkennung (Label-Inbox) und bei Treffern der Discogs-Suche; bei Duplikaten (Bestand oder Want-to-Have) stattdessen ein Hinweis.
- Detailansicht/Kontextmenü wie im Bestand, aber **ohne** „Ich höre gerade“, Geschätzter Wert, Plays, Lagerplatz, Zustand und Sortierung; **neu**: „In Bestand übernehmen“ und „Aus Want-to-Have entfernen“.
- Roon-Wiedergabe aus Want-to-Have über das vorhandene `POST /api/roon/play`; es wird **kein** Hör-Event geloggt.
- Help (de/en), README, Release-Info, arc42 und MCP-Tool-Beschreibungen (falls betroffen) werden ergänzt.

Nicht Teil dieser Änderung: Preis-/Marktwert-Abfragen für Want-to-Have, Sortierung per Regal, Sync mit der Discogs-Wantlist, MCP-Tools zum Verwalten der Liste.

## Capabilities

### New Capabilities
- `want-to-have`: Vormerken von Platten (aus Label-Erkennung und Discogs-Suche), Liste, Detailansicht ohne Bestandsfelder, Roon-Wiedergabe ohne Listen-Logging, Übernahme in den Bestand und Entfernen.

### Modified Capabilities
- `label-photo`: Ergebnis der Erkennung bietet zusätzlich „Zu Want-to-Have“.
- `collection`: Übernahme eines Want-to-Have-Eintrags erzeugt einen regulären Bestandseintrag.

## Impact

- Backend: neue Migration `17_…sql`, Modell, Service `want_to_have_service.rs`, Route `want_to_have.rs`, Registrierung in `routes/mod.rs`; Wiederverwendung des bestehenden Hinzufügen-zur-Sammlung-Pfads und des Discogs-Clients.
- Frontend: neue Feature-Komponente `features/want-to-have`, Route, Navigationseintrag, `ApiService`-Methoden, i18n-Keys (de/en), Buttons in Label-Inbox und Suche.
- Docs/Specs: `docs/Help.md`/`Help.en.md`, `docs/Release-Info.md`, `docs/arc42.md`, `openspec/specs/`.
