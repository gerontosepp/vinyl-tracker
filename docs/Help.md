# Hilfe

Diese Datei ist die Quelle der Hilfeseite in der App (`/help`). Jeder Abschnitt beginnt mit `## Titel {#anker}`; der Anker wird für Sprungmarken und die Kontext-Hilfe (?-Symbol) verwendet. Erlaubt sind Absätze, Listen, `###`-Zwischenüberschriften, **fett**, *kursiv*, `Code` und Links. Nach Änderungen erzeugt `node scripts/sync-help.js` die Daten für das Frontend (der Claude-Hook macht das automatisch). Die englische Fassung steht in `docs/Help.en.md`.

## Erste Schritte {#erste-schritte}

Vinyl Tracker verwaltet deine Platten und CDs auf Basis deiner **Discogs-Sammlung** und merkt sich, was du wann hörst.

1. **Discogs verbinden:** Unter **Einstellungen** deinen Discogs-Benutzernamen und einen persönlichen Token eintragen (auf discogs.com unter *Settings → Developers* erzeugen). Der Token wird verschlüsselt gespeichert.
2. **Sammlung abgleichen:** Mit **Sync** werden deine Discogs-Platten übernommen – inklusive Cover, Format, Genres und Marktwert.
3. **Hören erfassen:** Einen Barcode oder QR-Code scannen, oder in der Album-Detailansicht **Höre ich gerade** wählen.

Tipp: Fast jedes Symbol erklärt sich, wenn du mit der Maus darauf zeigst oder es auf dem Handy länger gedrückt hältst. Das **?**-Symbol auf einer Seite springt direkt zum passenden Abschnitt dieser Hilfe.

## Dashboard {#dashboard}

Die Startseite zeigt deine Hörgewohnheiten für einen wählbaren Zeitraum (heute, 7 Tage, 30 Tage, eigener Zeitraum):

- **Kürzlich gehört** – die zuletzt erfassten Hördurchgänge, steht ganz oben. Es sind zunächst die letzten 10; **Mehr anzeigen** zeigt alle im gewählten Zeitraum.
- **Meistgespielt** – wechselt zwischen **Alben** und **Künstlern**. Ein Klick auf einen Künstler öffnet die Sammlung, gefiltert nach diesem Künstler.
- **Wert der Sammlung** und **Genre-Verteilung** – Schätzwert in Euro (Median, Minimum, Maximum laut Discogs-Marktplatz).

Ein Klick auf ein Cover öffnet dieselbe Detailansicht wie in der Sammlung.

## Scannen {#scannen}

Über **Scan** in der Navigation erfasst du, dass du eine Platte hörst – oder fügst eine neue hinzu.

- **Barcode** (EAN/UPC auf dem Cover): Ist die Platte in deiner Sammlung, wird das Hören sofort erfasst. Sonst sucht Vinyl Tracker sie bei Discogs, zeigt die passenden Pressungen und fügt die gewählte deiner Discogs-Sammlung hinzu.
- **QR-Code** von gedruckten Vinyl-Tracker-Etiketten oder Scan-Listen: erfasst das Hören direkt.
- **Manuelle Eingabe:** Barcode abtippen, falls die Kamera ihn nicht liest.

### Identify-Modus {#identify-modus}

Mit dem Schalter **Identify-Modus** oben auf der Scan-Seite erfährst du, welche Platte du in der Hand hältst – ohne sie als gehört zu erfassen. Ist die gescannte Platte in deiner Sammlung, öffnet sich dieselbe Detailansicht wie beim Klick auf das Cover in der Sammlung (Regalplatz, Zustand, Preis). Nach dem Schließen ist der Scanner sofort bereit für die nächste Platte. Ist die Platte nicht in der Sammlung, läuft alles wie sonst: Discogs-Treffer, Übernahme oder manuell anlegen. Der Schalter wird gemerkt.

In der Detailansicht öffnet ein Klick auf das **Cover** das Bild in voller Auflösung; ein Klick oder **Esc** schließt es wieder.

### Scanner-Modus

Unter **Einstellungen → Barcode & QR Scanner** wählst du:

- **Externer Hardware-Scanner** (z. B. Eyoyo EY-009P, arbeitet wie eine Tastatur) – die Kamera bleibt aus und spart Akku.
- **Interner Kamera-Scanner** – Webcam oder Handykamera. Die Kamera funktioniert nur über **HTTPS**.
- **Hybrid** – beides gleichzeitig.

Mit **Scanner Live-Test** prüfst du, ob der Hardware-Scanner erkannt wird; auf Wunsch gibt es einen Bestätigungston.

