# Proposal: Scan-Widget über der aktuellen Ansicht (#380)

## Problem

Nach einem Scan landet man immer auf der Startseite mit dem Scanner-Bildschirm. Wer beim Durchblättern der Sammlung, in den Regalen oder beim Einstellen etwas scannt, verliert den Kontext. Die Bestätigung „Jetzt aufgelegt!“ ist nur auf dem Scanner-Bildschirm sichtbar, und nach dem Schließen ist sie weg.

## Lösung

Ein schwebendes Widget unten rechts zeigt die zuletzt gescannte Platte auf jeder Seite. Es bleibt für die konfigurierte Anzeigedauer sichtbar, pausiert bei Interaktion mit dem Widget, lässt sich über einen Close-Button schließen und öffnet per Klick die Detailansicht der Platte.

## Umfang

- Hardware-, Kamera- und manuelle Scans mit Hör-Ereignis.
- Die bestehende Anzeigedauer aus Einstellungen → Barcode & QR Scanner (5–120 s, Standard 30) wird wiederverwendet.
- Das Widget erscheint nur außerhalb des Scanner-Bildschirms; dort bleibt die Inline-Karte „Jetzt aufgelegt!“.
- Ein weiterer Scan ersetzt das Widget und startet die Zeit neu.

## Nicht im Umfang

- Änderungen an der Einstellung der Anzeigedauer.
- Ein Widget im Identify Mode (es entsteht kein Hör-Ereignis).
- Mehrere Widgets gleichzeitig oder eine Benachrichtigung außerhalb der App.
- Öffnen der Detailansicht aus einem neuen Browser-Tab oder per Deep-Link.
