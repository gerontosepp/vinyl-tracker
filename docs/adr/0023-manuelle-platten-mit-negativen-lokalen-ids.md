# ADR-0023: Manuelle Platten mit negativen lokalen IDs

* **Status:** Accepted
* **Datum:** 2026-10-24
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#242](https://github.com/gerontosepp/vinyl-tracker/issues/242), [#243](https://github.com/gerontosepp/vinyl-tracker/issues/243), OpenSpec-Change `242-manual-records`

---

## Kontext & Problemstellung

Platten ohne Discogs-Eintrag sollen in Vinyl Tracker verwaltet werden. Das Datenmodell und über 40 Code-Stellen setzen eine Discogs-Release-ID (`record_cache.discogs_id NOT NULL UNIQUE`) und eine Discogs-Exemplar-ID (`collection_item.instance_id NOT NULL`) voraus: DTOs, `ON CONFLICT (discogs_id)`-Upserts, Regal-Sortierschlüssel, Druck-QR-Codes, Frontend-Auswahl und MCP-Tools.

## Betrachtete Optionen

* **Option 1: `discogs_id` nullable** – fachlich sauber, erfordert aber optionale IDs in allen DTOs, neue Konfliktschlüssel und Änderungen in Backend, Frontend und MCP.
* **Option 2: Negative lokale IDs** – manuelle Platten bekommen `discogs_id = instance_id = -n` aus einer eigenen Sequenz, gekennzeichnet durch `record_cache.source = 'manual'`, mit stabiler `manual_uid` für Backups.

## Entscheidung

Option 2. Negative IDs kollidieren weder mit Discogs-IDs noch mit lokalen IDs; alle Lesepfade funktionieren unverändert. Schreibende Discogs-Pfade (Sync-Löschung, Release-Abruf, Preise, Zustands-Sync, Löschen bei Discogs) prüfen `source` bzw. das Vorzeichen. Die Übernahme einer später bei Discogs eingestellten Platte (Etappe 2) stellt den Eintrag auf echte IDs um und behält Hörhistorie, Regalplatz und Zustand.

## Konsequenzen

### Positive Effekte
* Kleiner Eingriff; Sammlung, Regal, Statistik, Druck und MCP funktionieren ohne Typänderungen.
* Klare Kennzeichnung über `source`.

### Nachteile & Risiken
* Die Bedeutung „negative ID = manuell“ ist eine Konvention; neue Discogs-Aufrufe müssen sie beachten (Tests für alle Seiteneffekte).
* Backups enthalten instanzabhängige negative IDs; die Wiederherstellung ordnet daher über `manual_uid` zu.

## Umsetzung (Etappe 1)

Migration `14_add_manual_records.sql`: Sequenz `manual_record_seq` (ab -1 abwärts), `record_cache.source`, `manual_uid` (UUID, `gen_random_uuid()`), `owner_id` (`record_cache` ist für alle Benutzer gemeinsam, eine manuelle Platte sieht und ändert nur ihr Besitzer), `label`, `catno`, `country`, `barcode`, `notes`, CHECK `source = 'discogs' OR (discogs_id < 0 AND manual_uid IS NOT NULL)`, Tabelle `record_cover`, `label_photo.label_reading`/`record_id`. Die Sync-Löschung betrifft nur `instance_id > 0`; Details, Zustand, Hören, Entfernen, Preis-Refresh und Scan rufen für `source = 'manual'` kein Discogs auf. Covers liefert `GET /api/covers/{manual_uid}` ohne Login (nicht erratbare UUID, `?v=` wechselt mit jedem Upload). Das JSON-Backup (`format_version: 4`) enthält pro manueller Platte `manual` mit `manualUid` und Cover (Base64); die Wiederherstellung ordnet über `manualUid` unter den eigenen Platten zu, vergibt fehlende IDs neu und legt bei der UUID eines anderen Benutzers eine eigene Kopie an. Wiederhergestellte Platten durchlaufen dieselbe Prüfung wie neu angelegte, Cover werden neu kodiert.

## Nachtrag: Übernahme nach Discogs (Etappe 2, #243)

Wird eine manuelle Platte später bei Discogs eingetragen, findet „Bei Discogs prüfen“ (`GET /api/records/{id}/discogs-candidates`) den Release per Barcode, Katalognummer + Label und Künstler + Titel. Die Übernahme (`POST /api/records/{id}/takeover`) läuft nur nach Bestätigung und ändert die ID-Strategie nicht:

* **Umhängen statt Umwandeln:** Die manuelle Zeile in `record_cache` wird nicht zur Discogs-Zeile umgebaut, weil der Cache für alle Benutzer gemeinsam ist und `discogs_id` eindeutig ist. Hör-Ereignisse, Label-Fotos und das Exemplar werden in einer Transaktion auf die Discogs-Zeile umgehängt, danach wird die manuelle Zeile gelöscht (das eigene Cover per Cascade, der eigene Wert entfällt).
* **Zweites Exemplar oder Zusammenführen:** Standard ist ein neues Discogs-Exemplar. Ist der Release schon in der Sammlung, kann die manuelle Platte stattdessen in ein vorhandenes Exemplar zusammengeführt werden; bei Discogs wird dann nichts hinzugefügt.
* **Alias für alte IDs:** Migration `15_add_manual_record_alias.sql` legt `manual_record_alias (user_id, old_id, instance_id)` an. Gedruckte QR-Etiketten `discogs-id:-n` lösen darüber zum Exemplar auf. Regalgrenzen (`storage_boundary.instance_id`) werden in derselben Transaktion umgeschrieben. Das Backup (`format_version: 5`) enthält die Aliase; ein älteres Backup legt eine übernommene Platte nicht erneut an.
* **Kompensation:** Discogs-Aufrufe liegen außerhalb der Transaktion. Scheitert die Übernahme nach dem Hinzufügen bei Discogs, wird das neue Discogs-Exemplar wieder gelöscht, sonst würde der nächste Sync es als Duplikat anlegen.
* **Keine automatische Prüfung** beim Sync; geprüft wird nur auf Anfrage (Detailansicht, MCP).
