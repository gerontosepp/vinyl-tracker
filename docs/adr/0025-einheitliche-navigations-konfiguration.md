# ADR-0025: Eine Navigations-Konfiguration für Rail, Bottom-Nav und Befehlspalette

* **Status:** Accepted
* **Datum:** 2026-11-11
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#371](https://github.com/gerontosepp/vinyl-tracker/issues/371)

---

## Kontext & Problemstellung

Die App hatte drei Navigationsflächen – Desktop-Seitenleiste, untere Leiste (Handy) und die mit ⌘K geöffnete Befehlspalette –, die jeweils eigene Listen mit Pfaden, Labels und Icons pflegten. Dadurch liefen Reihenfolge, Icon-Größen und Sichtbarkeit auseinander, und jede neue Seite musste an mehreren Stellen ergänzt werden. Hinzu kamen Flächen-spezifische Sonderfälle (Scannen als eigener CTA-Button, Sortieren nur mobil, Hilfe und Einstellungen an unterschiedlichen Positionen).

## Entscheidungstreiber

* **Konsistenz:** Dieselbe Seite soll überall denselben Namen, dasselbe Icon und dieselbe Position haben.
* **Wartbarkeit:** Ein neues Ziel wird genau einmal ergänzt.
* **Testbarkeit:** Reihenfolge und Sichtbarkeit lassen sich ohne DOM-Tests prüfen.

## Betrachtete Optionen

* **Option 1: Zentrale Konfiguration `NAV_ITEMS` (Gewählt)**
  * *Vorteile:* Eine Liste mit `path`, `labelKey`, `icon`, `surfaces`, `exact`, `queryParams`, `phoneOnly`, `pinned` und `action`; alle Flächen rendern daraus und sortieren nur nach der eigenen Flächen-Priorität. Sichtbarkeitsregeln (mobil-only, Aktion statt Route, am unteren Rand gepinnt) sind reine Daten.
  * *Nachteile:* Die Konfiguration muss die Bedürfnisse aller Flächen kennen; Sonderfälle wie eine Aktion ohne Route (`action: 'scan'`) erweitern den Typ.

* **Option 2: Je Fläche eine eigene Liste**
  * *Nachteile:* Genau der Ausgangszustand – doppelte Pflege, auseinanderlaufende Reihenfolge.

* **Option 3: Navigation aus den Routen generieren**
  * *Vorteile:* Keine zusätzliche Liste.
  * *Nachteile:* Routen kennen weder Labels, Icons noch Sichtbarkeit pro Fläche (z. B. Sortieren nur mobil) und enthalten auch nicht-navigierbare Einträge.

## Entscheidung

* `frontend/src/app/core/navigation.ts` ist die Single Source of Truth. Jede Fläche filtert über `navItemsFor(surface)` und behält ihre eigene Priorität.
* Sichtbarkeit ist deklarativ: `phoneOnly` (nur mobiles „Mehr“-Sheet), `action` (Aktion ohne Route, z. B. Scannen) und `pinned` (am unteren Rand der Rail, z. B. Hilfe).
* `NavigationUiService` hält den einzigen veränderlichen Zustand (Rail aufgeklappt, Palette offen, aktive Einträge) und persistiert die Rail-Breite in `localStorage`.

## Konsequenzen

### Positive Effekte
* Reihenfolge, Icons (22 px) und Labels sind in allen Flächen identisch; neue Ziele brauchen einen Eintrag.
* Unit-Tests prüfen die Konfiguration direkt (Reihenfolge, `phoneOnly`, `pinned`) statt drei Komponenten einzeln.

### Nachteile & Risiken
* Der Typ `NavItem` wächst mit jeder neuen Sonderrolle; zu viele Flags machen die Konfiguration unübersichtlich.
* Die Palette ist bewusst keine Volltextsuche über Alben, sondern springt zu Zielen und globalen Aktionen – eine spätere Suche müsste als eigene Quelle ergänzt werden.
