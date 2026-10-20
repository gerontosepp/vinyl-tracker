# Delta-Spezifikation: Druck-Modul (Print)

## Purpose

Das Druck-Modul erzeugt aus der Sammlung eines Nutzers druckfertige PDF-Dokumente anhand auswählbarer Vorlagen (Etiketten, Listen, Karten), damit Platten physisch beschriftet, gescannt und verwaltet werden können.

## ADDED Requirements

### Requirement: PDF-Ausdruck aus einer Vorlage erzeugen
Das System MUST über `POST /api/print` für den angemeldeten Nutzer ein PDF (`application/pdf`, A4 hochkant) aus einer angegebenen Vorlage erzeugen. Die Plattendaten MUST der Server aus der Sammlung des Nutzers lesen.

#### Scenario: Ausdruck erzeugen
- **WHEN** ein angemeldeter Nutzer `POST /api/print` mit einer gültigen Vorlage und Auswahl sendet
- **THEN** antwortet das System mit 200, `Content-Type: application/pdf` und einem Dateinamen, der die Vorlage enthält

#### Scenario: Nicht angemeldet
- **WHEN** die Anfrage ohne gültige Anmeldung gesendet wird
- **THEN** antwortet das System mit 401

#### Scenario: Unbekannte Vorlage
- **WHEN** eine nicht existierende Vorlage angefordert wird
- **THEN** antwortet das System mit 400 und RFC-7807-Problem-Details, die die verfügbaren Vorlagen nennen

### Requirement: Umfang des Ausdrucks wählen
Der Ausdruck MUST wahlweise die ganze Sammlung, die Platten zu den Filtern der Sammlungsansicht (Suche, Kategorie, Genres, Jahre, Hörstatus, Sortierung) oder eine Liste markierter Discogs-IDs umfassen. Ohne angegebene Sortierung MUST nach Künstler in Regal-Sortierung sortiert werden.

#### Scenario: Ganze Sammlung
- **WHEN** der Umfang „ganze Sammlung“ gewählt ist
- **THEN** enthält das PDF jedes Exemplar der Sammlung des Nutzers genau einmal (mehrfach vorhandene Platten entsprechend mehrfach), nach Künstler sortiert

#### Scenario: Aktuelle Filter
- **WHEN** der Umfang „Filter“ mit z. B. Genre „Jazz“ gewählt ist
- **THEN** enthält das PDF genau die Platten, die die Sammlungsansicht mit diesen Filtern anzeigt, in deren Sortierung

#### Scenario: Markierte Platten
- **WHEN** der Umfang „Auswahl“ mit einer Liste von Discogs-IDs gewählt ist
- **THEN** enthält das PDF nur die Exemplare dieser Platten; IDs, die nicht zur Sammlung des Nutzers gehören, werden ignoriert

#### Scenario: Leerer Umfang
- **WHEN** der gewählte Umfang keine Platte der Sammlung ergibt
- **THEN** antwortet das System mit 400 und RFC-7807-Problem-Details

### Requirement: Avery-Etiketten 70×37 mm
Die Vorlage `avery-3474` MUST pro A4-Seite ein Raster aus 3 Spalten × 8 Zeilen à 70×37 mm (Avery Zweckform 6605/3474) ohne Seitenüberschrift füllen. Jedes Etikett MUST einen QR-Code `discogs-id:<id>`, Titel, Künstler und Discogs-ID enthalten; Inhalte MUST mindestens 4 mm Abstand zum Etikettenrand halten.

#### Scenario: Volle Seite
- **WHEN** 25 Platten mit `avery-3474` gedruckt werden
- **THEN** enthält Seite 1 24 Etiketten zeilenweise von links oben, Seite 2 das 25. Etikett links oben

#### Scenario: Lange Titel
- **WHEN** Titel oder Künstler nicht auf das Etikett passen
- **THEN** werden sie gekürzt und mit „…“ beendet, ohne über das Etikett hinauszuragen

#### Scenario: Etikett scannen
- **WHEN** der QR-Code eines gedruckten Etiketts gescannt wird
- **THEN** erkennt der Scanner die Platte wie bei den bisherigen QR-Codes und protokolliert einen Hörvorgang

### Requirement: Druckbeginn ab Etikett N
Für `avery-3474` MUST eine Startposition 1–24 angegeben werden können; die Felder davor bleiben auf der ersten Seite leer. Werte außerhalb 1–24 MUST mit 400 abgelehnt werden. Ohne Angabe gilt Position 1.

