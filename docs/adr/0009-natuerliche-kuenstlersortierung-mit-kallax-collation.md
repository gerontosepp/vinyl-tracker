# ADR-0009: Natürliche Künstlersortierung mit Artikel-Normalisierung und Kallax-Regal-Collation

* **Status:** Accepted
* **Datum:** 2026-10-18
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#98](https://github.com/gerontosepp/vinyl-tracker/issues/98), Release v0.9.0

---

## Kontext & Problemstellung

Schallplattensammler organisieren ihre physischen Tonträger meist in standardisierten Regalmodulen (wie IKEA Kallax) nach einer bewährten bibliothekarischen Sortierkonvention:
* Künstler mit führendem englischen Artikel „The “ (*The Beatles*, *The Clash*, *The Rolling Stones*) werden unter dem Anfangsbuchstaben des Namens ohne Artikel einsortiert (*Beatles* unter **B**, *Clash* unter **C**, *Rolling Stones* unter **R**).
* Punkt-Abkürzungen wie *A.R. & Machines* stehen im Regal strikt vor nachfolgenden Wörtern wie *Adele*.
* Bei mehreren Alben desselben Interpreten stehen die Werke chronologisch nach Veröffentlichungsjahr sortiert.

In der bisherigen SQL-Sortierung (`ORDER BY artist ASC`) wurden alle Bands mit „The “ gesammelt unter **T** einsortiert, und Datenbanksortierungen behandelten Interpunktion sprachabhängig uneinheitlich. Dadurch stimmte die Reihenfolge in der Web-App und beim PDF-Etikettendruck nicht mit dem physischen Regal überein.

## Entscheidungstreiber

* **Parität zwischen digitaler App und physischem Regal:** Ein Sammler muss eine Platte an exakt derselben Stelle finden wie in der App aufgelistet.
* **Keine manuelle Datenpflege:** Benutzer sollen nicht manuell ein separates Sortierfeld (`sort_artist`) pflegen müssen.
* **Performante Datenbanksortierung:** Die Normalisierung muss effizient über PostgreSQL-Indexe und Abfragen abbildbar sein.
* **Konsistenz:** Identische Sortierergebnisse in der Web-Sammlungstabelle, im mobilen Dashboard und beim A4-PDF-Etikettendruck.

## Betrachtete Optionen

* **Option 1: Dynamische SQL-Normalisierung mit `COLLATE "C"` und sekundärer Chronologie (Gewählt)**
  * *Vorteile:* Automatisches Strippen von führenden Artikeln via `REGEXP_REPLACE(artist, '^(?i)the\s+', '')`; exakte Platzierung von Satzzeichen vor Buchstaben durch binäre Collation (`COLLATE "C"`); sekundäre Sortierung nach `release_year ASC NULLS LAST, title ASC`; absolut wartungsfrei für den Anwender.
  * *Nachteile:* SQL-Ausdrücke in `CollectionQueryService` und `QrPdfService` müssen synchron gehalten werden.

* **Option 2: Manuelles `sort_artist`-Feld in der Datenbank**
  * *Vorteile:* Maximale Flexibilität für Sonderfälle.
  * *Nachteile:* Hoher manueller Pflegeaufwand für hunderte Alben; fehleranfällig bei automatischer Discogs-Synchronisation.

* **Option 3: Reine Client-Sortierung im JavaScript-Frontend**
  * *Vorteile:* Einfache String-Manipulationen in TypeScript.
  * *Nachteile:* Bricht serverseitige Paginierung (`page`, `per_page`), da die Datenbank die Datensätze vorsortieren muss; funktioniert nicht für den serverseitigen PDF-Druck.

## Entscheidung

Die Sortierung in `CollectionQueryService` und `QrPdfService` wird auf eine **dreistufige natürliche Kallax-Sortierung** umgestellt:
1. **Artikel-Bereinigung:** Führende Artikel „The “ werden für die Sortierung ignoriert:
   ```sql
   REGEXP_REPLACE(artist, '^(?i)the\s+', '') COLLATE "C" ASC
   ```
2. **Punkt-Collation:** Durch `COLLATE "C"` sortieren Satzzeichen (wie Punkte in `A.R. & Machines`) nach ASCII-Wert deterministisch vor Klein- und Großbuchstaben (`Adele`).
3. **Sekundäre Chronologie:** Bei Namensgleichheit wird aufsteigend nach Veröffentlichungsjahr und abschließend nach Albumtitel sortiert:
   ```sql
   release_year ASC NULLS LAST, title ASC
   ```

Der ursprüngliche Künstlername bleibt für die Anzeige unverändert erhalten.

## Konsequenzen

### Positive Effekte
* **Perfekte Kallax-Parität:** Die App und die ausgedruckten QR-Code-Etiketten spiegeln das physische Regal 1:1 wider.
* **Vollautomatisch:** Funktioniert nahtlos für alle bestehenden und neu importierten Alben.
* **Server- und Client-Konsistenz:** Paginierte API-Abfragen und PDF-Exports liefern identische Reihenfolgen.

### Nachteile & Risiken
* **Sprachspezifische Artikel:** Aktuell ist die Normalisierung auf das englische „The “ fokussiert; fremdsprachige Artikel (wie „Die “, „Les “) können bei Bedarf in zukünftigen Schritten erweitert werden.
