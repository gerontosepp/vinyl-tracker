# Design

## Context

- Manuelle Platten (ADR-0023) liegen in `record_cache` mit `source = 'manual'`, `discogs_id = -n`, `owner_id` und `manual_uid`; ihr Exemplar in `collection_item` hat `instance_id = -n`. Ein Check-Constraint erzwingt für `manual` negative IDs, UID und Besitzer.
- `record_cache` wird von allen Nutzern geteilt (`discogs_id` UNIQUE). Hör-Ereignisse (`listen_event`), Genres (`record_genres`), Cover (`record_cover`) und `label_photo.record_id` hängen an `record_cache.id`, nicht am Exemplar.
- `storage_boundary` speichert pro Fach die Sortier-Schlüssel und die `instance_id` der ersten Platte (ohne Fremdschlüssel).
- Zustände und `sort_key` liegen in `collection_item`.
- `CollectionSyncService::add_release_and_sync` fügt einen Release bei Discogs hinzu, holt ihn und legt `record_cache` und `collection_item` per Upsert an. Für die Übernahme soll dieser Ablauf ohne erneutes Anlegen eines `collection_item` wiederverwendet werden.
- Der Scanner löst `discogs-id:<n>` bei negativem `n` nur lokal über `record_cache.discogs_id` auf.

## Goals / Non-Goals

**Goals:**
- Die Umstellung in der Datenbank ist atomar: entweder vollständig übernommen oder unverändert manuell.
- Der geteilte Discogs-Cache-Eintrag wird nie mit Daten einer manuellen Platte überschrieben.

**Non-Goals:**
- Keine Rücknahme einer Übernahme.
- Kein Hintergrund-Job und keine Hinweis-Badges; Prüfen nur auf Anfrage.
- Kein Vorausfüllen des Discogs-Formulars (die Discogs-Website bietet dafür keine URL-Parameter).

## Decisions

### 1. Umhängen statt Umwandeln
Bei der Übernahme wird die manuelle `record_cache`-Zeile **nicht** in eine Discogs-Zeile umgewandelt. Stattdessen wird die Discogs-Zeile per Upsert angelegt (oder die vorhandene genutzt), alles wird auf sie umgehängt, und dann wird die manuelle Zeile gelöscht. Cover und eigene Genres verschwinden dabei per `ON DELETE CASCADE` bzw. explizitem Löschen.
- *Alternative:* `UPDATE record_cache SET discogs_id = <release>, source = 'discogs'`. Verworfen, weil das an `UNIQUE (discogs_id)` scheitert, sobald der Release schon im geteilten Cache ist (z. B. bei einem anderen Nutzer). Außerdem müsste jedes Feld einzeln zurückgesetzt werden.
- Daraus folgt: Beide Modi („Zweites Exemplar“ und „Zusammenführen“) teilen sich denselben Ablauf. Sie unterscheiden sich nur darin, welches Exemplar übrig bleibt.

### 2. Ablauf und Transaktionsgrenze
Discogs-Aufrufe lassen sich nicht in eine DB-Transaktion einschließen. Reihenfolge:
1. Prüfen: Platte gehört dem Nutzer und ist `manual`; bei `merge` existiert das Ziel-Exemplar mit dieser Release-ID.
2. Nur `new_copy`: `add_release_to_folder` → neue `instance_id`.
3. `get_release` (gecacht) für die Discogs-Daten.
4. **Eine Transaktion:**
   - `record_cache`-Upsert des Releases mit Genres, wie bisher in `add_release_and_sync`.
   - `listen_event.record_id` und `label_photo.record_id` des Nutzers auf die Discogs-Zeile umhängen.
   - `new_copy`: `collection_item` der manuellen Platte auf `record_id`/`instance_id` des Releases umschreiben (Zustände, `sort_key` und `added_at` bleiben); Ziel-Exemplar ist `new_instance`.
   - `merge`: das manuelle `collection_item` löschen; Ziel-Exemplar ist das gewählte vorhandene Exemplar.
   - `storage_boundary.instance_id = -n` auf das Ziel-Exemplar setzen.
   - Alias `(user_id, -n) → Ziel-Exemplar` eintragen und bestehende Aliase, die auf `-n` zeigen, nachziehen.
   - Die manuelle `record_cache`-Zeile löschen (Cover per Cascade).
5. Danach Best-Effort: Zustände in die Discogs-Felder des neuen Exemplars schreiben (`update_instance_field`, nur `new_copy`) und den Preis des Releases abfragen. Fehler werden nur geloggt.
6. `StorageService::commit_all` aktualisiert die Platzierung, wie nach dem Sync.

Scheitert Schritt 3 oder 4 nach erfolgreichem Schritt 2, wird das neue Discogs-Exemplar per `delete_release_instance` wieder entfernt (Kompensation). Sonst würde der nächste Sync es als Duplikat anlegen.

