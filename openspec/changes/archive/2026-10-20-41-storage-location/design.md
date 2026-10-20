# Design: Lagerung in Regalen mit festen Fachgrenzen (#41)

## Context

`collection_item` hält je Exemplar (`instance_id`) die Zuordnung Nutzer ↔ Platte, `record_cache` die Release-Daten inklusive eines groben Formats („LP“, „Double LP“, „CD“, „Double CD“ …), das `determine_format` (`models/discogs.rs`) aus den Discogs-Formatangaben ableitet; die genaue Disc-Anzahl (`qty`) wird bisher verworfen. Die Regal-Sortierung existiert bereits als `build_order_by("artist")` in `collection_query.rs` (Künstler ohne führendes „The“, `COLLATE "C"`, dann Jahr, dann Titel) und wird vom Druck-Modul genutzt. Die Kategorie Platte/CD kommt aus dem bestehenden `category`-Filter. Platten kommen über die App (Suche/Scan) und über den Discogs-Sync in die Sammlung.

## Goals / Non-Goals

**Goals:** Regale mit Fach-Raster und Kapazität konfigurieren; Sammlung gleichmäßig über alle Regale eines Mediums verteilen; neue Platten ohne Kaskaden einsortieren; Einsortier-Hinweis mit den wenigen nötigen Verschiebungen; Übersicht, Filter, Inventurliste, MCP, Backup.

**Non-Goals:** manuelle Zuweisung, gebundene Fächer, andere Sortierungen, nicht-rasterförmige Lagerung, Fach-Etiketten, Hinweise beim Entfernen.

## Decisions

### 1. Feste Fachgrenzen statt fortlaufender Füllung
Fortlaufendes Füllen (erst Regal 1 voll, dann Regal 2) erzeugt bei jeder neuen Platte eine Kaskade durch alle folgenden Fächer. Eine bei jeder Anfrage neu berechnete Gleichverteilung verschiebt bei jeder Änderung viele Grenzen um je eine Platte. Beides passt nicht zum echten Regal, in dem die Trenner stehen bleiben.

Daher: „Neu verteilen“ verteilt gleichmäßig und **speichert die Fachgrenzen** (Sortierschlüssel der ersten Platte je Fach). Die Position jedes Exemplars wird aus den Grenzen berechnet (nicht pro Exemplar gespeichert). Nur bei Überlauf werden Grenzen lokal angepasst. → ADR „Lagerposition aus gespeicherten Fachgrenzen“.

### 2. Datenmodell
```
storage_type     (id, user_id, name, media 'vinyl'|'cd', rows, columns, capacity, created_at)
storage_unit     (id, user_id, type_id → storage_type, name UNIQUE(user_id,name), sort_order, created_at)
storage_boundary (unit_id → storage_unit ON DELETE CASCADE, compartment, artist_key, year_key, title_key, instance_id,
                  PRIMARY KEY (unit_id, compartment))
record_cache.disc_count SMALLINT NULL
```
Das Medium hängt am Typ. Fach 1 des ersten Regals eines Mediums hat keine Grenze (alles davor). Der Sortierschlüssel ist das Tupel aus normalisiertem Künstler, Jahr, Titel und `instance_id` als Tie-Breaker. Als Schlüssel statt als Verweis auf ein Exemplar gespeichert, bleibt eine Grenze gültig, wenn die Platte an der Grenze entfernt wird.

### 3. Gleichmäßig verteilen
Pro Medium: Fächer als flache Liste (Regal nach `sort_order`, darin zeilenweise `row * columns + col`). Gesamtgröße `D` (Summe der Discs), Gesamtkapazität `C`. Zielgrenze für das Ende von Fach k: `T_k = D · (kumulierte Kapazität bis k) / C`. Exemplare in Regal-Sortierung werden Fach k zugeordnet, solange die Mitte des Exemplars (kumulierte Größe − s/2) ≤ `T_k` und die Kapazität nicht überschritten wird. Ergebnis: gleicher Füllgrad pro Fach, Luft überall. Ist `D > C`, wird bis zur Kapazität gefüllt, der Rest ist `unplaced`.

Ausgelöst: manuell („Neu verteilen“, mit Vorschau „N Platten wechseln das Fach“) und automatisch bei Strukturänderungen des Mediums (Regal angelegt/gelöscht/umsortiert, Raster geändert), weil sich dann die Fachliste ändert. Eine reine Kapazitätsänderung behält die Grenzen; Überläufe werden ausgeglichen.

### 4. Einsortieren und Ausgleich
Belegung = jedes Exemplar in das letzte Fach, dessen Grenze ≤ Sortierschlüssel ist. Danach Ausgleich, solange ein Fach über Kapazität liegt:
- Suche das nächstgelegene Fach mit genug freiem Platz links und rechts.
- Wähle die Richtung mit weniger Verschiebungen (bei Gleichstand rechts).
- Verschiebe entlang des Pfads je Fach die Randplatten (nach rechts: letzte Platten; nach links: erste Platten) ins Nachbarfach und setze die betroffenen Grenzen neu.
- Kein Fach mit Platz → überzählige Exemplare am Ende der Sortierung sind `unplaced`.
Eine Box über Fachkapazität wird als `oversized` gekennzeichnet und zählt nur bis zur Kapazität, damit sie keinen Dauer-Ausgleich auslöst.

Die Funktion `StorageLayout::assign(config, boundaries, items) -> (layout, new_boundaries, moves)` ist rein und deterministisch und vollständig unit-testbar.

