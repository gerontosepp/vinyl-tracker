## ADDED Requirements

### Requirement: Label-Inbox in der PWA bearbeiten
Die PWA MUST unter `/label-inbox` die offenen Label-Fotos des Nutzers mit Aufnahmedatum anzeigen und das Löschen einzelner Fotos sowie aller offenen Fotos (nach Bestätigung) erlauben. Das Inbox-Badge der Scan-Seite MUST zu dieser Ansicht führen. `DELETE /api/label-photos` MUST alle Fotos des Nutzers löschen, mit `status` nur die Fotos dieses Status, und die Anzahl gelöschter sowie offener Fotos liefern.

#### Scenario: Alle offenen Fotos löschen
- **WHEN** der Nutzer in der Label-Inbox „Alle löschen“ bestätigt
- **THEN** werden nur seine offenen Fotos gelöscht und die Ansicht zeigt eine leere Inbox

#### Scenario: Einzelnes Foto löschen
- **WHEN** der Nutzer bei einem Foto „Löschen“ wählt
- **THEN** verschwindet nur dieses Foto aus der Inbox
