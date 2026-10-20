## ADDED Requirements

### Requirement: Inventurliste
Die Vorlage `inventory` MUST eine nach berechnetem Lagerplatz gruppierte Tabelle erzeugen (Regale in ihrer Reihenfolge, darin Fächer aufsteigend, „Ohne Platz“ am Ende) und CDs einschließen. Jede Gruppe MUST eine Überschrift mit Regal, Fach und Anzahl tragen.

#### Scenario: Zeilen und Seitenaufbau
- **WHEN** eine Inventurliste erzeugt wird
- **THEN** enthält jede Zeile Künstler, Titel, Jahr, Format, Discogs-ID und ein leeres Ankreuzfeld, und jede Seite trägt Titel mit Erstellungsdatum, Spaltenköpfe und „Seite x von y“

#### Scenario: Gruppierte Inventurliste
- **WHEN** Platten aus „Kallax-1“ Fach 1 und 2 sowie Platten ohne Platz gedruckt werden
- **THEN** erscheinen die Gruppen „Kallax-1 · Fach 1“, „Kallax-1 · Fach 2“, „Ohne Platz“ in dieser Reihenfolge, jeweils mit Anzahl, und innerhalb der Gruppe in Regal-Sortierung

#### Scenario: Gruppe über Seitenwechsel
- **WHEN** eine Gruppe nicht mehr auf die aktuelle Seite passt
- **THEN** wird sie auf der Folgeseite mit wiederholten Spaltenköpfen und der Gruppenüberschrift mit Zusatz „(Forts.)“ bzw. „(cont.)“ fortgesetzt

#### Scenario: Ohne Regale
- **WHEN** für das Medium keine Regale konfiguriert sind
- **THEN** stehen alle Exemplare in der Gruppe „Ohne Platz“ bzw. „No location“

## MODIFIED Requirements

### Requirement: Umfang des Ausdrucks wählen
Der Ausdruck MUST wahlweise die ganze Sammlung, die Platten zu den Filtern der Sammlungsansicht (Suche, Kategorie, Genres, Jahre, Hörstatus, Lagerplatz, Sortierung) oder eine Liste markierter Discogs-IDs umfassen. Ohne angegebene Sortierung MUST nach Künstler in Regal-Sortierung sortiert werden; die Vorlage `inventory` MUST unabhängig vom Umfang nach Lagerplatz gruppieren.

#### Scenario: Ganze Sammlung
- **WHEN** der Umfang „ganze Sammlung“ gewählt ist
- **THEN** enthält das PDF jedes Exemplar der Sammlung des Nutzers genau einmal (mehrfach vorhandene Platten entsprechend mehrfach), nach Künstler sortiert

#### Scenario: Aktuelle Filter
- **WHEN** der Umfang „Filter“ mit z. B. Genre „Jazz“ gewählt ist
- **THEN** enthält das PDF genau die Platten, die die Sammlungsansicht mit diesen Filtern anzeigt, in deren Sortierung

#### Scenario: Filter nach Lagerplatz
- **WHEN** der Umfang „Filter“ mit Regal „Kallax-1“ gewählt ist
- **THEN** enthält das PDF genau die Exemplare, die rechnerisch in diesem Regal liegen

#### Scenario: Markierte Platten
- **WHEN** der Umfang „Auswahl“ mit einer Liste von Discogs-IDs gewählt ist
- **THEN** enthält das PDF nur die Exemplare dieser Platten; IDs, die nicht zur Sammlung des Nutzers gehören, werden ignoriert

#### Scenario: Leerer Umfang
- **WHEN** der gewählte Umfang keine Platte der Sammlung ergibt
- **THEN** antwortet das System mit 400 und RFC-7807-Problem-Details
