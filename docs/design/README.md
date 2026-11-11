# Layout-Vorschläge (Mockups)

Statische, klickbare HTML-Mockups für ein aufgeräumtes Frontend. Sie bilden den Ist-Zustand
von Vinyl Tracker nach (Angular 22, Tailwind 4, Amber/Stone-Tokens) und schlagen drei Varianten
für App-Shell, Sammlung und Detailansicht vor.

**Wichtig:** Hier liegt kein Produktionscode. `frontend/` bleibt unverändert; die Dateien haben
keine Build-Abhängigkeit und kein Tailwind – nur HTML, CSS (`styles.css`) und etwas Vanilla-JS
für die Interaktionen.

## Öffnen

```bash
open docs/design/index.html
```

Kein Server nötig. Die Theme-Wahl (hell/dunkel) wird in `localStorage` gespeichert.

## Varianten

| Datei | Variante | Kern |
|---|---|---|
| `variant-a.html` | **Rail 2.0** | Eine Nav-Konfiguration für Rail, Bottom-Nav und Palette · Scannen als Menüpunkt (mobil FAB) · ein Scroll-Container · ⌘B/⌘K |
| `variant-b.html` | **Konsole** | Sidebar mit Labels und Gruppen · Split-View statt Modal · Deep-Link pro Album · Filter im Popover |
| `variant-c.html` | **Sleeve-first** | Cover-Wand mit Dichte S/M/L · Detail als eigene Seite · Dashboard als Magazin |

Interaktionen zum Ausprobieren:

- **A:** `⌘B` klappt die Rail auf/zu, `⌘K` öffnet die Befehlspalette (Tippen filtert).
- **B:** Klick auf eine Zeile tauscht die Detail-Pane (Titel, Cover, Tracklist, Zustand, Regal).
- **C:** Dichte S/M/L ändert die Cover-Größe; Hover zeigt die Aktionen.
- Dark Mode über den Mond-Button oben rechts; wirkt auf allen Seiten.

Jede Seite enthält zusätzlich einen Mobil-Rahmen (390 px) bzw. eine responsive Mobil-Ansicht,
damit Bottom-Nav, FAB und Karten-Dichte vergleichbar sind.

## Empfehlung

**B als Zielbild, A als Einstieg, C als Phase 3.** Jede Phase ist einzeln auslieferbar:

1. **Fundament** – Nav-Konfiguration als Single Source of Truth, Scan als Menüpunkt (mobil FAB),
   ein Scroll-Container, sticky Page-Header, Inhaltsbreite + Dichte-Token.
2. **Arbeiten** – Split-View und Detail-Route, Filter-Sheet mit Chip-Band, Command-Palette,
   Tastatur-Shortcuts.
3. **Erleben** – Cover-Wand als dritte Ansicht, Dashboard-Hero mit letzter Platte und Hör-Timeline.

Details und Begründung: `index.html` im Browser öffnen.

## Stand der Umsetzung

**Variante A ist umgesetzt** (Stand 2026-11-11):

- `frontend/src/app/core/navigation.ts` – eine Konfiguration für Rail, Bottom-Nav und Palette
  (`navItemsFor(surface)`, `isNavItemActive` inkl. Query-Varianten für Liste/Regale)
- `frontend/src/app/core/services/navigation-ui.service.ts` – Rail-Zustand (persistiert),
  Palette, „Mehr"-Sheet und aktive Ziele
- `frontend/src/app/shared/components/layout/` – Shell mit sticky Page-Bereichen, Scan-Menüpunkt/FAB,
  ⌘B/⌘K, `command-palette/`, `nav-icon/`, neue `sidebar/` und `bottom-nav/`
- Sammlung: eine Scroll-Fläche statt fester Höhen, sticky Toolbar, Regale über
  `/collection?view=shelves` (Deep-Link + aktiver Nav-Eintrag)
- Sortiermodus ist ein Phone-Workflow: er liegt nur im mobilen „Mehr"-Sheet, nicht in der
  Desktop-Rail und nicht in der Befehlspalette
- Einstellungen sind jetzt direkt in der Navigation erreichbar (`/settings`); der alte
  Profil-Einstieg `/profile` bleibt als Alias bestehen

Die Mockups bleiben unverändert als Referenz für Phase 2 (Split-View, Filter-Sheet) und
Phase 3 (Cover-Wand) erhalten.

## Bezug zum Ist-Code

Die Mockups orientieren sich an den realen Bausteinen, damit die Umsetzung ohne Neuinterpretation
möglich ist:

- Shell: `frontend/src/app/shared/components/layout/` (`layout`, `sidebar`, `bottom-nav`, `top-menu-bar`)
- Navigation heute: Desktop-Rail ohne Sortieren/Settings, Bottom-Nav ohne Hilfe, Label-Inbox ohne
  eigenen Einstieg → Ziel: gemeinsame Konfiguration, z. B. `core/navigation.ts`
- Sammlung: `features/collection/` (Toolbar, Table, Card-List, Shelf-View, Detail-Modal)
- Tokens: `frontend/src/styles.css` (Amber-Akzent, Stone im Dark Mode, `rounded-2xl`-Karten)

Bewusst unverändert: Farb- und Typo-System, Karten-Sprache, Hilfe-Anker (`app-help-link`),
Touch-Ziel-Größen und Fokus-Ringe.
