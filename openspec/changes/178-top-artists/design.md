# Design: Meistgespielte Interpreten (#178)

## Context

`AnalyticsService::get_top_records` gruppiert `listen_event` je Release (Top 10, optional `from`/`to`). Das Dashboard lädt die Top-Alben mit dem Zeitraum des Blocks und reicht sie an `TopRecordsComponent` weiter; der Zeitraum-Filter wird per `ng-content` in dessen Kopf projiziert. `record_cache.artist` ist ein einzelner String (erster Interpret). Die Sammlung hat eine Suche über Interpret und Titel, liest aber keine URL-Parameter.

## Goals / Non-Goals

**Goals:** Interpreten-Rangliste mit Collage im bestehenden Block; dieselbe Zeitraumlogik; Klick in die gefilterte Sammlung; MCP-Tool.

**Non-Goals:** Normalisieren von Interpretennamen, Kollaborationen aufteilen, Interpreten-Detailseite.

## Decisions

### 1. Gruppierung nach `rc.artist`
Gruppiert wird nach dem gespeicherten Interpreten-String, so wie er in Sammlung und Alben-Liste erscheint; leere Interpreten fallen weg. Normalisieren (z. B. „The“) würde Namen anders zeigen als in der Sammlung und bringt Sonderfälle – bewusst nicht im Umfang.

### 2. Eine Abfrage mit Fensterfunktion
```sql
WITH per_release AS (
  SELECT rc.artist, rc.discogs_id, rc.thumb_url, COUNT(le.id) AS plays
  FROM listen_event le JOIN record_cache rc ON rc.id = le.record_id
  WHERE le.user_id = $1 AND NULLIF(TRIM(rc.artist), '') IS NOT NULL [AND Zeitraum]
  GROUP BY rc.artist, rc.discogs_id, rc.thumb_url)
SELECT artist, SUM(plays) AS play_count, COUNT(*) AS record_count,
       (ARRAY_AGG(thumb_url ORDER BY plays DESC, discogs_id) FILTER (WHERE thumb_url IS NOT NULL))[1:4] AS thumbs
FROM per_release GROUP BY artist ORDER BY play_count DESC, artist LIMIT 10
```
Der Zeitraum wird wie bei den Top-Alben geparst (gemeinsame Hilfsfunktion statt zweimal dieselben `match`-Zweige). DTO `TopArtistDto { artist, count, recordCount, thumbUrls }` (camelCase wie `TopRecordDto`).

### 3. Frontend: Tabs in `TopRecordsComponent`
Die Komponente erhält zusätzlich `artists` als Input und einen `tab`-Signal („records“ | „artists“), Tabs als Segment-Umschalter neben dem Titel; Titel „Meistgespielt“ mit den Tabs „Alben“ | „Interpreten“. Das Dashboard lädt Alben und Interpreten gemeinsam im bestehenden `forkJoin` mit demselben Zeitraum (ein Request mehr, dafür kein Nachladen beim Tab-Wechsel). „Mehr anzeigen“ und Balken funktionieren für beide Listen gleich. Ausgabe `openArtist` → Dashboard navigiert zu `/collection?search=<Interpret>`.

### 4. Collage
Kleine Komponente `artist-collage` (40×40 wie das Cover): CSS-Grid; 1 Cover vollflächig, 2 Cover als zwei Spalten, 3–4 als 2×2 (bei 3 bleibt eine Zelle als Fläche). Bilder über den Bild-Proxy, `loading="lazy"`.

### 5. Sammlung liest `search`
`CollectionComponent` liest beim Start `search` aus den Query-Parametern (`ActivatedRoute.snapshot`) und setzt Such- und entprellten Suchwert, bevor die Liste geladen wird.

### 6. MCP
Tool `get_top_artists` mit den bestehenden Zeitraum-Argumenten (`AnalyticsDateRangeArgs`), gibt das JSON der Rangliste aus; Contract-Test gegen den Mock-Backend.

## Risks / Trade-offs

- **Gleicher Interpret, verschiedene Schreibweisen** → erscheint doppelt; dokumentiert, lösbar später durch Normalisierung.
- **Suche ist eine Teilstring-Suche** über Interpret und Titel → bei kurzen Namen (z. B. „Can“) erscheinen auch andere Treffer; akzeptiert, da die Suche dem Nutzer sichtbar und änderbar ist.

## Migration Plan

Keine Migration, rein additiv.