#### Scenario: Angebrochener Bogen
- **WHEN** 3 Platten mit Startposition 23 gedruckt werden
- **THEN** stehen auf Seite 1 die Etiketten an Position 23 und 24 und auf Seite 2 das dritte Etikett an Position 1

#### Scenario: Ungültige Startposition
- **WHEN** die Startposition 0 oder 25 ist
- **THEN** antwortet das System mit 400 und RFC-7807-Problem-Details

### Requirement: CDs bei Etiketten bestätigen
Etiketten sind für Schallplatten gedacht. Kann der gewählte Umfang beim Druck der Vorlage `avery-3474` CDs enthalten (ganze Sammlung, Filter ohne Einschränkung auf Platten oder Auswahl mit mindestens einer CD), MUST der Druck-Dialog vor dem Erzeugen eine ausdrückliche Bestätigung verlangen.

#### Scenario: Ganze Sammlung als Etiketten
- **WHEN** der Nutzer in den Einstellungen Etiketten für die ganze Sammlung drucken will
- **THEN** zeigt der Dialog einen Hinweis auf CDs, und „PDF erstellen“ ist erst nach Bestätigung möglich

#### Scenario: Auf Platten gefiltert
- **WHEN** die Sammlung auf die Kategorie „Platten“ gefiltert ist und der Umfang „aktuelle Filter“ gewählt ist
- **THEN** verlangt der Dialog keine Bestätigung

#### Scenario: Auswahl ohne CDs oder andere Vorlage
- **WHEN** nur Schallplatten markiert sind oder eine Liste bzw. QR-Karten gedruckt werden
- **THEN** verlangt der Dialog keine Bestätigung

### Requirement: Scan-Liste
Die Vorlage `scan-list` MUST eine Tabelle mit je einer Zeile pro Platte erzeugen: scanbarer QR-Code `discogs-id:<id>` (mindestens 15 mm Kantenlänge), Künstler, Titel, Jahr, Format und Discogs-ID. Jede Seite MUST Spaltenköpfe, Titel mit Erstellungsdatum und Seitenzahl „Seite x von y“ tragen.

#### Scenario: Mehrseitige Liste
- **WHEN** mehr Platten gedruckt werden, als auf eine Seite passen
- **THEN** wird die Tabelle auf Folgeseiten mit wiederholten Spaltenköpfen fortgesetzt und jede Seite nummeriert

#### Scenario: Von der Liste scannen
- **WHEN** ein QR-Code der Scan-Liste gescannt wird
- **THEN** protokolliert das System einen Hörvorgang für die Platte dieser Zeile

### Requirement: QR-Karten
Die Vorlage `qr-cards` MUST das bisherige Layout erzeugen: 9 Karten (3×3) pro A4-Seite mit Seitenüberschrift, Titel, Künstler, QR-Code und Discogs-ID.

#### Scenario: Karten drucken
- **WHEN** 10 Platten mit `qr-cards` gedruckt werden
- **THEN** enthält Seite 1 neun Karten und Seite 2 eine Karte

### Requirement: Sprache der Beschriftung
Feste Texte im PDF (Spaltenköpfe, Titel, Seitenzahlen) MUST in der angeforderten Sprache (`de` oder `en`, Standard `de`) erscheinen.

#### Scenario: Englische Scan-Liste
- **WHEN** eine Scan-Liste mit Sprache `en` angefordert wird
- **THEN** lauten die Spaltenköpfe „Artist“, „Title“, „Year“, „Format“, „ID“ und die Seitenzahl „Page x of y“

### Requirement: Druck-Dialog im Frontend
Das Frontend MUST einen Druck-Dialog bereitstellen, der Vorlage, Umfang und (nur bei Etiketten) Start-Etikett abfragt und das PDF herunterlädt. Er MUST aus der Sammlung (Umfang „Auswahl“, sonst „aktuelle Filter“) und den Einstellungen (Umfang „ganze Sammlung“) erreichbar sein; alle Texte MUST auf Deutsch und Englisch vorliegen.

#### Scenario: Etiketten für markierte Platten
- **WHEN** der Nutzer in der Sammlung Platten markiert, „Drucken“ wählt, die Vorlage „Avery-Etiketten“ und Start-Etikett 5 einstellt und bestätigt
- **THEN** lädt der Browser ein PDF mit genau diesen Platten ab Etikett 5 herunter

#### Scenario: Fehler beim Erzeugen
- **WHEN** das Erzeugen des PDFs fehlschlägt
- **THEN** zeigt das Frontend die Fehlermeldung des Servers als Toast, und der Dialog bleibt offen
