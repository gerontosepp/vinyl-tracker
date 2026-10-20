# ADR-0011: Dreiteilige Sammlungs-Export- und Backup-Strategie (CSV, JSON, PDF)

* **Status:** Accepted
* **Datum:** 2026-10-18
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#42](https://github.com/gerontosepp/vinyl-tracker/issues/42), Release v0.9.0

---

## Kontext & Problemstellung

Schallplattensammler investieren oft beträchtliche Summen in ihre Sammlungen und möchten ihre Daten nicht ausschließlich in einer einzigen Applikation oder isoliert bei Discogs einsperren (Vendor Lock-in).

Es existierten unterschiedliche Anforderungen an den Datenexport:
1. **Tabellenkalkulation:** Viele Nutzer wollen Daten in Excel, Apple Numbers oder LibreOffice weiterverarbeiten oder analysieren.
2. **Vollständiges Backup:** Ein maschinenlesbares Datenformat zur Wiederherstellung aller Metadaten, Zustandsbewertungen und Hör-Historien.
3. **Versicherungsnachweis:** Ein druckfertiges, optisch ansprechendes Dokument zur Vorlage bei Hausratversicherungen im Schadensfall (Brand, Wasserschaden, Diebstahl).

## Entscheidungstreiber

* **Datenhoheit & Portabilität:** Vollständige Kontrolle des Anwenders über seine Daten.
* **Standardkonformität:** RFC-konforme Dateiformate ohne proprietäre Beschränkungen.
* **Filterkompatibilität:** Der Export muss sowohl die gesamte Sammlung als auch beliebige gefilterte Ansichten (z. B. nach Genre, Jahr oder Suchbegriff) berücksichtigen können.
* **Einfache Bedienbarkeit:** Schneller Download direkt über die Weboberfläche (unter Einstellungen).

## Betrachtete Optionen

* **Option 1: Dreiteilige Export-API (CSV, JSON, PDF) über einen einheitlichen Endpunkt (Gewählt)**
  * *Vorteile:* Deckt alle drei Nutzungsszenarien passgenau ab; einheitliche Filterparameter für alle Formate (`/api/collection/export?format=csv|json|pdf`); Standard-MIME-Types mit `Content-Disposition: attachment`; native Streaming-Erzeugung im Backend.
  * *Nachteile:* Erfordert drei separate Format-Generatoren im `ExportService`.

* **Option 2: Reiner CSV-Export**
  * *Vorteile:* Geringer Implementierungsaufwand.
  * *Nachteile:* Ungeeignet als offizieller Versicherungsnachweis (fehlen Deckblatt, Wertsummen, Cover-Bilder); verschachtelte Daten (wie Tracklisten oder Genre-Arrays) lassen sich nur unsauber in flachen CSV-Zeilen abbilden.

* **Option 3: Direkter Datenbank-Dump (pg_dump)**
  * *Vorteile:* Vollständiger relationaler Snapshot.
  * *Nachteile:* Für Endanwender ohne PostgreSQL-Wissen unbrauchbar; enthält interne Primärschlüssel und Hash-Passwörter; nicht in Excel öffenbar.

## Entscheidung

Es wird eine **dreiteilige Export- und Backup-Architektur** über den Endpunkt `GET /api/collection/export` eingeführt:

1. **CSV-Export (`format=csv`):**
   * RFC-4180-konforme tabellarische Ausgabe via `csv`-Crate.
   * Enthält Interpret, Albumtitel, Release-Jahr, Format, Genres, Discogs-ID, Schätzwert (Median in EUR), Hinzugefügt am, Media-/Sleeve-Zustand, Hörzähler und letztes Spieldatum.
2. **JSON-Backup (`format=json`):**
   * Vollständiges maschinenlesbares JSON-Backup mit Metadaten (`exported_at`, `username`, `total_records`, `total_estimated_value`, Albenliste).
   * Dient als Basis für Archivierung und spätere Re-Importe.
   * **Ergänzung (#102):** Seit `format_version: 2` enthält jede Platte zusätzlich `listen_history` (alle Hör-Zeitstempel, UTC). `POST /api/collection/restore` spielt ein Backup zusammenführend und idempotent wieder ein (nichts wird gelöscht; der geteilte `record_cache` wird nur ergänzt; Zustände aus dem Backup gewinnen; Hör-Events werden über Nutzer, Platte und Zeitstempel dedupliziert). Backups ohne `listen_history` stellen Sammlung und Zustände wieder her, aber keine Hörzähler.
3. **PDF-Katalog & Versicherungsnachweis (`format=pdf`):**
   * Generiert über `printpdf` (siehe [ADR-0010](0010-serverseitige-vektor-pdf-generierung-via-printpdf.md)).
   * Enthält ein zusammenfassendes Bewertungsbanner (Gesamtwert der Sammlung, Eigentümer, Zeitstempel), strukturierte Kacheln pro Album mit hochauflösendem Cover-Artwork, Goldmine-Zustandseinstufungen und Marktpreisen.

Im Frontend stehen die Downloads in den **Einstellungen** unter *Datenverwaltung* mit Live-Ladeindikator bereit.

## Konsequenzen

### Positive Effekte
* **Rundum-Absicherung:** Nutzer können ihre Sammlung jederzeit exportieren und als offiziellen Wertnachweis nutzen.
* **Einheitliche Filter:** Alle Filtereinstellungen der Sammlungsansicht (`search`, `genre`, `year`, `category`, `sort`) werden 1:1 im Export übernommen.
* **Hohe Interoperabilität:** CSV und JSON lassen sich mit allen gängigen Tools und Programmiersprachen verarbeiten.

### Nachteile & Risiken
* **PDF-Dateigröße:** Bei sehr großen Sammlungen (> 1.000 Platten) kann der PDF-Katalog durch eingebettete Cover-Bilder mehrere Megabytes groß werden (wird durch Bild-Kompression optimiert).
