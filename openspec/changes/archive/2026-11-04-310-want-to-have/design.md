## Context

Der Bestand läuft über `collection_item`/Record-Cache mit Discogs-Sync; das Abspielen via Roon (`POST /api/roon/play`) braucht nur Artist und Titel, das Hör-Logging ist ein separater Aufruf des Clients. Die Label-Erkennung liefert eine Discogs-Release-ID.

## Goals / Non-Goals

**Goals:** Vormerken per Discogs-ID, Liste, Roon-Play ohne Logging, Übernahme/Entfernen, Duplikatschutz.
**Non-Goals:** Discogs-Wantlist-Sync, Preise, Regalplatzierung, MCP-Tools, manuelle Platten.

## Decisions

1. **Eigene Tabelle `want_to_have_item`** statt Status-Flag im Bestand: Der Bestand wird gegen Discogs synchronisiert, Statistik-, Preis- und Regal-Abfragen würden sonst überall filtern müssen. Spalten: `id`, `user_id`, `record_id` (FK auf das gemeinsame `record_cache`, dort liegen Artist, Titel, Jahr, Format, Cover, Genres – kein Kopieren), `created_at` (UTC). `UNIQUE (user_id, record_id)`; Migration `17_…`, Shipped-Migrationen bleiben unverändert.
2. **Metadaten beim Vormerken** über den vorhandenen Discogs-Client und `upsert_release` in `record_cache`; die Tracklist wird beim Öffnen der Detailansicht über den bestehenden Release-Abruf geladen.
3. **Duplikatprüfung serverseitig** (409) und für die UI hält die PWA die Liste im Speicher (`WantToHaveService`, pro Nutzer neu geladen) und blendet vorgemerkte Platten als „Schon vorgemerkt“ aus; besessene Platten werden von `list` ausgelassen.
4. **Übernahme**: Eintrag per `DELETE … RETURNING` beanspruchen (verhindert doppelte Kopien bei Wiederholung/Parallelität), dann Bestand hinzufügen (regulärer Pfad inkl. Discogs-Collection; entfällt, wenn schon besessen); schlägt das Hinzufügen fehl, wird der Eintrag wieder eingefügt. (Discogs ist extern, daher keine DB-Transaktion über beide Schritte.)
5. **Roon-Play unverändert**: Die PWA ruft `/api/roon/play` auf und unterlässt den Listen-Log-Aufruf; keine Backend-Änderung am Roon-Pfad.
6. **Frontend**: neue Standalone-Komponente mit Signals, Details über das bestehende `GET /api/records/{discogs_id}`; Detail-Modal als schlanke Variante des bestehenden Record-Detail-Modals (Bestandsfelder per Eingabeparameter/eigener Komponente ausgeblendet, nicht dupliziert).

## Risks / Trade-offs

- Schlägt nach dem Beanspruchen das Wiedereinfügen fehl (DB-Ausfall), geht der Eintrag verloren; die Merkliste ist kurzlebig, daher akzeptiert.
- Die Merkliste ist nicht Teil des JSON-Backups (bewusst, Folge-Ticket möglich).
- Zwei Detail-Varianten → gemeinsame Teile (Cover, Tracklist, Roon-Bereich) in Subkomponenten, um Duplikation zu vermeiden.

## Open Questions

Keine.
