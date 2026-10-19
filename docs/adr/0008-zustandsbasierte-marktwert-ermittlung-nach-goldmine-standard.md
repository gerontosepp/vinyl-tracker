# ADR-0008: Zustandsbasierte Marktwert-Ermittlung und Caching nach Goldmine-Standard

* **Status:** Accepted
* **Datum:** 2026-10-14
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#30](https://github.com/gerontosepp/vinyl-tracker/issues/30), [#62](https://github.com/gerontosepp/vinyl-tracker/issues/62), Release v0.6.0

---

## Kontext & Problemstellung

Eine Kernmotivation für Schallplattensammler ist die realistische Wertermittlung ihrer Sammlung (z. B. für Haushaltsversicherungen oder Inventurzwecke). Die bisherige Schätzung basierte auf dem globalen Mindestpreis (`lowest_price`), den Discogs pauschal für ein Release zurückgibt.

Dieser Mindestpreis ist in der Praxis irreführend:
* Er spiegelt meist stark beschädigte Exemplare (*Poor*, *Fair*) wider.
* Tatsächliche Marktwerte hängen massiv vom Erhaltungszustand (*Condition*) von Tonträger (*Media*) und Cover (*Sleeve*) ab (z. B. *Mint*, *Near Mint*, *Very Good Plus*).
* Live-Abfragen der Discogs Price Suggestions API (`/marketplace/price_suggestions/{release_id}`) bei jedem Rendern der Sammlung führen unweigerlich zu HTTP 429 Rate-Limit-Fehlern.

## Entscheidungstreiber

* **Realistische Bewertung:** Schätzpreise müssen den tatsächlichen Zustand der individuellen Platte widerspiegeln.
* **Discogs-API-Schonung:** Vermeidung von API-Drosselungen durch konsequentes Caching.
* **Synchronisation mit Discogs:** Vorhandene Zustandseinstufungen aus Discogs Custom Collection Fields sollen automatisch importiert und zurücksynchronisiert werden.
* **Währungsstabilität:** Einheitliche Wertermittlung und -anzeige in Euro (€).

## Betrachtete Optionen

* **Option 1: Discogs-Zustände synchronisieren + Zustandspreis in Datenbank cachen (Gewählt)**
  * *Vorteile:* Import von `media_condition` und `sleeve_condition` aus Discogs Custom Fields; gezielter Abruf der Zustandspreise über die Discogs Marketplace Price Suggestions API; Caching im Feld `record_cache.median_price`; Bereitstellung eines dedizierten Massen-Aktualisierungs-Endpunkts (`POST /api/collection/prices/refresh`); null Latenz beim Sammlungs-Rendering.
  * *Nachteile:* Erfordert Schema-Erweiterungen in der Datenbank (`collection_item.media_condition`, `record_cache.median_price`).

* **Option 2: Live-Abfrage bei jedem Öffnen der Sammlungsseite**
  * *Vorteile:* Immer sekundengenaue Daten.
  * *Nachteile:* Bei Sammlungen mit mehr als 60 Platten wird das Discogs-Rate-Limit (60 Requests/Minute) sofort überschritten; unerträglich lange Ladezeiten.

* **Option 3: Festhalten am globalen Mindestpreis (`lowest_price`)**
  * *Vorteile:* Kein zusätzlicher API-Endpunkt erforderlich.
  * *Nachteile:* Drastische Unterbewertung gepflegter Sammlungen; ignoriert den Goldmine-Standard völlig.

## Entscheidung

Vinyl Tracker führt eine **vollständige zustandsbasierte Wertermittlung nach dem Goldmine-Standard** ein:
1. **Zustandssynchronisation:** Die Felder `media_condition` und `sleeve_condition` werden in `collection_item` gespeichert und bidirektional mit Discogs Custom Fields synchronisiert.
2. **Preis-Mapping:** Anhand der Media-Condition (`Mint (M)`, `Near Mint (NM or M-)`, `Very Good Plus (VG+)`, etc.) wird der entsprechende Medianpreis aus der Discogs Price Suggestions API ausgelesen (mit Fallback auf `Very Good Plus (VG+)`, falls kein Zustand hinterlegt ist).
3. **Persistentes Caching:** Der ermittelte Wert wird in `record_cache.median_price` persistiert.
4. **Hintergrund-Aktualisierung:** Über den Endpunkt `POST /api/collection/prices/refresh?onlyMissing=true|false` kann die Sammlung gezielt nachgeladen werden.

## Konsequenzen

### Positive Effekte
* **Präzise Wertermittlung:** Sammler erhalten eine verlässliche, realitätsnahe Schätzung des Werts ihrer Platten.
* **Hervorragende Performance:** Sammlungs- und Dashboard-Abfragen erfolgen rein lokal aus der PostgreSQL-Datenbank ohne externe API-Latenz.
* **Nahtlose UI-Integration:** Zustands-Badges (`NM`, `VG+`) und Eurowerte werden direkt in der Tabelle, den Kacheln und im Detail-Modal dargestellt.

### Nachteile & Risiken
* **Discogs API Coverage:** Für sehr seltene Bootlegs oder Nischen-Releases liegen bei Discogs mitunter keine Preisvorschläge vor (Fallback-Handling erforderlich).