### 5. Wann Grenzen gespeichert werden
Lesende Endpunkte speichern nichts; sie berechnen die Belegung samt Ausgleich. Nach Änderungen an der Sammlung (Hinzufügen per App, Discogs-Sync, Wiederherstellung) ruft der jeweilige Service `StorageService::commit(user, media)` auf, der die ausgeglichenen Grenzen speichert. So ist die nächste Belegung die Basis für den nächsten Einsortier-Hinweis, und Änderungen außerhalb der App (Sync) werden genauso behandelt.

### 6. Einsortier-Hinweis
`GET /api/storage/placement/{discogsId}` berechnet die Belegung mit den gespeicherten Grenzen einmal ohne und einmal mit den Exemplaren dieser Platte und liefert Slot, Nachbarn und `moves: [{artist, title, from, to}]` (nur durch den Ausgleich verschobene Platten). Da `commit` nach dem Hinzufügen bereits gespeichert hat, nutzt der Endpunkt den Stand vor dem Hinzufügen: Der Hinzufügen-Endpunkt liefert den Hinweis daher direkt in seiner Antwort mit (`placement`), berechnet vor `commit`. Im Detail-Modal zeigt der Endpunkt nur Slot und Nachbarn (keine Moves, da die Platte bereits einsortiert ist).

### 7. Disc-Anzahl
`determine_format` bleibt unverändert; neue Funktion `disc_count(formats, media)` summiert `qty` der Formate des passenden Mediums. Gespeichert beim Sync und beim Hinzufügen im Upsert von `record_cache`. Fallback ohne Wert: „Double …“ → 2, sonst 1 (`COALESCE` in der Layout-Abfrage).

### 8. Filter auf Fächer
Der Filter `storage_unit`/`compartment` (snake_case wie die übrigen Sammlungsfilter) berechnet die Belegung und schränkt die Sammlungsabfrage per `ci.instance_id = ANY($n)` ein; „ohne Platz“ ist `storage_unit=unplaced` und umfasst auch Exemplare eines Mediums ohne Regale. Im Frontend ist der Filter ein String (`''`, `unplaced`, `<id>`, `<id>:<fach>`), der auch in `printFilter` landet.

### 9. DTOs
`vinyl-api-types`: `StorageSlotDto { unitId, unitName, compartment, row, column, oversized }`, als `storage: Option<StorageSlotDto>` (`#[serde(default)]`) in `CollectionRelease` und `RecordDetailDto`; im Detail zusätzlich `storageNeighbors`. Antwort von `POST /api/collection/releases/{id}` erhält optional `placement`. Die Sammlungsabfrage berechnet die Belegung nur, wenn für den Nutzer Regale existieren.

### 10. Frontend
- Sammlung → Ansicht „Regale“ (`features/collection/components/shelf-view`, Umschalter „Liste | Regale“ neben dem Titel): oben die Übersicht, „Regale verwalten“ blendet Typen (Vorlagen, Kallax mit 70, CD-Regal 12×1 mit 11), Regale (Name, Typ, Reihenfolge per Hoch/Runter), Übersicht als CSS-Grid je Regal mit Füllbalken und Künstlerbereich, „Neu verteilen“ mit Vorschau.
- Komponente `storage-placement` (Slot, Nachbarn, Verschiebungen) nach dem Hinzufügen und im Detail-Modal.
- Tabelle: Spalte „Lagerplatz“; mobile Liste: kleine Zeile „Kallax-1 · 3“.

### 11. Backup
`CollectionBackupDto.storage: { types, units: [{ name, type_name, boundaries }] }`, `BACKUP_FORMAT_VERSION = 3`. Restore akzeptiert 1–3 und validiert den Abschnitt vorab (400 bei Fehlern); Typen und Regale werden in der Restore-Transaktion per Name angelegt, falls nicht vorhanden; vorhandene bleiben unverändert. Grenzen werden nur für Medien übernommen, die vorher keine Regale hatten – sonst würden sie mit den bestehenden Grenzen kollidieren; neue Regale hängen dann ohne Grenzen hinten an. Danach `commit`.

### 12. Auslieferung in zwei PRs
- **PR 1 – Kern**: Migration, DTOs, Disc-Anzahl, Konfiguration, Verteilen/Einsortieren/Ausgleich, Commit nach Hinzufügen und Sync, Einsortier-Hinweis, Lagerplatz in Sammlung und Detail, Ansicht „Regale“ mit Übersicht, Verwaltung und „Neu verteilen“.
- **PR 2 – Nutzung**: Filter (Backend + Toolbar + Klick aus der Übersicht), Inventurliste, MCP, Backup.

Der Change wird erst nach PR 2 archiviert.

## Risks / Trade-offs

- **Gespeicherter Zustand** → Grenzen können zur Sammlung „veralten“ (z. B. viele Entfernungen in einem Bereich). Kein Fehler, nur ungleiche Füllung; „Neu verteilen“ behebt es, die Übersicht zeigt Füllstände.
- **Sortierung muss zur Realität passen** → nur Künstler A–Z; dokumentiert.
- **Disc-Anzahl erst nach Sync exakt** → Fallback aus Format-String.
- **Commit-Pflicht an mehreren Stellen** (Hinzufügen, Sync, Restore) → zentral in `StorageService::commit`, Integrationstests je Aufrufer.

## Migration Plan

Migration `10_add_storage.sql` ist additiv. Ohne Konfiguration verhält sich die App wie bisher. Rollback: Tabellen bleiben ungenutzt.
