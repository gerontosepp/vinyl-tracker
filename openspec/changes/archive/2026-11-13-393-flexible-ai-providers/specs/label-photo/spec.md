# Spec Delta

## REMOVED Requirements

### Requirement: Automatische Erkennung per OpenRouter
**Reason**: Die Erkennung ist nicht mehr an OpenRouter gebunden, sondern nutzt die vom Nutzer konfigurierte Standard-KI-Verbindung.
**Migration**: Bestehende OpenRouter-Keys und -Modelle werden automatisch in eine OpenRouter-Verbindung übernommen (siehe Capability `ai-providers`).

## ADDED Requirements

### Requirement: Automatische Erkennung per Standard-Verbindung

Mit einer Standard-KI-Verbindung MUST das Backend jedes neu hochgeladene Label-Foto im Hintergrund mit deren Modell erkennen und den Vorschlag (bester Treffer, Alternativen, Sicherheit, Begründung, Hinweis) speichern. Das Modell MUST nur lesende Tools erhalten; vorgeschlagene Discogs-IDs MUST aus Tool-Ergebnissen derselben Erkennung stammen.

#### Scenario: Foto wird erkannt
- **WHEN** der Nutzer mit einer Standard-Verbindung ein Label fotografiert
- **THEN** zeigt die Label-Inbox nach der Erkennung die vorgeschlagene Pressung zur Bestätigung

#### Scenario: Erfundene Release-ID
- **WHEN** das Modell eine Discogs-ID vorschlägt, die keine Suche geliefert hat
- **THEN** wird die Erkennung als Fehler gespeichert und kann erneut gestartet werden

#### Scenario: Bestätigen
- **WHEN** der Nutzer in der Label-Inbox „Hinzufügen“ wählt
- **THEN** wird die Platte zur Sammlung hinzugefügt, das Foto als `identified` abgeschlossen und der Regalplatz angezeigt

#### Scenario: Anbieterfehler
- **WHEN** der Anbieter den Request ablehnt oder nicht erreichbar ist
- **THEN** wird die Erkennung mit einer anbieterneutralen Fehlermeldung als `error` gespeichert und kann erneut gestartet werden

### Requirement: Keine Standard-Verbindung

Ohne Standard-KI-Verbindung MUST das Backend den Upload unverändert als `pending` speichern und keine Erkennung starten. Der MCP-Weg MUST unverändert funktionieren.

#### Scenario: Upload ohne Verbindung
- **WHEN** der Nutzer ein Label-Foto ohne hinterlegte Standard-Verbindung hochlädt
- **THEN** bleibt das Foto `pending` und lässt sich über den MCP-Prompt bearbeiten

### Requirement: Anbieter und Modell nachvollziehbar

Das Foto MUST den verwendeten Anbieter und das Modell speichern und in der Label-Inbox anzeigen. Der API-Key MUST verschlüsselt gespeichert und nie ausgeliefert werden.

#### Scenario: Herkunft der Erkennung
- **WHEN** die Erkennung mit einer Verbindung „OpenAI“ und einer Modell-ID abgeschlossen ist
- **THEN** zeigt die Inbox „OpenAI · <Modell-ID>“ am Vorschlag
