## ADDED Requirements

### Requirement: Cover in voller Auflösung
Ein Klick auf das Cover im Detail-Modal einer Platte MUST das Cover in voller Auflösung in einer Lightbox anzeigen. Die Lightbox MUST sich per Klick und mit Esc schließen lassen, ohne das Detail-Modal zu schließen. Das gilt überall, wo das Detail-Modal verwendet wird (Sammlung, Dashboard, Identify Mode).

#### Scenario: Cover vergrößern
- **WHEN** der Nutzer im Detail-Modal auf das Cover klickt
- **THEN** erscheint das Cover groß über dem Modal

#### Scenario: Lightbox schließen
- **WHEN** der Nutzer in der Lightbox Esc drückt
- **THEN** schließt nur die Lightbox, das Detail-Modal bleibt offen
