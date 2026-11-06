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

### 2.2 Discogs-Preisvorschläge
* Für jedes Discogs-Release werden bei der Anzeige und auf Anfrage (`POST /api/collection/prices/refresh`) die Preisvorschläge von der Discogs Marketplace API (`/marketplace/price_suggestions/{id}`) abgerufen: ein Preis pro Goldmine-Zustand.
* Gespeichert werden pro Release in `record_cache`:
  - `median_price`: der Preisvorschlag für den Zustand der Platte (Spalte „Wert“).
  - `lowest_price`: der Preisvorschlag für `Good Plus (G+)`, sonst `Very Good Plus (VG+)`.
* Discogs liefert keinen Durchschnitts-Angebotspreis und keine Verkaufshistorie über die API; der Preisvorschlag ist der nächste verfügbare Wert.

### 2.3 Wert passend zum Zustand
* Der Wert (`median_price`) ist der Preisvorschlag für den **Medium-Zustand** (`media_condition`) der Platte. Der Cover-Zustand fließt nicht ein.
* Fehlt der Preisvorschlag für diesen Zustand oder ist kein Zustand gesetzt, gilt: `Very Good Plus (VG+)`, sonst der erste positive Wert von `Mint (M)` bis `Poor (P)`.
* Hat ein Release mehrere Exemplare in verschiedenen Zuständen, bestimmt das **beste** Exemplar den Wert (ein Wert pro Release).
* Der Preis-Refresh und die Neuberechnung bei einer Zustandsänderung verwenden dieselbe Logik.

### 2.4 Aggregation & Gesamtwert
* Der Gesamtwert der Sammlung wird in der konfigurierten Primärwährung (EUR) summiert und über den Endpunkt `GET /api/collection/value` sowie das MCP-Tool `get_collection_value` bereitgestellt.
