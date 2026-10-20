# Design: Sammlung aus JSON-Backup wiederherstellen

## Entscheidungen

### Hör-Historie im Backup statt synthetischer Events
Das bisherige Backup kennt pro Platte nur Zähler und letzten Hörzeitpunkt. Synthetische Events (alle mit `last_played_at`) würden Statistiken verfälschen. Deshalb wird der Export um `listen_history` erweitert (`format_version: 2`); alte Backups stellen keine Hörzähler wieder her.

### Zusammenführen, idempotent
Upserts über die natürlichen Schlüssel (`record_cache.discogs_id`, `collection_item (user_id, instance_id)`, Hör-Event = Nutzer + Platte + exakter Zeitstempel; der Export schreibt Mikrosekunden, damit das Wiedereinspielen in dieselbe Datenbank keine Duplikate erzeugt). Mehrfaches Einspielen ändert nichts mehr. Gefilterte oder ältere Backups löschen keine Daten.

### Geteilter `record_cache` wird nur ergänzt
`record_cache` ist nutzerübergreifend und wird durch Discogs-Sync/Preis-Refresh aktuell gehalten. Ein Backup füllt nur Lücken (`COALESCE(record_cache.x, backup.x)`), Genres nur, wenn die Platte noch keine hat.

### Eigenes Restore-DTO
Die Wiederherstellung deserialisiert in ein eigenes, tolerantes DTO (`CollectionBackupRequest`) im Backend statt in `CollectionRelease` aus `vinyl-api-types`: unbekannte Felder werden ignoriert, optionale Felder dürfen fehlen. Das geteilte API-Typen-Crate (MCP) bleibt unverändert; der Export ergänzt `listen_history` über einen Wrapper mit `#[serde(flatten)]`.

### Transaktion & Limits
Eine Transaktion pro Wiederherstellung; bei einem Fehler bleibt die Datenbank unverändert. Body-Limit 25 MB (Axum-Default 2 MB reicht für große Sammlungen nicht), max. 20 000 Platten, Long-Running-Timeout.

## Antwort
```json
{
  "format_version": 2,
  "records_total": 120,
  "records_added": 3,
  "records_updated": 117,
  "listens_added": 42,
  "listens_skipped": 980,
  "listen_history_included": true
}
```