Wird ein Scan nicht erkannt (z. B. weil der Scanner zu langsam sendet), erscheint außerhalb von Eingabefeldern der Hinweis „Scan nicht erkannt. Bitte erneut scannen.“

## Platten ohne Barcode (Label-Foto) {#label-foto}

Ältere Platten haben oft keinen Barcode. Dann hilft ein Foto des **Labels** (der Papieraufkleber in der Mitte der Platte).

1. Auf der Scan-Seite **Label fotografieren** wählen und das Label möglichst gerade und scharf aufnehmen. Das Foto wird verkleinert und ohne Standortdaten gespeichert.
2. Das Foto landet in der **Label-Inbox**. Der Zähler neben dem Button zeigt, wie viele Fotos warten; ein Tipp darauf öffnet die Inbox.

### Automatische Erkennung

Hast du unter **Einstellungen → Label-Erkennung (OpenRouter)** einen API-Key hinterlegt, erkennt die App jedes neue Foto im Hintergrund (meist 10–30 Sekunden). In der Label-Inbox erscheint dann ein **Vorschlag** mit Cover, Katalognummer, Land, Jahr, Sicherheit und Begründung – oft auch mit **anderen Pressungen** zur Auswahl.

- **Hinzufügen** übernimmt die gewählte Pressung in deine Sammlung und zeigt, in welches Regalfach sie gehört.
- **Nur abschließen** markiert das Foto als erledigt, ohne etwas hinzuzufügen – z. B. wenn die Platte schon in der Sammlung ist.
- **Erneut erkennen** startet die Erkennung noch einmal, etwa nach einem Fehler.
- Ein Hinweis schlägt manchmal ein weiteres Foto vor (andere Seite, Auslaufrille) – so lässt sich die genaue Pressung bestimmen.
- **Manuell anlegen** – gibt es die Platte nicht bei Discogs oder ist der Vorschlag unsicher, legst du sie selbst an; das vom Label Gelesene ist schon eingetragen (siehe **Platten ohne Discogs-Eintrag**).

Das Modell kann nur bei Discogs suchen und nie selbst etwas ändern. Jedes erkannte Foto kostet über OpenRouter meist wenige Cent und wird an OpenRouter und den Modellanbieter übertragen.

### Erkennung über Claude

Ohne API-Key erkennt Claude die Platten mit deinem Claude-Abo: In Claude Desktop oder Claude Code den Prompt `process_label_inbox` des Vinyl-Tracker-MCP-Servers starten (siehe **Claude & MCP**).

### Inbox aufräumen

In der Label-Inbox lassen sich einzelne Fotos oder **alle** offenen Fotos löschen. Ein Klick auf ein Foto zeigt es groß.

## Sammlung {#sammlung}

Die Sammlung zeigt alle Platten und CDs – als **Liste** oder als **Regale**.

- **Suche** nach Künstler oder Titel.
- **Filter:** Format (alle, Platten, CDs), Genres, Erscheinungsjahre (z. B. `1970, 1972-1975`), „nur gespielte“ bzw. „noch nicht gespielt“ seit einem Datum, Ort im Regal.
- **Sortierung:** nach Künstler, Jahr, Format, Anzahl Hördurchgänge oder Hinzufügedatum. Bei Künstlern werden führende Artikel ignoriert (*The Beatles* steht unter **B**, *Die Sterne* unter **S**).
- **Drucken:** einzelne Platten auswählen oder die gefilterte Liste drucken (siehe **Drucken**).

### Album-Detailansicht

Ein Klick auf Cover, Titel oder Künstler öffnet die Details: Tracklist, Formate, Labels, Notizen, Hör-Historie und geschätzter Wert. Dort kannst du:

- **Höre ich gerade** – einen Hördurchgang erfassen.
- **Auf Roon abspielen** – sofern Roon eingerichtet ist.
- **Zustand** von Platte und Hülle nach Goldmine-Standard setzen (wird zu Discogs synchronisiert und aktualisiert den Schätzwert).
- **Sortierung** – einen eigenen Sortier-String festlegen, der statt des Künstlers für Sammlung und Regal gilt (z. B. *Les Paul* unter **L**). Leer lassen für die automatische Sortierung.
- **Aus Sammlung entfernen** – löscht die Platte auch aus deinem Discogs-Ordner (mit Rückfrage).

## Platten ohne Discogs-Eintrag {#manuell}

Manche Platten und CDs gibt es bei Discogs nicht. Du kannst sie trotzdem in der Sammlung führen:

