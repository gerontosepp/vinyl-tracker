# Help

This file is the source of the in-app help page (`/help`, English). Each section starts with `## Title {#anchor}`; the anchors must match `docs/Help.md`, because the context help (? icon) links to them. Allowed: paragraphs, lists, `###` subheadings, **bold**, *italic*, `code` and links. After editing, `node scripts/sync-help.js` regenerates the frontend data (the Claude hook does this automatically).

## Getting started {#erste-schritte}

Vinyl Tracker manages your records and CDs based on your **Discogs collection** and remembers what you listen to and when.

1. **Connect Discogs:** Under **Settings**, enter your Discogs username and a personal token (create it on discogs.com under *Settings → Developers*). The token is stored encrypted.
2. **Sync your collection:** **Sync** imports your Discogs records – including covers, formats, genres and market value.
3. **Log listens:** Scan a barcode or QR code, or choose **Just listening** in the record details.

Tip: Almost every icon explains itself when you hover over it with the mouse or long-press it on your phone. The **?** icon on a page jumps straight to the matching section of this help.

## Dashboard {#dashboard}

The home page shows your listening habits for a selectable period (today, 7 days, 30 days, custom range):

- **Recently played** – the latest logged listens.
- **Most played** – switches between **albums** and **artists**. Clicking an artist opens the collection filtered by that artist.
- **Collection value** and **genre breakdown** – estimated value in euros (median, minimum, maximum from the Discogs marketplace).

Clicking a cover opens the same detail view as in the collection.

## Scanning {#scannen}

Use **Scan** in the navigation to log that you are playing a record – or to add a new one.

- **Barcode** (EAN/UPC on the cover): if the record is in your collection, the listen is logged right away. Otherwise Vinyl Tracker searches Discogs, shows the matching pressings and adds the chosen one to your Discogs collection.
- **QR code** from printed Vinyl Tracker labels or scan lists: logs the listen directly.
- **Manual input:** type the barcode if the camera cannot read it.

### Scanner mode

Under **Settings → Barcode & QR scanner** you choose:

- **External hardware scanner** (e.g. Eyoyo EY-009P, works like a keyboard) – the camera stays off and saves battery.
- **Internal camera scanner** – webcam or phone camera. The camera only works over **HTTPS**.
- **Hybrid** – both at the same time.

**Scanner live test** checks whether the hardware scanner is detected; an optional beep confirms each scan.

## Records without barcode (label photo) {#label-foto}

Older records often have no barcode. A photo of the **label** (the paper sticker in the middle of the record) helps.

1. On the scan page, choose **Take label photo** and photograph the label as straight and sharp as possible. The photo is downscaled and stored without location data.
2. The photo goes to the **label inbox**. The counter next to the button shows how many photos are waiting; tap it to open the inbox.

### Automatic recognition

If you added an API key under **Settings → Label recognition (OpenRouter)**, the app recognizes every new photo in the background (usually 10–30 seconds). The label inbox then shows a **suggestion** with cover, catalog number, country, year, confidence and reason – often with **other pressings** to choose from.

- **Add** puts the chosen pressing into your collection and shows which shelf compartment it belongs in.
- **Only complete** marks the photo as done without adding anything – e.g. if the record is already in your collection.
- **Recognize again** restarts the recognition, for example after an error.
- A hint sometimes suggests another photo (other side, run-out groove) to pin down the exact pressing.
- **Add manually** – if the record is not on Discogs or the suggestion is uncertain, add it yourself; what was read from the label is already filled in (see **Records without a Discogs entry**).

The model can only search Discogs and never changes anything itself. Every recognized photo usually costs a few cents via OpenRouter and is sent to OpenRouter and the model provider.

### Recognition via Claude

Without an API key, Claude recognizes the records with your Claude subscription: in Claude Desktop or Claude Code, start the prompt `process_label_inbox` of the Vinyl Tracker MCP server (see **Claude & MCP**).

### Cleaning up the inbox

You can delete single photos or **all** open photos in the label inbox. Click a photo to see it full size.

## Collection {#sammlung}

The collection shows all records and CDs – as a **list** or as **shelves**.

- **Search** by artist or title.
- **Filters:** format (all, records, CDs), genres, release years (e.g. `1970, 1972-1975`), "played only" or "not played" since a date, location on the shelf.
- **Sorting:** by artist, year, format, number of listens or date added. Leading articles of artists are ignored (*The Beatles* is filed under **B**, *Die Sterne* under **S**).
- **Print:** select single records or print the filtered list (see **Printing**).

### Record details

Clicking a cover, title or artist opens the details: tracklist, formats, labels, notes, listening history and estimated value. There you can:

- **Just listening** – log a listen.
- **Play on Roon** – if Roon is set up.
- Set the **condition** of record and sleeve using the Goldmine standard (synced to Discogs, updates the estimated value).
- **Sorting** – a custom sort string used instead of the artist in the collection and on the shelf (e.g. *Les Paul* under **L**). Leave it empty for automatic sorting.
- **Remove from collection** – also removes the record from your Discogs folder (with confirmation).


## Records without a Discogs entry {#manuell}

Some records and CDs are not on Discogs. You can still keep them in your collection:

- **Collection → Add record manually**, **Add manually** for a photo without match in the **label inbox**, or in the **scanner** when a barcode is not found (the barcode is then already filled in).
- **Artist**, **title** and **format** (LP, Double LP, CD, Double CD) are required. Optional: year, label, catalog number, country, barcode, genres, condition, notes and an **own value** that counts towards the collection value.
- The **cover** is a photo of your own or – from the label inbox – the label photo.
- After saving, you see which shelf compartment the record belongs in.

