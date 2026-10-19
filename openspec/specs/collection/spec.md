# Spezifikation: Sammlungs-Verwaltung (Collection)

## 1. Übersicht & Zielsetzung
Die Sammlungs-Verwaltung bildet das funktionale Herzstück von Vinyl Tracker. Sie ermöglicht das Erfassen, Organisieren, Sortieren, Exportieren und Protokollieren physischer Schallplatten (Vinyl Releases) und zugehöriger Abspielvorgänge.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 Datenmodell & Entitäten
* **`records` (Tonträger)**:
  - Pflichtfelder: `id` (UUID/Integer), `title` (Titel), `artist` (Künstler), `release_year` (Erscheinungsjahr), `discogs_id` (eindeutige Discogs-Release-ID).
  - Zusätzliche Metadaten: `format` (z. B. LP, 2xLP, 7", 12"), `genres` & `styles` (JSON-Array), `label`, `catalog_number`, `cover_image_url`.
  - Zustandsbewertung: `media_condition` und `sleeve_condition` (Goldmine-Notation: M, NM, VG+, VG, G+, G, F, P).
  - Zeitstempel: `created_at`, `updated_at`, `last_played_at` (jeweils strikt in UTC).
* **`listen_events` (Hör-Protokoll)**:
  - Pflichtfelder: `id`, `record_id`, `played_at` (UTC).

### 2.2 Natürliche Kallax-Sortierung (Regal-Collation)
* Schallplatten müssen für die physische Regalablage (z. B. IKEA Kallax) nach Künstlernamen sortiert werden können:
  - Führende Artikel in gängigen Sprachen (`The `, `Die `, `Der `, `Das `, `A `, `An `, `Les `, `Le `, `La `) werden bei der Indexierung/Sortierung ignoriert (z. B. "The Beatles" sortiert unter "Beatles, The").
  - Deutsche Umlaute und Akzente werden normalisiert (`ä` -> `ae` oder Basisvokal `a`).
  - Sonderzeichen und Satzzeichen werden für den Sortierschlüssel bereinigt.

### 2.3 Sammlungs-Export & Backup
* **CSV-Export**: Tabellarische Übersicht aller erfassten Platten mit Kernmetadaten und Zuständen.
* **JSON-Backup**: Vollständiges Disaster-Recovery-Backup mit allen Relationen, Zeitstempeln und benutzerdefinierten Notizen.
* **Vektor-PDF-Export**: Druckfertige Inventarliste mit Alben-Covern und scannbaren QR-Codes (vektorbasiert via `printpdf`).

### 2.4 Hör-Historie & Statistiken
* Manuelles Protokollieren via Dashboard, MCP-Tool (`log_record_listen`) oder nach erfolgreichem Barcode-Scan.
* Automatische Aktualisierung des Feldes `last_played_at` auf den aktuellen UTC-Zeitstempel.
* Dashboard-Metriken: Zuletzt gehörte Alben, ungespielte Platten (*Shelf Warmers*), Top-Künstler und Genre-Verteilung.
