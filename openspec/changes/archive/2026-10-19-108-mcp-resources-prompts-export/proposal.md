# Proposal: MCP Resources, Prompts and Collection Export Tool

## Why
The Vinyl Tracker Model Context Protocol (MCP) server currently exposes 22 callable tools (search, scan, details, playback, condition updates, etc.). While tools allow AI agents to invoke imperative actions, the MCP specification defines first-class support for **Resources** (structured contextual data accessible via URI) and **Prompts** (pre-composed templates for guided AI interactions).
Additionally, users and AI agents currently lack a direct MCP tool to export their collection in structured formats (JSON / CSV).

## What Changes
1. **MCP Tool `export_collection`**:
   - Allows exporting the authenticated user's entire collection in `json` or `csv` format.
   - Leverages the existing backend endpoint `GET /api/collection/export?format=...`.
2. **MCP Resources (`vinyl://...`)**:
   - `vinyl://collection/summary`: Overview of collection size, format distribution (Vinyl vs. CD), unplayed items, and total listens.
   - `vinyl://collection/value`: Collection valuation estimate (minimum, median, maximum).
   - `vinyl://stats/overview`: Overview of listening stats (recent listens, top records).
3. **MCP Prompts**:
   - `recommend_record`: Interactive prompt template with optional `genre` and `mood` arguments to recommend albums from the user's collection.
   - `grading_audit`: Interactive prompt template guiding the model to audit unrated records in the collection and recommend Goldmine condition grades.
4. **Server Capabilities & Metadata**:
   - Update `ServerCapabilities` in `ServerHandler::get_info()` to declare `tools`, `prompts`, and `resources` capabilities.
