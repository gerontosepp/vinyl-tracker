## ADDED Requirements

### Requirement: Scan-Widget außerhalb des Scanner-Bildschirms
Nach einem Scan mit Hör-Ereignis, während der Scanner-Bildschirm nicht offen ist, MUST die App auf der aktuellen Seite bleiben und die Platte als schwebendes Widget unten rechts mit Titel, Künstler, Cover und „Jetzt aufgelegt“ anzeigen. Solange der Scanner-Bildschirm offen ist, DARF kein Widget erscheinen; dort gilt die Inline-Anzeige. Scans, die eine Entscheidung brauchen oder im Identify Mode laufen, MUST weiterhin den Scanner-Bildschirm öffnen.

#### Scenario: Scan auf einer beliebigen Seite
- **WHEN** der Nutzer auf der Sammlung einen Barcode scannt, der ein Hör-Ereignis erfasst
- **THEN** bleibt die Sammlung sichtbar, und unten rechts erscheint das Widget mit Cover, Titel und Künstler der Platte

#### Scenario: Scanner-Bildschirm bleibt unverändert
- **WHEN** der Scanner-Bildschirm offen ist und ein Scan ein Hör-Ereignis erfasst
- **THEN** zeigt der Scanner seine Inline-Karte und kein zusätzliches Widget

#### Scenario: Entscheidung oder Identify Mode
- **WHEN** ein Scan einen Discogs-Treffer zur Auswahl liefert oder im Identify Mode läuft
- **THEN** öffnet sich der Scanner-Bildschirm wie bisher und es erscheint kein Widget

### Requirement: Anzeigedauer des Scan-Widgets
Das Widget MUST nach der konfigurierten Anzeigedauer verschwinden. Ein weiterer Scan MUST es ersetzen und die Anzeigedauer neu starten.

#### Scenario: Ausblenden nach der eingestellten Dauer
- **WHEN** die eingestellte Anzeigedauer seit dem Erscheinen des Widgets vergangen ist, ohne dass der Nutzer es berührt hat
- **THEN** verschwindet das Widget

#### Scenario: Neuer Scan ersetzt das Widget
- **WHEN** innerhalb der Anzeigedauer eine weitere Platte gescannt wird
- **THEN** zeigt das Widget die neue Platte und die Anzeigedauer beginnt neu

### Requirement: Interaktion mit dem Scan-Widget
Interaktion mit dem Widget MUST den Timeout pausieren; nach dem Verlassen MUST die verbleibende Zeit weiterlaufen. Ein Close-Button MUST das Widget sofort schließen. Ein Klick auf die Platte MUST die Detailansicht der Platte in der Sammlung öffnen.

#### Scenario: Hover pausiert den Timeout
- **WHEN** der Nutzer den Mauszeiger über das Widget bewegt
- **THEN** bleibt es länger als die eingestellte Dauer sichtbar, und nach dem Verlassen läuft die Restzeit weiter

#### Scenario: Fokus pausiert den Timeout
- **WHEN** der Nutzer das Widget per Tastatur fokussiert
- **THEN** pausiert der Timeout, bis der Fokus das Widget wieder verlässt

#### Scenario: Close-Button
- **WHEN** der Nutzer den Close-Button betätigt
- **THEN** verschwindet das Widget sofort

#### Scenario: Platte öffnen
- **WHEN** der Nutzer auf die Platte im Widget klickt
- **THEN** öffnet sich die Detailansicht der Platte in der Sammlung
