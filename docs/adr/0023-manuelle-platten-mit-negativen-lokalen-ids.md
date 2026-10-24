# ADR-0023: Manuelle Platten mit negativen lokalen IDs

* **Status:** Proposed
* **Datum:** 2026-10-24
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#242](https://github.com/gerontosepp/vinyl-tracker/issues/242), [#243](https://github.com/gerontosepp/vinyl-tracker/issues/243), OpenSpec-Change `242-manual-records`

---

## Kontext & Problemstellung

Platten ohne Discogs-Eintrag sollen in Vinyl Tracker verwaltet werden. Das Datenmodell und über 40 Code-Stellen setzen eine Discogs-Release-ID (`record_cache.discogs_id NOT NULL UNIQUE`) und eine Discogs-Exemplar-ID (`collection_item.instance_id NOT NULL`) voraus: DTOs, `ON CONFLICT (discogs_id)`-Upserts, Regal-Sortierschlüssel, Druck-QR-Codes, Frontend-Auswahl und MCP-Tools.

## Betrachtete Optionen

* **Option 1: `discogs_id` nullable** – fachlich sauber, erfordert aber optionale IDs in allen DTOs, neue Konfliktschlüssel und Änderungen in Backend, Frontend und MCP.
* **Option 2: Negative lokale IDs (vorgeschlagen)** – manuelle Platten bekommen `discogs_id = instance_id = -n` aus einer eigenen Sequenz, gekennzeichnet durch `record_cache.source = 'manual'`, mit stabiler `manual_uid` für Backups.

## Entscheidung (vorgeschlagen)

Option 2. Negative IDs kollidieren weder mit Discogs-IDs noch mit lokalen IDs; alle Lesepfade funktionieren unverändert. Schreibende Discogs-Pfade (Sync-Löschung, Release-Abruf, Preise, Zustands-Sync, Löschen bei Discogs) prüfen `source` bzw. das Vorzeichen. Die Übernahme einer später bei Discogs eingestellten Platte (Etappe 2) stellt den Eintrag auf echte IDs um und behält Hörhistorie, Regalplatz und Zustand.

## Konsequenzen

### Positive Effekte
* Kleiner Eingriff; Sammlung, Regal, Statistik, Druck und MCP funktionieren ohne Typänderungen.
* Klare Kennzeichnung über `source`.

### Nachteile & Risiken
* Die Bedeutung „negative ID = manuell“ ist eine Konvention; neue Discogs-Aufrufe müssen sie beachten (Tests für alle Seiteneffekte).
* Backups enthalten instanzabhängige negative IDs; die Wiederherstellung ordnet daher über `manual_uid` zu.
