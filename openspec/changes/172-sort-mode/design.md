# Design: Sortier-Modus (#172)

## Context

Die Belegung (Regal, Fach je Exemplar) wird aus gespeicherten Fachgrenzen berechnet (`StorageService`, ADR-0020). `Layout.items` ist bereits in Regal-Reihenfolge sortiert, `Layout.slot(i)` liefert den Lagerplatz, Exemplare ohne Platz stehen am Ende. Die Sammlungsliste liefert Lagerplätze nur seitenweise und ohne Garantie, dass die Sortierung zur Belegung passt; `LayoutItem` enthält kein Cover. Die Startseite (`DashboardComponent`) nutzt `app-layout` mit Navigation; ein Vollbild-Screen ohne Navigation existiert noch nicht.

## Goals / Non-Goals

**Goals:** einhändig bedienbarer, ablenkungsfreier Screen; Reihenfolge exakt wie die Regal-Übersicht; Start an beliebigem Fach; funktioniert offline-tolerant nach dem Laden (keine Requests beim Blättern).

**Non-Goals:** Fortsetzen nach Abbruch, Abhaken einzelner Platten, Desktop-Variante, Sortieren mehrerer Medien in einer Sitzung.

## Decisions

### 1. Eigener Endpunkt statt Sammlungsliste
`GET /api/storage/sequence?media=` liefert die komplette Sequenz eines Mediums in einem Request: `StorageSequenceDto { media, items: [{ discogsId, instanceId, artist, title, thumbUrl, slot }] }`. Die Sammlungs-API wäre seitenweise (max. 100) und müsste mehrfach geladen werden; die Sequenz kommt direkt aus `Layout` und ist damit garantiert identisch mit Übersicht und Lagerplatz-Anzeige. Dafür bekommt `LayoutItem` ein optionales `thumb_url` (eine Spalte mehr in der bestehenden `items`-Abfrage). Lesend, speichert nichts. Ungültiges Medium → 400, ohne Regale → leere Liste.

### 2. Snapshot beim Start
Der Client lädt die Sequenz einmal beim Start und blättert lokal. So ändert sich die Reihenfolge nicht, falls währenddessen ein Sync läuft, und „Weiter“ reagiert sofort.

### 3. Startposition und Fortschritt im Client
Startindex = erstes Element mit `slot.unitId == Regal` und Fachnummer ≥ gewähltes Fach (`(zeile-1)*spalten + spalte`); gibt es keins im Regal, das erste Element eines späteren Regals bzw. das erste ohne Platz. Fortschritt „12 / 70“ = Position im Fach / Anzahl der Exemplare mit gleichem Lagerplatz (aus der Sequenz gezählt, nicht die Kapazität). Fachwechsel = Lagerplatz (Regal + Fach bzw. „ohne Platz“) unterscheidet sich vom vorigen Element.

### 4. Eigene Route ohne Layout
Route `/sort` (authGuard) lädt `SortModeComponent` aus `features/sort-mode/`, ohne `app-layout`: Vollbild (`min-h-dvh`), Safe-Area-Abstände, Daumenzone unten für die Buttons („Weiter“ volle Breite, groß; darüber klein „Zurück“ und „Beenden“). Zustände als Signal: `setup` → `sorting` → `done`. Start-Screen: Regal-Auswahl (aus `GET /api/storage/layout`, vorbelegt mit dem ersten; das Medium ist das des Regals), Zeile und Spalte als Zahlenfelder mit Grenzen aus dem Raster.

### 5. Einstieg auf der Startseite
Button „Sortieren“ mit `md:hidden` im Dashboard, sichtbar, wenn `GET /api/storage/units` mindestens ein Regal liefert (ein kleiner Request beim Laden der Startseite; Fehler werden ignoriert, dann kein Button). Navigiert zu `/sort`.

### 6. Wake Lock
`navigator.wakeLock?.request('screen')` beim Wechsel in `sorting`; bei `visibilitychange` (sichtbar) erneut anfordern, da der Browser die Sperre beim Verlassen freigibt; `release()` bei `done`, „Beenden“ und `ngOnDestroy`. Fehler (nicht unterstützt, verweigert) werden still ignoriert. Gekapselt in einem kleinen Service `WakeLockService` (testbar über ein Mock-`navigator`).

### 7. Cover
`thumbUrl` über `ApiService.getProxiedImageUrl` (wie in der Sammlung); ohne Cover ein Platzhalter. Das nächste Cover wird per `Image()` vorgeladen, damit „Weiter“ nicht flackert.

## Risks / Trade-offs

- **Große Sammlungen** → eine Sequenz mit einigen tausend Einträgen ist wenige hundert KB; akzeptabel, da einmalig.
- **Wake Lock nur in sicheren Kontexten** → die App läuft ohnehin unter HTTPS; ohne Unterstützung bleibt nur das Systemverhalten.
- **Belegung ändert sich nach dem Start** (z. B. Sync) → bewusst ignoriert (Snapshot); ein neuer Start lädt den aktuellen Stand.

## Migration Plan

Keine Migration. Rein additiv (neuer Endpunkt, neue Route); Rollback durch Entfernen.
