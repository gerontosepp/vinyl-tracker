# Proposal: Lagerung in Regalen mit berechneter Position (#41)

## Why

Bei einer wachsenden Sammlung ist nicht klar, in welchem Regal und Fach eine Platte steht – und vor allem nicht, wohin eine neue Platte einsortiert werden muss. In der Vinyl-Szene sind IKEA-Kallax-Regale verbreitet, für CDs das IKEA-CD-Regal mit 12 Fächern. Wenn der Tracker die Regale, ihre Fächer und deren Kapazität kennt, kann er aus der Regal-Sortierung (Künstler A–Z) für jede Platte das Fach berechnen und beim Hinzufügen sagen, wohin sie gehört und welche Platten dadurch ins nächste Fach rutschen. Das Issue #41 (Freitext-Lagerort, alter Java/Flyway-Stand) wird hiermit neu gefasst.

## What Changes

- **Lagertypen** (pro Nutzer): Name, Medium (Platten oder CDs), Raster aus Zeilen × Spalten und Kapazität pro Fach in Discs. Vorlagen beim Anlegen: Kallax 1×4, 2×2, 2×4, 4×4, 5×5 (Platten, 70 Discs pro Fach) und IKEA-CD-Regal 12×1 mit 11 CDs pro Fach. Kapazität und Raster sind änderbar.
- **Regale** (pro Nutzer): Name (z. B. „Kallax-1“), Lagertyp und Reihenfolge innerhalb des Mediums.
- **Gleichmäßige Verteilung mit festen Fachgrenzen**: „Neu verteilen“ verteilt die Sammlung eines Mediums in Regal-Sortierung (Künstler A–Z ohne „The“, dann Jahr, dann Titel) gleichmäßig auf alle Fächer aller Regale – Regale in ihrer Reihenfolge, Fächer zeilenweise von links oben – und speichert die Fachgrenzen. Jede Platte belegt so viel Platz, wie sie Discs hat (Doppel-LP = 2), und wird nie über zwei Fächer geteilt.
- **Einsortieren ohne Kaskaden**: Neue Platten (per App oder Discogs-Sync) kommen in das Fach, in dessen Bereich sie fallen; sonst bewegt sich nichts. Nur wenn ein Fach überläuft, wandern Randplatten zum nächstgelegenen Fach mit Platz. Bei Strukturänderungen (Regal hinzu/weg, Reihenfolge, Raster) wird automatisch neu verteilt.
- **Einsortier-Hinweis**: Nach dem Hinzufügen einer Platte und im Detail-Modal zeigt das Frontend Regal, Fach (mit Zeile/Spalte), Nachbarn („nach … / vor …“) und welche Platten dadurch in ein anderes Fach wandern.
- **Regal-Übersicht**: Die Sammlung erhält neben der Liste eine Ansicht „Regale“; dort werden Lagertypen und Regale verwaltet, und eine Übersicht zeigt jedes Regal als Raster mit Füllstand und Künstlerbereich je Fach (z. B. „Beatles – Bowie“), die Anzahl der Platten ohne Platz und „Neu verteilen“ mit Vorschau.
- **Sammlung**: Tabelle und mobile Liste zeigen den Lagerplatz („Kallax-1 · Fach 3“); Filter nach Regal und Fach.
- **Discs pro Release**: `record_cache` speichert die Anzahl der Discs aus den Discogs-Formatangaben.
- **Druck**: neue Vorlage `inventory` (Inventurliste) gruppiert nach Regal und Fach.
- **MCP**: Lagerplatz in `get_user_collection`, neue Tools `get_record_placement` und `get_storage_layout`.
- **Backup**: Export und Wiederherstellung enthalten die Lagerkonfiguration (Format-Version 3; Version 2 bleibt lesbar).

Nicht im Umfang: andere Regalsysteme als rasterförmige Fächer, freie Lagerorte, manuelle Zuweisung oder fest gebundene Fächer, andere Sortierungen (z. B. nach Genre), Fach-Etiketten drucken, Hinweise beim Entfernen von Platten.

## Capabilities

### New Capabilities
- `storage-location`: Lagertypen und Regale verwalten, Position jeder Platte berechnen, Einsortier-Hinweis, Regal-Übersicht, Filter.

### Modified Capabilities
- `print`: neue Vorlage Inventurliste; der Umfang „aktuelle Filter“ berücksichtigt den Regal-Filter.

## Impact

- **DB**: Migration `10_add_storage.sql`: Tabellen `storage_type`, `storage_unit`, `storage_boundary`; Spalte `record_cache.disc_count`.
- **Backend**: neues Modul `services/storage/` (Konfiguration, Verteilung, Einsortieren und Ausgleich, Platzierung), Routen `/api/storage/...`, `collection_sync` (Disc-Anzahl, Einsortieren nach dem Sync), `collection_query` (Lagerplatz, Filter), `record_service` (Position im Detail), Backup, Druckvorlage `inventory`, `vinyl-api-types`.
- **MCP**: zwei neue Tools, Erweiterung `get_user_collection`, Contract-Tests.
- **Frontend**: Einstellungsbereich „Lagerung“ mit Regal-Übersicht, Einsortier-Hinweis nach dem Hinzufügen und im Detail-Modal, Lagerplatz in Tabelle/Liste, Toolbar-Filter, Druck-Dialog, Übersetzungen DE/EN.
- **Doku**: README, arc42 (Datenmodell, Laufzeitsicht Platzierung), ADR „Lagerposition aus gespeicherten Fachgrenzen“, Release-Info.
