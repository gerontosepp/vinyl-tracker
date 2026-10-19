# Delta-Spezifikation: Roon Core Audio-Integration (Roon)

## MODIFIED Requirements

### Requirement: Album-Wiedergabe auf Roon-Zone
Das System MUST die Wiedergabe eines Albums auf einer angegebenen oder der hinterlegten Standard-Zone starten (`POST /api/roon/play`).

#### Scenario: Album abspielen
- **WHEN** ein Abspielbefehl mit Record-ID und optionaler Zone-ID gesendet wird
- **THEN** durchsucht das System die Roon-Bibliothek nach dem Album, startet die Wiedergabe auf der Zielzone und protokolliert parallel ein Hör-Event.

#### Scenario: Album mit expliziter Zone abspielen
- **GIVEN** Roon ist verbunden und mehrere Zonen existieren
- **WHEN** ein Abspielbefehl mit Record-ID und expliziter `zone_id` gesendet wird
- **THEN** startet das System die Wiedergabe auf der angegebenen Zielzone.

#### Scenario: Album mit Standard-Zone abspielen
- **GIVEN** ein Abspielbefehl wird ohne `zone_id` gesendet
- **WHEN** die Standard-Zone des Nutzers konfiguriert ist
- **THEN** startet das System die Wiedergabe auf der Standard-Zone.

## ADDED Requirements

### Requirement: Dynamische Zonenauswahl im Frontend
Das Record-Detail-Modal MUST dem Nutzer verfügbare Roon-Zonen zur Auswahl anbieten und die zuletzt verwendete Zone für die laufende Sitzung beibehalten.

#### Scenario: Zonenauswahl im Detail-Modal anzeigen
- **GIVEN** der Nutzer öffnet die Detailansicht eines Albums bei verbundenem Roon Core
- **WHEN** der Nutzer das Zonen-Auswahlmenü aufruft
- **THEN** werden alle aktiven Roon-Zonen aufgelistet und die Standard- bzw. gemerkte Zone hervorgehoben.
