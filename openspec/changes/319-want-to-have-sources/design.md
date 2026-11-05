## Context

Discogs liefert über die API keine Angebote einzelner Verkäufer, nur Kennzahlen pro Release (`/marketplace/stats/{id}`: günstigster Preis, Anzahl Angebote). Alle Pressungen einer Platte stehen im Master (`/masters/{id}/versions`); die Release enthält `master_id`. Das Discogs-Limit von 60 Anfragen/Minute gilt für den ganzen Server und wird auch von Sync und Preis-Aktualisierung genutzt.

## Goals / Non-Goals

**Goals:** Alle Vinyl-Versionen mit Marktplatz-Kennzahlen, Shop-Suchlinks, geringe Last auf dem Discogs-Limit.
**Non-Goals:** Einzelangebote, eBay-API, Preisverlauf, Listenpreise.

## Decisions

1. **Keine Migration.** `master_id` kommt aus der gecachten Release (`get_release`, 24 h), Label und Katalognummer der gesuchten Version aus `release.labels`.
2. **Zwei Endpunkte, beide über die Listen-ID.** So ist der Zugriff auf eigene Einträge geprüft (404 sonst). Der Stats-Endpunkt akzeptiert nur die gesuchte Release und Versionen ihres Masters, damit er kein offener Proxy auf das gemeinsame Limit wird.
3. **Kennzahlen nur für die ersten 5 Versionen, nicht-blockierend.** `try_get_marketplace_stats_nonblocking` nutzt den Cache oder einen sofort freien Slot des Limiters und liefert sonst `None`, statt bis zu eine Minute zu warten. Alle weiteren Versionen laden per Button (`stats: null`). Kaltstart: höchstens 1 (Release) + 3 (Versionsseiten) + 5 (Stats) Anfragen, warm 0.
4. **Master-Versionen: höchstens 3 Seiten à 100** (`format=Vinyl`, nach Erscheinungsdatum aufsteigend), `truncated` zeigt Kürzung an. Cache 24 h, Kennzahlen-Cache 1 h; `try_get_with` lässt parallele Aufrufe eine Anfrage teilen.
5. **Fehler**: Discogs 429 → `AppError::TooManyRequests`, 404 → `NotFound`. Ist der Master verschwunden, zeigt die Ansicht nur die gesuchte Release; fehlende Kennzahlen der ersten Versionen lassen nur die Zahlen weg.
6. **Shop-Links im Backend** (reine Funktionen, unit-getestet): PWA und MCP bekommen dieselben Links. Suchbegriffe: Artist (ohne Discogs-Suffix ` (2)`), Titel, Katalognummer (außer „none“), „vinyl“; Discogs verlinkt auf die Master-Verkaufsliste, sonst auf die Release.
7. **Frontend**: Komponente in `shared/` (kein Import von `features/want-to-have` aus `features/collection`), lädt erst beim Aufklappen; Zustand pro Listen-ID per `linkedSignal`, späte Antworten für einen anderen Eintrag werden verworfen.

## Risks / Trade-offs

- Ein Master hat bis zu mehrere Hundert Pressungen; angezeigt werden die ältesten 300 (Hinweis bei Kürzung). Die gesuchte Version steht immer oben.
- Such-URLs der Shops können sich ändern; sie stehen in einer Konstantentabelle mit Unit-Tests.
- Kennzahlen sind Momentaufnahmen (1 h Cache), kein Echtzeitpreis.

## Open Questions

Keine.
