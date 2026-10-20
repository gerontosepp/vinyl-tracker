# Proposal: Sortier-Modus auf dem Handy (#172)

## Why

Mit den Regalen aus #41 weiß der Tracker, in welches Fach jede Platte gehört. Beim ersten Einräumen oder nach „Neu verteilen“ muss der Nutzer aber einen ganzen Stapel Platten in die richtige Reihenfolge bringen – mit der Sammlungsliste auf dem Handy ist das mühsam (scrollen, kleine Schrift, viel Ablenkung). Ein minimaler Sortier-Modus zeigt Platte für Platte, was als Nächstes wohin kommt, und lässt sich mit einer Hand bedienen.

## What Changes

- **Einstieg auf der Startseite**: Button „Sortieren“, nur in der Mobil-Ansicht und nur, wenn Regale konfiguriert sind.
- **Start-Auswahl**: Regal (vorbelegt mit dem ersten) und Startfach als Zeile:Spalte; das Medium ergibt sich aus dem Regal.
- **Sortier-Screen** (Vollbild, ohne Navigation): Cover, Titel, Interpret, aktuelles Fach („Kallax-1 · 2:3“) und Fortschritt im Fach („12 / 70“). Wechselt die nächste Platte das Fach, erscheint ein deutlicher Hinweis.
- **Drei Controls**: großes „Weiter“, „Zurück“, „Beenden“.
- **Reihenfolge**: berechnete Belegung (Regal-Sortierung, ADR-0020) ab dem Startfach; am Ende eines Regals geht es nahtlos im nächsten Regal desselben Mediums weiter, danach folgen die Platten ohne Platz; am Ende ein Abschluss-Screen.
- **Bildschirm bleibt an** während des Sortierens (Screen Wake Lock, falls der Browser es unterstützt).
- **API**: `GET /api/storage/sequence?media=` liefert alle Exemplare eines Mediums in Regal-Reihenfolge mit Lagerplatz und Cover.

Nicht im Umfang: Fortsetzen einer abgebrochenen Sitzung, Abhaken/Speichern einzelner Platten, Sortieren am Desktop, Rückwärts-Start (von hinten), Sprachausgabe.

## Capabilities

### New Capabilities
- `sort-mode`: geführtes Einsortieren Platte für Platte in Regal-Reihenfolge (Start, Anzeige, Navigation, Abschluss).

### Modified Capabilities
<!-- keine: storage-location (#41) ist noch nicht archiviert; der neue Endpunkt gehört zum Sortier-Modus -->

## Impact

- **Backend**: `services/storage` (Sequenz eines Mediums inkl. Cover), Route `GET /api/storage/sequence`, DTOs in `vinyl-api-types`, Integrationstest.
- **Frontend**: neue Route `/sort` (Feature `sort-mode`, ohne `app-layout`), Button auf der Startseite (`md:hidden`), `ApiService.getStorageSequence`, Übersetzungen DE/EN, Vitest-Specs.
- **Doku**: README (User Guide), arc42 (Route, Laufzeitszenario), Release-Info.
- Keine Migration.