### 3. Alias-Tabelle
```sql
CREATE TABLE manual_record_alias (
    user_id     BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    old_id      BIGINT NOT NULL CHECK (old_id < 0),
    instance_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, old_id)
);
```
Der Alias zeigt auf `instance_id` (nicht auf `record_cache.id`). So trifft der Scan bei zwei Exemplaren eines Releases das richtige, und der Alias überlebt eine Neuanlage des Caches. Der Scanner fragt bei negativer ID zuerst die manuelle Platte ab, dann den Alias (`collection_item` über `user_id` + `instance_id`). Wird das Exemplar später bei Discogs gelöscht, läuft der Alias ins Leere, und der Scan meldet wie bisher „unbekannt“.
- *Alternative:* Die negative ID in `collection_item` behalten. Verworfen, weil der Discogs-Sync Exemplare über die echte `instance_id` abgleicht.

### 4. Kandidatensuche
`GET /api/records/{id}/discogs-candidates` führt bis zu drei Suchen aus: Barcode (mit den Varianten aus `barcode_variants`), `catno` + `label`, `artist` + `release_title`. Eine Suche wird übersprungen, wenn ihre Felder leer sind. Die Ergebnisse werden in dieser Reihenfolge nach Release-ID zusammengeführt und auf 10 begrenzt. Jeder Kandidat erhält `in_collection: [instance_id…]` aus `collection_item` des Nutzers. Die Antwort nutzt das DTO der Label-Inbox-Kandidaten, erweitert um `in_collection`, damit das Frontend dieselbe Darstellung wiederverwenden kann.

### 5. Übernahme-Endpunkt
`POST /api/records/{id}/takeover` mit `{ release_id, mode: "new_copy" | "merge", target_instance_id? }`. Antwort ist die aktualisierte Platte samt Platzierung (wie `add_to_collection`). Bei `merge` ohne `target_instance_id` und genau einem vorhandenen Exemplar wird dieses genommen; bei mehreren antwortet der Endpunkt mit 400, und die Fehlermeldung nennt die Exemplar-IDs. Der Dialog im Frontend lässt bei mehreren Exemplaren das Ziel wählen.

### 6. Backup `format_version: 5`
Das Backup erhält auf oberster Ebene `manual_aliases: [{ old_id, instance_id }]`. Die Wiederherstellung trägt die Aliase per Upsert ein; die Versionen 3 und 4 bleiben lesbar (ohne Aliase).

### 7. „Bei Discogs eintragen“
Der Link führt auf `https://www.discogs.com/release/add`. Der kopierbare Text wird im Frontend aus den Detaildaten erzeugt; dafür ist kein Backend-Endpunkt nötig.

### 8. MCP
Die drei Tools rufen die neuen bzw. vorhandenen Endpunkte auf (`POST /api/records/manual`, `GET …/discogs-candidates`, `POST …/takeover`). Die Beschreibung von `take_over_manual_record` verlangt die Bestätigung des Nutzers. Die Prompts zur Label-Erkennung bieten bei fehlendem Treffer `create_manual_record` an.

## Risks / Trade-offs

- [Kompensation schlägt fehl, z. B. Discogs nicht erreichbar] → Fehler loggen und dem Nutzer melden, dass ein Discogs-Exemplar ohne lokale Übernahme existiert. Der nächste Sync legt es dann als eigene Platte an, und die manuelle Platte bleibt bestehen. Der Nutzer kann anschließend mit „Zusammenführen“ aufräumen.
- [Discogs-Daten ändern Künstler/Titel, die Platte rückt im Regal] → Ein eigener Sortier-String bleibt erhalten. Ohne ihn zeigt die Antwort die neue Platzierung, wie beim Hinzufügen.
- [Zusammenführen ist verlustbehaftet: Notizen, Zustände und eigene Felder der manuellen Platte gehen verloren] → Der Bestätigungsdialog nennt das ausdrücklich; Standard ist „Zweites Exemplar“.
- [Hör-Ereignisse hängen am Release, nicht am Exemplar] → Bei zwei Exemplaren desselben Releases wird die Historie gemeinsam gezählt. Das ist heute schon so und wird nicht geändert.
- [Ratenlimit] → Bis zu drei Suchen pro Prüfung und kein Hintergrundlauf; das Limit von 60/min reicht.

## Migration Plan

- Die Migration `15_add_manual_record_alias.sql` ist rein additiv. Ein Rollback per altem Image ist möglich, nur alte QR-Etiketten übernommener Platten lösen dann nicht mehr auf.
- ADR-0023 bekommt einen Nachtrag zur Übernahme. Ein eigenes ADR ist nicht nötig, weil die ID-Strategie unverändert bleibt.
