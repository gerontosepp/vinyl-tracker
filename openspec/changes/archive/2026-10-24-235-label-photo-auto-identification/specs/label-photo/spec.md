## ADDED Requirements

### Requirement: Automatische Erkennung per OpenRouter
Hat der Nutzer einen OpenRouter-API-Key hinterlegt, MUST das Backend jedes neu hochgeladene Label-Foto im Hintergrund mit dem gewählten Modell erkennen und den Vorschlag (bester Treffer, Alternativen, Sicherheit, Begründung, Hinweis) am Foto speichern. Das Modell MUST nur lesende Tools erhalten; vorgeschlagene Discogs-IDs MUST aus Tool-Ergebnissen derselben Erkennung stammen. Ohne Key MUST sich das Verhalten nicht ändern. Der Key MUST verschlüsselt gespeichert und nie ausgeliefert werden.

#### Scenario: Foto wird erkannt
- **WHEN** der Nutzer mit hinterlegtem Key ein Label fotografiert
- **THEN** zeigt die Label-Inbox nach der Erkennung die vorgeschlagene Pressung zur Bestätigung

#### Scenario: Erfundene Release-ID
- **WHEN** das Modell eine Discogs-ID vorschlägt, die keine Suche geliefert hat
- **THEN** wird die Erkennung als Fehler gespeichert und kann erneut gestartet werden

#### Scenario: Bestätigen
- **WHEN** der Nutzer in der Label-Inbox „Hinzufügen“ wählt
- **THEN** wird die Platte zur Sammlung hinzugefügt, das Foto als `identified` abgeschlossen und der Regalplatz angezeigt