- **Sammlung → Platte manuell anlegen**, in der **Label-Inbox** bei einem Foto ohne Treffer **Manuell anlegen**, oder im **Scanner**, wenn ein Barcode nicht gefunden wird (der Barcode ist dann schon eingetragen).
- Pflicht sind **Künstler**, **Titel** und **Format** (LP, Doppel-LP, CD, Doppel-CD). Optional: Jahr, Label, Katalognummer, Land, Barcode, Genres, Zustand, Notizen und ein **eigener Wert**, der in den Sammlungswert eingeht.
- Als **Cover** dient ein eigenes Foto oder – aus der Label-Inbox – das Label-Foto.
- Nach dem Speichern siehst du, in welches Regalfach die Platte gehört.

Manuelle Platten tragen das Kennzeichen **Manuell** und lassen sich in der Sammlung über den Filter **Quelle** auswählen. In der Detailansicht kannst du sie **bearbeiten** und das Cover ändern; einen Discogs-Link gibt es nicht. Der Discogs-Abgleich lässt sie unverändert. Hören erfasst du wie gewohnt – auch per Barcode oder per gedrucktem QR-Etikett (dort steht „Manuell #n“ statt der Discogs-ID). Das JSON-Backup enthält sie samt Cover.

### Später bei Discogs übernehmen

Gibt es die Platte inzwischen bei Discogs, wählst du in der Detailansicht **Bei Discogs prüfen**. Vinyl Tracker sucht nach Barcode, Katalognummer + Label und Künstler + Titel und zeigt die möglichen Releases. Erst wenn du einen Release wählst und **Übernehmen** bestätigst, wird die Platte zur Discogs-Platte: Der Release kommt in deine Discogs-Sammlung, Hör-Historie, Regalplatz, Zustände und Sortier-String bleiben erhalten. Cover und Wert kommen danach von Discogs. Die Übernahme lässt sich nicht rückgängig machen.

- Ist der Release schon in deiner Sammlung, wählst du zwischen **Zweites Exemplar** (Standard) und **Zusammenführen**: Beim Zusammenführen wandert die Hör-Historie zum vorhandenen Exemplar, die manuelle Platte wird gelöscht – ihre Notizen und Zustände gehen dabei verloren.
- Gedruckte QR-Etiketten („Manuell #n“) funktionieren weiter und führen zum übernommenen Exemplar.
- Gibt es die Platte noch nicht bei Discogs, öffnet **Bei Discogs eintragen** das Discogs-Formular; mit **Daten kopieren** hast du die Angaben der Platte in der Zwischenablage.

## Regale {#regale}

Unter **Sammlung → Regale** bildest du deine echten Regale nach. Der Tracker verteilt die Sammlung (Künstler A–Z, dann Jahr und Titel) gleichmäßig auf die Fächer und sagt dir, wo jede Platte hingehört.

1. **Regale verwalten** öffnen und einen **Regaltyp** anlegen: Raster (Reihen × Spalten) und Kapazität pro Fach in Discs. Vorlagen gibt es z. B. für IKEA Kallax und das IKEA-CD-Regal.
2. **Regale anlegen** – in der Reihenfolge, in der sie stehen. Das erste Regal verteilt die Sammlung sofort.
3. Neue Platten kommen in das Fach, in dessen Bereich sie fallen. Andere Platten wandern nur, wenn ein Fach überläuft – und dann nur ins nächste Fach mit Platz. Nach dem Hinzufügen siehst du Fach, Nachbarn und eventuelle Umzüge.

Die Übersicht zeigt jedes Regal als Raster mit Füllstand und Künstlerbereich. **Neu verteilen** gleicht alles wieder gleichmäßig aus (mit Vorschau). Doppel-LPs und Boxen belegen so viele Plätze wie sie Discs haben. Ein Klick auf ein Fach zeigt dessen Platten.

## Sammlung sortieren {#sortiermodus}

Der Sortiermodus (Regal-Symbol in der unteren Leiste am Handy) führt dich Platte für Platte durch die Regale – praktisch beim ersten Einräumen oder nach dem **Neu verteilen**.

1. Regal und Startfach (Reihe:Spalte) wählen – Zeile und Spalte lassen sich mit **+** und **−** verstellen, sodass keine Tastatur nötig ist (z. B. wenn ein Bluetooth-Scanner verbunden ist und iOS die Bildschirmtastatur ausblendet).
2. Mit **Weiter** durch die Platten gehen: Cover, Titel, Künstler, Fach und Position im Fach werden angezeigt; ein neues Fach wird hervorgehoben.

Der Bildschirm bleibt dabei an.

## Drucken {#drucken}

Gedruckt wird aus den **Einstellungen** (ganze Sammlung) oder aus der **Sammlung** (Auswahl oder aktuelle Filter). Vorlagen:

- **QR-Etiketten** (Avery Zweckform 6605/3474, 70 × 37 mm, 24 pro Bogen) – bei angebrochenen Bögen das Start-Etikett wählen.
- **Scan-Liste** – Tabelle mit einem QR-Code pro Platte, um Hören vom Papier zu erfassen.
- **QR-Karten** – zum Ausschneiden.
- **Inventurliste** – Checkliste nach Regal und Fach.

Im PDF-Viewer mit **100 %** bzw. „Tatsächliche Größe“ drucken, sonst passen die Etiketten nicht.

## Roon {#roon}

Mit Roon spielst du ein Album direkt aus der Detailansicht ab.

1. Unter **Einstellungen → Roon Integration** IP oder Hostname deines Roon Cores eintragen und speichern.
2. In Roon unter *Einstellungen → Erweiterungen* Vinyl Tracker **freigeben**.
3. Eine **Standard-Wiedergabezone** wählen.

Danach startet **Auf Roon abspielen** das Album in der gewählten Zone.

## Einstellungen {#einstellungen}

- **Design-Modus** (Hell, Dunkel, System) und **Sprache**.
- **Discogs** – Benutzername und Token.
- **Barcode & QR Scanner** – siehe **Scannen**.
- **Roon Integration** – siehe **Roon**.
- **Label-Erkennung (OpenRouter)** – API-Key und Modell für die automatische Erkennung; der Key wird verschlüsselt gespeichert und nie wieder angezeigt. Standard ist Claude Sonnet, deutlich günstiger ist Claude Haiku.
- **Sammlung exportieren & sichern** – CSV-Tabelle, vollständiges **JSON-Backup** (mit Hör-Historie und Regalen) oder PDF-Versicherungskatalog.
- **Backup wiederherstellen** – ein JSON-Backup mit der Sammlung zusammenführen; nichts wird gelöscht, mehrfaches Einspielen erzeugt keine Duplikate.
- **Alle Hördurchgänge zurücksetzen** – löscht die gesamte Hör-Historie (mit Rückfrage).
- **Versionshinweise** – was sich in den letzten Versionen geändert hat.

## Claude & MCP {#claude-mcp}

Der Vinyl-Tracker-**MCP-Server** verbindet Claude Desktop, Claude Code und andere KI-Assistenten mit deiner Sammlung. Claude kann dann z. B. Platten suchen und hinzufügen, Hören erfassen, Statistiken auswerten, Roon steuern oder die Label-Inbox abarbeiten.

Den Server gibt es als fertiges Programm für Linux, macOS und Windows auf der Release-Seite des Projekts. Die Einrichtung (Pfad zum Programm, Backend-Adresse, Benutzername und Passwort) steht in `mcp/README.md`.

## App installieren {#app-installieren}

Vinyl Tracker lässt sich als App installieren (PWA): im Browser *Zum Home-Bildschirm hinzufügen* bzw. *Installieren* wählen.

- **Updates:** Gibt es eine neue Version, erscheint ein Hinweis zum Neuladen.
- **Mehrere Geräte:** Kommst du nach mindestens 30 Sekunden zur App zurück, laden Sammlung und Dashboard neu – Änderungen von einem anderen Gerät erscheinen so ohne Neustart.

## Häufige Fragen {#faq}

**Die Kamera startet nicht.** Der Browser erlaubt die Kamera nur über HTTPS und nach deiner Zustimmung. Seite über `https://` öffnen und die Kamera-Berechtigung prüfen.

**Eine Platte ist im falschen Regal (z. B. LP im CD-Regal).** Einmal die Sammlung mit Discogs abgleichen (**Sync**) – das Format wird dabei neu bestimmt.

**Die Erkennung schlägt die falsche Pressung vor.** Eine **andere Pressung** aus dem Vorschlag wählen, oder ein weiteres Foto (andere Seite, Auslaufrille) aufnehmen und **Erneut erkennen**.

**Ich finde eine Platte nicht bei Discogs.** Lege sie **manuell** an (siehe **Platten ohne Discogs-Eintrag**). Alternativ lässt sich das Release auf discogs.com eintragen (**Bei Discogs eintragen** in der Detailansicht); danach übernimmst du die manuelle Platte mit **Bei Discogs prüfen**.