Manual records carry the **Manual** badge and can be selected with the **Source** filter in the collection. In the record details you can **edit** them and change the cover; there is no Discogs link. The Discogs sync leaves them unchanged. Log listens as usual – also by barcode or with a printed QR label (which shows "Manual #n" instead of the Discogs ID). The JSON backup includes them with their covers.

### Taking over to Discogs later

If the record is on Discogs by now, choose **Check on Discogs** in the record details. Vinyl Tracker searches by barcode, catalog number + label and artist + title and shows the possible releases. Only when you pick a release and confirm **Take over** does the record become a Discogs record: the release is added to your Discogs collection, and listen history, shelf slot, conditions and sort string are kept. Cover and value then come from Discogs. The takeover cannot be undone.

- If the release is already in your collection, choose between **Second copy** (default) and **Merge**: merging moves the listen history to the existing copy and deletes the manual record – its notes and conditions are lost.
- Printed QR labels ("Manual #n") keep working and lead to the taken-over copy.
- If the record is not on Discogs yet, **Add to Discogs** opens the Discogs form; **Copy data** puts the record's details on the clipboard.
## Shelves {#regale}

Under **Collection → Shelves** you model your real shelves. The tracker spreads the collection (artist A–Z, then year and title) evenly across the compartments and tells you where each record belongs.

1. Open **Manage shelves** and create a **shelf type**: grid (rows × columns) and capacity per compartment in discs. Presets exist e.g. for IKEA Kallax and the IKEA CD shelf.
2. **Add shelves** in the order they stand. The first shelf distributes the collection right away.
3. New records go into the compartment whose range they fall into. Other records only move when a compartment overflows – and then only to the nearest compartment with space. After adding you see the compartment, the neighbors and any moves.

The overview shows every shelf as a grid with fill level and artist range. **Redistribute** evens everything out again (with preview). Double LPs and box sets take as many places as they have discs. Click a compartment to see its records.

## Sort collection {#sortiermodus}

Sort mode (shelf icon in the bottom bar on phones) guides you record by record through the shelves – handy when filling the shelves for the first time or after **Redistribute**.

1. Choose the shelf and the start compartment (row:column).
2. Step through the records with **Next**: cover, title, artist, compartment and position within it are shown; a new compartment is highlighted.

The screen stays on while sorting.

## Printing {#drucken}

Print from **Settings** (entire collection) or from the **collection** (selection or current filters). Templates:

- **QR labels** (Avery Zweckform 6605/3474, 70 × 37 mm, 24 per sheet) – for partially used sheets choose the start label.
- **Scan list** – a table with one QR code per record to log listens from paper.
- **QR cards** – to cut out.
- **Inventory list** – a checklist grouped by shelf and compartment.

Print at **100 %** or "Actual size" in the PDF viewer, otherwise the labels don't line up.

## Roon {#roon}

With Roon you play an album straight from the record details.

1. Under **Settings → Roon integration**, enter the IP or hostname of your Roon Core and save.
2. In Roon, **enable** Vinyl Tracker under *Settings → Extensions*.
3. Choose a **default zone**.

**Play on Roon** then starts the album in the chosen zone.

## Settings {#einstellungen}

- **Theme** (light, dark, system) and **language**.
- **Discogs** – username and token.
- **Barcode & QR scanner** – see **Scanning**.
- **Roon integration** – see **Roon**.
- **Label recognition (OpenRouter)** – API key and model for automatic recognition; the key is stored encrypted and never shown again. The default is Claude Sonnet, Claude Haiku is much cheaper.
- **Export & back up collection** – CSV table, complete **JSON backup** (with listening history and shelves) or PDF insurance catalog.
- **Restore backup** – merges a JSON backup into the collection; nothing is deleted, importing several times creates no duplicates.
- **Reset all listens** – deletes the entire listening history (with confirmation).
- **Release notes** – what changed in recent versions.

## Claude & MCP {#claude-mcp}

The Vinyl Tracker **MCP server** connects Claude Desktop, Claude Code and other AI assistants to your collection. Claude can then e.g. search and add records, log listens, analyze statistics, control Roon or work through the label inbox.

The server is available as a ready-made program for Linux, macOS and Windows on the project's releases page. The setup (program path, backend address, username and password) is described in `mcp/README.md`.

## Install the app {#app-installieren}

Vinyl Tracker can be installed as an app (PWA): choose *Add to Home Screen* or *Install* in your browser.

- **Updates:** when a new version is available, a notice offers to reload.
- **Several devices:** when you return to the app after at least 30 seconds, the collection and dashboard reload – changes from another device show up without restarting.

## FAQ {#faq}

**The camera does not start.** Browsers only allow the camera over HTTPS and after your consent. Open the page via `https://` and check the camera permission.

**A record is on the wrong shelf (e.g. an LP on the CD shelf).** Sync the collection with Discogs once (**Sync**) – this determines the format again.

**The recognition suggests the wrong pressing.** Choose **another pressing** from the suggestion, or take another photo (other side, run-out groove) and **Recognize again**.

**I can't find a record on Discogs.** Add it **manually** (see **Records without a Discogs entry**). Alternatively, submit the release on discogs.com (**Add to Discogs** in the record details); afterwards take over the manual record with **Check on Discogs**.
