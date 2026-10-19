# Spezifikation: Zustandsbasierte Marktwertermittlung (Market Valuation)

## 1. Übersicht & Zielsetzung
Ermittelt den geschätzten Marktwert einzelner Tonträger sowie der gesamten Schallplattensammlung auf Basis von realen Discogs-Marktplatzpreisen und dem individuellen physischen Erhaltungszustand nach Goldmine-Standard.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 Zustandseinstufung nach Goldmine-Standard
* Für jede Schallplatte werden zwei separate Erhaltungsgrade gepflegt:
  - `media_condition`: Zustand der Schallplatte / des Vinyls.
  - `sleeve_condition`: Zustand der Hülle / des Covers.
* Erlaubte Zustandswerte:
  1. `Mint (M)`: Perfekter Neuzustand, oft noch originalversiegelt.
  2. `Near Mint (NM)`: Nahezu perfekt, minimale oberflächliche Gebrauchsspuren.
  3. `Very Good Plus (VG+)`: Leichte Gebrauchsspuren, die das Hörerlebnis nicht wesentlich stören.
  4. `Very Good (VG)`: Deutlichere Oberflächenspuren und leichtes Knistern in leisen Passagen.
  5. `Good Plus (G+)` / `Good (G)`: Stark abgespielt, sichtbare Kratzer und durchgehendes Rauschen.
  6. `Fair (F)` / `Poor (P)`: Stark beschädigt oder überspringende Nadel.

### 2.2 Discogs-Preispunkte
* Für jedes Release werden periodisch oder auf Anfrage (`POST /api/collection/prices/refresh`) drei Kernpreispunkte von der Discogs Marketplace API abgerufen:
  - `price_low`: Niedrigster aktueller Verkaufspreis.
  - `price_median`: Medianer historischer Verkaufspreis.
  - `price_high`: Höchster registrierter Verkaufspreis.

### 2.3 Gewichtete Marktwert-Berechnung
* Der geschätzte Einzelwert errechnet sich aus der Kombination von Media- und Sleeve-Grading:
  - Tonträger (`media_condition`) wird mit **70 %** gewichtet.
  - Hülle (`sleeve_condition`) wird mit **30 %** gewichtet.
* Bei Zuständen von `Mint` bis `Near Mint` orientiert sich der Schätzwert am Discogs `price_high`.
* Bei `Very Good Plus` orientiert sich der Schätzwert am Discogs `price_median`.
* Bei schlechteren Zuständen (`VG` und darunter) wird der Schätzwert proportional zwischen `price_median` und `price_low` bzw. unterhalb `price_low` skaliert.

### 2.4 Aggregation & Gesamtwert
* Der Gesamtwert der Sammlung wird in der konfigurierten Primärwährung (EUR) summiert und über den Endpunkt `GET /api/collection/value` sowie das MCP-Tool `get_collection_value` bereitgestellt.
