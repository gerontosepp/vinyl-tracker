use crate::client::VinylApiClient;
use crate::models::*;
use base64::Engine;
use rmcp::{
    ServerHandler,
    handler::server::{
        router::{prompt::PromptRouter, tool::ToolRouter},
        wrapper::Parameters,
    },
    model::{CallToolResult, ContentBlock, PromptMessage, Role},
    prompt, prompt_handler, prompt_router, tool, tool_handler, tool_router,
};
use std::sync::Arc;

/// Steps shared by the label identification prompts: read the label, search Discogs in a
/// structured way, verify candidates and only act after the user confirmed.
/// Shared reading steps (`vinyl_api_types::label_photo::LABEL_READING_STEPS`) plus the
/// confirmation dialog of the MCP prompts.
fn label_identification_steps() -> String {
    format!(
        "{LABEL_READING_STEPS}\n\
4. Present the best match with its Discogs release ID, your reasoning and a confidence level, and list close alternatives. \
If the pressing cannot be determined reliably, ask for another photo (other side, run-out groove, back cover).\n\
5. Never add or log anything before the user has confirmed the match."
    )
}

#[derive(Clone)]
pub struct VinylMcpServer {
    client: Arc<VinylApiClient>,
    tool_router: ToolRouter<Self>,
    prompt_router: PromptRouter<Self>,
}

impl VinylMcpServer {
    pub fn new(client: VinylApiClient) -> Self {
        Self {
            client: Arc::new(client),
            tool_router: Self::tool_router(),
            prompt_router: Self::prompt_router(),
        }
    }
}

#[tool_router(router = tool_router)]
impl VinylMcpServer {
    /// Retrieve the user's vinyl collection with optional pagination, sorting, search, and min_plays filter.
    #[tool(
        name = "get_user_collection",
        description = "Retrieve the user's vinyl collection from Vinyl Tracker. Supports pagination (page, per_page), sorting ('artist', 'listens', 'addedAt'), sort order ('asc', 'desc'), minimum plays filter, search terms, category filter ('all', 'vinyl', 'cd'), genres filter (e.g. ['Jazz', 'Rock']), years filter (e.g. '1970-1972, 1975') and storage filter (storage_unit = shelf ID or 'unplaced', optional compartment). Each release carries its computed shelf position in `storage` when shelves are configured."
    )]
    async fn get_user_collection(
        &self,
        Parameters(args): Parameters<GetCollectionArgs>,
    ) -> Result<String, String> {
        let resp = self.client.get_collection(&args).await?;
        serde_json::to_string_pretty(&resp)
            .map_err(|e| format!("Failed to serialize collection response: {}", e))
    }

    /// Triggers a synchronization of the vinyl collection with the user's connected Discogs account.
    #[tool(
        name = "sync_collection",
        description = "Synchronizes the local Vinyl Tracker database with the user's remote Discogs collection. Imports newly added albums and purges deleted releases."
    )]
    async fn sync_collection(&self) -> Result<String, String> {
        let result = self.client.sync_collection().await?;
        Ok(format!(
            "Sync completed successfully: {} added, {} updated, {} removed ({} records in total).",
            result.added, result.updated, result.removed, result.total
        ))
    }

    /// Add an album from Discogs to the user's vinyl collection and trigger sync.
    #[tool(
        name = "add_to_collection",
        description = "Adds a vinyl record or CD release by its Discogs release ID to the user's collection and syncs with Discogs."
    )]
    async fn add_to_collection(
        &self,
        Parameters(args): Parameters<AddToCollectionArgs>,
    ) -> Result<String, String> {
        let result = self.client.add_to_collection(args.release_id).await?;
        let mut message = format!(
            "Successfully added release {} to collection. Sync result: {} added, {} updated, {} removed ({} records in total).",
            args.release_id, result.added, result.updated, result.removed, result.total
        );
        if let Some(placement) = &result.placement {
            message.push_str(&format!(
                " Shelf placement: {}",
                serde_json::to_string(placement)
                    .map_err(|e| format!("Failed to serialize placement: {}", e))?
            ));
        }
        Ok(message)
    }

    /// Remove an album from the user's vinyl collection and connected Discogs account.
    #[tool(
        name = "remove_from_collection",
        description = "Removes a vinyl album or CD from the user's local collection and from their connected Discogs folder. Does not delete listen scrobbles or playback statistics."
    )]
    async fn remove_from_collection(
        &self,
        Parameters(args): Parameters<RemoveFromCollectionArgs>,
    ) -> Result<String, String> {
        self.client
            .remove_from_collection(args.release_id, args.instance_id)
            .await?;
        Ok(format!(
            "Successfully removed release {} from collection.",
            args.release_id
        ))
    }

    /// Log a listen event by scanning a barcode or custom QR code.
    #[tool(
        name = "scan_barcode",
        description = "Logs a vinyl record listen event via barcode or custom code (e.g., 'discogs-id:<id>' or UPC/EAN). Looks up the release, saves it if necessary, and records the play."
    )]
    async fn scan_barcode(
        &self,
        Parameters(args): Parameters<ScanBarcodeArgs>,
    ) -> Result<String, String> {
        let result = self.client.scan_barcode(&args.barcode).await?;
        serde_json::to_string_pretty(&result)
            .map_err(|e| format!("Failed to serialize scan result: {}", e))
    }

    /// Directly log a listen event for a vinyl record by its internal record ID or Discogs release ID.
    #[tool(
        name = "log_record_listen",
        description = "Directly logs a vinyl record listen event by its internal record ID or Discogs release ID (without needing to scan a barcode). Increments the play count and records the timestamp."
    )]
    async fn log_record_listen(
        &self,
        Parameters(args): Parameters<LogRecordListenArgs>,
    ) -> Result<String, String> {
        let details = self.client.log_record_listen(args.id).await?;
        serde_json::to_string_pretty(&details)
            .map_err(|e| format!("Failed to serialize record details: {}", e))
    }

    /// Delete a logged listen event by its unique ID.
    #[tool(
        name = "delete_scan",
        description = "Deletes a specific listen event by its unique ID."
    )]
    async fn delete_scan(
        &self,
        Parameters(args): Parameters<DeleteScanArgs>,
    ) -> Result<String, String> {
        self.client.delete_scan(args.id).await
    }

    /// Reset all listen events for the user.
    #[tool(
        name = "reset_all_listens",
        description = "Resets (deletes) all logged listen events for the current user in Vinyl Tracker."
    )]
    async fn reset_all_listens(&self) -> Result<String, String> {
        let result = self.client.reset_all_listens().await?;
        Ok(format!(
            "{}. Deleted {} listen events.",
            result.message, result.deleted_count
        ))
    }

    /// Get recent listen events, optionally filtered by date range.
    #[tool(
        name = "get_recent_listens",
        description = "Retrieves recent vinyl listen events in reverse chronological order, optionally filtered by 'from' and 'to' dates (YYYY-MM-DD)."
    )]
    async fn get_recent_listens(
        &self,
        Parameters(args): Parameters<AnalyticsDateRangeArgs>,
    ) -> Result<String, String> {
        let listens = self
            .client
            .get_recent_listens(args.from.as_deref(), args.to.as_deref())
            .await?;
        serde_json::to_string_pretty(&listens)
            .map_err(|e| format!("Failed to serialize recent listens: {}", e))
    }

    /// Get top listened records, optionally filtered by date range.
    #[tool(
        name = "get_top_records",
        description = "Retrieves the top played vinyl albums, optionally filtered by 'from' and 'to' dates (YYYY-MM-DD)."
    )]
    async fn get_top_records(
        &self,
        Parameters(args): Parameters<AnalyticsDateRangeArgs>,
    ) -> Result<String, String> {
        let top = self
            .client
            .get_top_records(args.from.as_deref(), args.to.as_deref())
            .await?;
        serde_json::to_string_pretty(&top)
            .map_err(|e| format!("Failed to serialize top records: {}", e))
    }

    /// Get the most played artists, optionally filtered by date range.
    #[tool(
        name = "get_top_artists",
        description = "Retrieves the user's most played artists (top 10) with listen count and number of releases listened to, optionally filtered by 'from' and 'to' dates (YYYY-MM-DD)."
    )]
    async fn get_top_artists(
        &self,
        Parameters(args): Parameters<AnalyticsDateRangeArgs>,
    ) -> Result<String, String> {
        let top = self
            .client
            .get_top_artists(args.from.as_deref(), args.to.as_deref())
            .await?;
        serde_json::to_string_pretty(&top)
            .map_err(|e| format!("Failed to serialize top artists: {}", e))
    }

    /// Get estimated collection value from Discogs.
    #[tool(
        name = "get_collection_value",
        description = "Fetches the estimated collection value (minimum, median, maximum) from Discogs for the authenticated user."
    )]
    async fn get_collection_value(&self) -> Result<String, String> {
        let val = self.client.get_collection_value().await?;
        serde_json::to_string_pretty(&val)
            .map_err(|e| format!("Failed to serialize collection value: {}", e))
    }

    /// Get genre breakdown of the collection.
    #[tool(
        name = "get_genre_breakdown",
        description = "Retrieves the genre distribution breakdown for the user's vinyl collection."
    )]
    async fn get_genre_breakdown(&self) -> Result<String, String> {
        let genres = self.client.get_genre_breakdown().await?;
        serde_json::to_string_pretty(&genres)
            .map_err(|e| format!("Failed to serialize genre breakdown: {}", e))
    }

    /// Get current user profile details.
    #[tool(
        name = "get_current_user",
        description = "Retrieves the authenticated user's profile information from Vinyl Tracker."
    )]
    async fn get_current_user(&self) -> Result<String, String> {
        let user = self.client.get_current_user().await?;
        serde_json::to_string_pretty(&user)
            .map_err(|e| format!("Failed to serialize user profile: {}", e))
    }
    /// Pick a random record recommendation from the user's vinyl collection.
    #[tool(
        name = "get_random_record",
        description = "Picks a random record recommendation from the user's vinyl collection. Optionally filter by genre or restrict to unplayed records."
    )]
    async fn get_random_record(
        &self,
        Parameters(args): Parameters<GetRandomRecordArgs>,
    ) -> Result<String, String> {
        let release = self.client.get_random_record(&args).await?;
        match release {
            Some(r) => serde_json::to_string_pretty(&r)
                .map_err(|e| format!("Failed to serialize random record: {}", e)),
            None => Ok("No record found matching the criteria.".to_string()),
        }
    }

    /// Retrieve unplayed vinyl records ("shelf of shame") from the user's collection.
    #[tool(
        name = "get_unplayed_records",
        description = "Retrieves unplayed records from the user's collection (the 'shelf of shame') with optional pagination."
    )]
    async fn get_unplayed_records(
        &self,
        Parameters(args): Parameters<GetUnplayedRecordsArgs>,
    ) -> Result<String, String> {
        let resp = self.client.get_unplayed_records(&args).await?;
        serde_json::to_string_pretty(&resp)
            .map_err(|e| format!("Failed to serialize unplayed records: {}", e))
    }

    /// Retrieve comprehensive album details including tracklist, formats, labels, and listen history.
    #[tool(
        name = "get_record_details",
        description = "Fetches comprehensive details for a record by its database ID or Discogs release ID, including tracklist, release formats, labels, identifiers (matrix / runout, label code, rights society), release notes, and personal listen history. Also works for Discogs releases that are not in the collection, e.g. to verify search candidates."
    )]
    async fn get_record_details(
        &self,
        Parameters(args): Parameters<GetRecordDetailsArgs>,
    ) -> Result<String, String> {
        let details = self.client.get_record_details(args.id).await?;
        serde_json::to_string_pretty(&details)
            .map_err(|e| format!("Failed to serialize record details: {}", e))
    }

    /// Search the global Discogs database for albums, artists, or releases.
    #[tool(
        name = "search_discogs",
        description = "Searches the global Discogs database for releases. Use the free-text `query` and/or the structured filters `catno`, `label`, `artist`, `release_title`, `year`, `country` and `format`. For records without a barcode, `catno` plus `label` as printed on the record label is the most precise search. Results include catalog number, labels, country and year."
    )]
    async fn search_discogs(
        &self,
        Parameters(args): Parameters<SearchDiscogsArgs>,
    ) -> Result<String, String> {
        let resp = self.client.search_discogs(&args).await?;
        serde_json::to_string_pretty(&resp)
            .map_err(|e| format!("Failed to serialize Discogs search results: {}", e))
    }

    /// Retrieve available audio playback zones and output rooms from a configured Roon Core.
    #[tool(
        name = "get_roon_zones",
        description = "Retrieves the list of active Roon audio playback zones (zone ID, zone name, and playback state) from the configured Roon Core."
    )]
    async fn get_roon_zones(&self) -> Result<String, String> {
        let zones = self.client.get_roon_zones().await?;
        serde_json::to_string_pretty(&zones)
            .map_err(|e| format!("Failed to serialize Roon zones: {}", e))
    }

    /// Play an album/record on Roon via Roon Core integration.
    #[tool(
        name = "play_record_on_roon",
        description = "Triggers immediate playback ('Play Now') of a vinyl record or album on a configured local Roon Core zone. Requires Roon to be enabled and paired in Vinyl Tracker Settings."
    )]
    async fn play_record_on_roon(
        &self,
        Parameters(args): Parameters<PlayRecordOnRoonArgs>,
    ) -> Result<String, String> {
        let resp = self.client.play_on_roon(&args).await?;
        Ok(format!(
            "Roon playback initiated successfully: {} - {}. Core message: {}",
            args.artist, args.title, resp.message
        ))
    }

    /// Update the media and/or sleeve condition grading for a record in the collection.
    #[tool(
        name = "update_record_condition",
        description = "Updates the Goldmine condition grading for vinyl media and/or sleeve for a record in the user's collection (e.g. 'Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', etc.)."
    )]
    async fn update_record_condition(
        &self,
        Parameters(args): Parameters<UpdateRecordConditionArgs>,
    ) -> Result<String, String> {
        let id = args.id;
        let details = self.client.update_record_condition(id, &args).await?;
        serde_json::to_string_pretty(&details)
            .map_err(|e| format!("Failed to serialize updated record details: {}", e))
    }

    /// Refresh Discogs market value estimations for records in the user's collection.
    #[tool(
        name = "refresh_collection_prices",
        description = "Refreshes lowest and median market price estimates from Discogs for records in the user's collection. By default (only_missing = true), updates only records missing price data; set only_missing to false to refresh all records."
    )]
    async fn refresh_collection_prices(
        &self,
        Parameters(args): Parameters<RefreshCollectionPricesArgs>,
    ) -> Result<String, String> {
        let result = self
            .client
            .refresh_collection_prices(args.only_missing)
            .await?;
        serde_json::to_string_pretty(&result)
            .map_err(|e| format!("Failed to serialize price refresh result: {}", e))
    }

    /// Get the current connection and pairing status of the Roon Core integration.
    #[tool(
        name = "get_roon_status",
        description = "Inspects the Roon Core integration status, including whether the backend is connected and paired with Roon Core, core name, host, port, active zone, and all available playback zones."
    )]
    async fn get_roon_status(&self) -> Result<String, String> {
        let status = self.client.get_roon_status().await?;
        serde_json::to_string_pretty(&status)
            .map_err(|e| format!("Failed to serialize Roon status: {}", e))
    }

    /// Shelf position of a record: slot, neighbors and moves.
    #[tool(
        name = "get_record_placement",
        description = "Tells where a record of the collection belongs on the user's shelves (computed from artist A-Z order): shelf, compartment (row/column), the neighboring records and, for a just added record, the records that have to move to make room (also returned by add_to_collection). Returns a notice if no shelf is configured for the record's medium."
    )]
    async fn get_record_placement(
        &self,
        Parameters(args): Parameters<GetRecordPlacementArgs>,
    ) -> Result<String, String> {
        match self.client.get_record_placement(args.discogs_id).await? {
            Some(placement) => serde_json::to_string_pretty(&placement)
                .map_err(|e| format!("Failed to serialize placement: {}", e)),
            None => Ok(format!(
                "No shelf is configured for the medium of release {}.",
                args.discogs_id
            )),
        }
    }

    /// Overview of all shelves with fill level per compartment.
    #[tool(
        name = "get_storage_layout",
        description = "Returns the user's shelves per medium (vinyl, cd) with their compartment grid: capacity, used discs, number of records and the first and last artist per compartment, plus the number of records without a place."
    )]
    async fn get_storage_layout(&self) -> Result<String, String> {
        let layout = self.client.get_storage_layout().await?;
        serde_json::to_string_pretty(&layout)
            .map_err(|e| format!("Failed to serialize storage layout: {}", e))
    }

    /// Fetch open label photos from the inbox as images.
    #[tool(
        name = "get_label_inbox",
        description = "Returns open (pending) photos of record labels the user took in the Vinyl Tracker app, oldest first, as images together with their IDs. Identify each record from its label and complete the photo with `resolve_label_photo`."
    )]
    async fn get_label_inbox(
        &self,
        Parameters(args): Parameters<GetLabelInboxArgs>,
    ) -> Result<CallToolResult, String> {
        let limit = args.limit.unwrap_or(5).clamp(1, 10);
        let inbox = self
            .client
            .list_label_photos(LabelPhotoStatus::Pending, limit)
            .await?;
        if inbox.photos.is_empty() {
            return Ok(CallToolResult::success(vec![ContentBlock::text(
                "The label inbox is empty.",
            )]));
        }

        let mut content = vec![ContentBlock::text(format!(
            "{} of {} open label photo(s), in this order: {}",
            inbox.photos.len(),
            inbox.pending_count,
            serde_json::to_string(&inbox.photos)
                .map_err(|e| format!("Failed to serialize label photos: {}", e))?
        ))];
        for photo in &inbox.photos {
            let (bytes, mime_type) = self.client.get_label_photo_image(photo.id).await?;
            content.push(ContentBlock::text(format!("Label photo {}:", photo.id)));
            content.push(ContentBlock::image(
                base64::engine::general_purpose::STANDARD.encode(bytes),
                mime_type,
            ));
        }
        Ok(CallToolResult::success(content))
    }

    /// Complete a label photo of the inbox.
    #[tool(
        name = "resolve_label_photo",
        description = "Completes a label photo of the inbox: status 'identified' (with the Discogs release ID of the record), 'failed' (could not be identified) or 'pending' (keep it in the inbox)."
    )]
    async fn resolve_label_photo(
        &self,
        Parameters(args): Parameters<ResolveLabelPhotoArgs>,
    ) -> Result<String, String> {
        let status = LabelPhotoStatus::parse(args.status.trim()).ok_or_else(|| {
            format!(
                "Invalid status '{}'. Use 'identified', 'failed' or 'pending'.",
                args.status
            )
        })?;
        let photo = self
            .client
            .update_label_photo(
                args.id,
                &UpdateLabelPhotoRequest {
                    status,
                    discogs_id: args.discogs_id,
                },
            )
            .await?;
        Ok(format!(
            "Label photo {} marked as {}.",
            photo.id,
            photo.status.as_str()
        ))
    }

    /// Export the user's vinyl collection in JSON or CSV format.
    #[tool(
        name = "export_collection",
        description = "Exports the user's complete vinyl collection data in structured 'json' or 'csv' format."
    )]
    async fn export_collection(
        &self,
        Parameters(args): Parameters<ExportCollectionArgs>,
    ) -> Result<String, String> {
        let fmt = args.format.trim().to_lowercase();
        if fmt != "json" && fmt != "csv" {
            return Err("Invalid export format. Only 'json' and 'csv' are supported.".to_string());
        }
        self.client.export_collection(&fmt).await
    }
}

#[prompt_router]
impl VinylMcpServer {
    /// Interactive recommendation prompt based on collection contents, genre, and mood.
    #[prompt(
        name = "recommend_record",
        description = "Provides a curated prompt template to recommend vinyl records from the user's collection tailored to an optional genre and mood."
    )]
    pub async fn recommend_record(
        &self,
        Parameters(args): Parameters<RecommendRecordPromptArgs>,
    ) -> Vec<PromptMessage> {
        let mut instructions = String::from(
            "You are an expert vinyl record curator and audiophile. Recommend 2 to 3 vinyl records from the user's collection.\n",
        );
        if let Some(genre) = &args.genre {
            instructions.push_str(&format!("Preferred Genre: {}\n", genre));
        }
        if let Some(mood) = &args.mood {
            instructions.push_str(&format!("Desired Mood / Setting: {}\n", mood));
        }
        instructions.push_str(
            "Use the `get_user_collection` or `get_random_record` tools if needed to explore unplayed records or specific genres before finalizing your recommendation.\nExplain the sonic characteristics, historical context, and why each album fits the mood.",
        );

        vec![PromptMessage::new_text(Role::User, instructions)]
    }

    /// Interactive grading audit prompt to identify and grade unrated records in the collection.
    #[prompt(
        name = "grading_audit",
        description = "Audits the user's collection for records missing Goldmine media or sleeve condition gradings and guides the user through grading them."
    )]
    pub async fn grading_audit(
        &self,
        Parameters(args): Parameters<GradingAuditPromptArgs>,
    ) -> Vec<PromptMessage> {
        let limit = args.limit.unwrap_or(10);
        let instructions = format!(
            "You are a Goldmine grading assistant for Vinyl Tracker.\n\
             1. Query the user's collection using `get_user_collection` (up to {} items).\n\
             2. Identify albums that are missing `media_condition` or `sleeve_condition`.\n\
             3. For each unrated record, fetch details via `get_record_details` and check Discogs price suggestions.\n\
             4. Guide the user through standard Goldmine condition gradings: Mint (M), Near Mint (NM or M-), Very Good Plus (VG+), Very Good (VG), Good Plus (G+), Good (G), Fair (F), Poor (P).\n\
             5. When the user confirms, offer to update the record condition using `update_record_condition`.",
            limit
        );

        vec![PromptMessage::new_text(Role::User, instructions)]
    }

    /// Identify a record from a photo of its label.
    #[prompt(
        name = "identify_record_from_label",
        description = "Guides the identification of a record (e.g. an older pressing without barcode) from an attached photo of its label and adds it to the collection or logs a listen."
    )]
    pub async fn identify_record_from_label(
        &self,
        Parameters(args): Parameters<IdentifyRecordPromptArgs>,
    ) -> Vec<PromptMessage> {
        let action = match args.action.as_deref().map(str::trim) {
            Some("add") => {
                "After confirmation, add the record with `add_to_collection` and report the shelf placement."
            }
            Some("listen") => {
                "After confirmation, log a listen with `scan_barcode` and the code `discogs-id:<release ID>`."
            }
            _ => {
                "After confirmation, ask whether to add the record to the collection (`add_to_collection`) or to log a listen (`scan_barcode` with `discogs-id:<release ID>`)."
            }
        };
        let steps = label_identification_steps();
        let instructions = format!(
            "You are a vinyl record identification expert for Vinyl Tracker. Identify the exact Discogs release \
             of the record whose label photo the user attaches.\n{steps}\n6. {action}"
        );

        vec![PromptMessage::new_text(Role::User, instructions)]
    }

    /// Work through the label photo inbox filled from the Vinyl Tracker app.
    #[prompt(
        name = "process_label_inbox",
        description = "Works through the label photos taken in the Vinyl Tracker app: identifies each record, asks for confirmation, adds the records to the collection and completes the photos."
    )]
    pub async fn process_label_inbox(
        &self,
        Parameters(args): Parameters<ProcessLabelInboxPromptArgs>,
    ) -> Vec<PromptMessage> {
        let limit = args.limit.unwrap_or(5);
        let steps = label_identification_steps();
        let instructions = format!(
            "You are a vinyl record identification expert for Vinyl Tracker. Work through the user's label photo inbox.\n\
             Fetch up to {limit} open photos with `get_label_inbox` and apply these steps to every photo:\n\
             {steps}\n\
             6. Then show one confirmation list with all photos: photo ID, proposed release (artist, title, label, catalog number, \
             country, year, Discogs release ID) and confidence.\n\
             7. For every match the user confirms, call `add_to_collection` and then `resolve_label_photo` with status \
             'identified' and the Discogs release ID. Mark photos that cannot be identified as 'failed' only after the user agreed; \
             otherwise leave them pending.\n\
             8. If more photos are open, offer to continue with the next batch."
        );

        vec![PromptMessage::new_text(Role::User, instructions)]
    }
}

#[tool_handler(router = self.tool_router)]
#[prompt_handler(router = self.prompt_router)]
impl ServerHandler for VinylMcpServer {
    fn get_info(&self) -> rmcp::model::ServerConfig {
        rmcp::model::ServerConfig::new(
            rmcp::model::ServerCapabilities::builder()
                .enable_tools()
                .enable_prompts()
                .enable_resources()
                .build(),
        )
        .with_server_info(rmcp::model::Implementation::from_build_env())
        .with_instructions("Vinyl Tracker MCP Server providing collection tracking, hardware scanning, Roon playback, and collection intelligence.".to_string())
    }

    async fn list_resources(
        &self,
        _request: Option<rmcp::model::PaginatedRequestParams>,
        _context: rmcp::service::RequestContext<rmcp::service::RoleServer>,
    ) -> Result<rmcp::model::ListResourcesResult, rmcp::ErrorData> {
        let resources = vec![
            rmcp::model::Resource::new("vinyl://collection/summary", "collection_summary")
                .with_title("Vinyl Collection Summary")
                .with_description("Overview of the user's vinyl collection including total record count, format distribution (Vinyl vs CD), unplayed count, and top genres.")
                .with_mime_type("application/json"),
            rmcp::model::Resource::new("vinyl://collection/value", "collection_value")
                .with_title("Collection Valuation")
                .with_description("Estimated financial market value of the vinyl collection (minimum, median, maximum) according to Discogs Marketplace.")
                .with_mime_type("application/json"),
            rmcp::model::Resource::new("vinyl://stats/overview", "stats_overview")
                .with_title("Listening Statistics Overview")
                .with_description("Summary of recent playback scrobbles and top most played albums in the collection.")
                .with_mime_type("application/json"),
        ];

        Ok(rmcp::model::ListResourcesResult {
            resources,
            ..Default::default()
        })
    }

    async fn read_resource(
        &self,
        request: rmcp::model::ReadResourceRequestParams,
        _context: rmcp::service::RequestContext<rmcp::service::RoleServer>,
    ) -> Result<rmcp::model::ReadResourceResponse, rmcp::ErrorData> {
        let uri = request.uri.as_str();
        match uri {
            "vinyl://collection/summary" => {
                let collection_resp = self
                    .client
                    .get_collection(&crate::models::GetCollectionArgs {
                        page: Some(1),
                        per_page: Some(1),
                        ..Default::default()
                    })
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;

                let vinyl_resp = self
                    .client
                    .get_collection(&crate::models::GetCollectionArgs {
                        page: Some(1),
                        per_page: Some(1),
                        category: Some("vinyl".to_string()),
                        ..Default::default()
                    })
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;

                let cd_resp = self
                    .client
                    .get_collection(&crate::models::GetCollectionArgs {
                        page: Some(1),
                        per_page: Some(1),
                        category: Some("cd".to_string()),
                        ..Default::default()
                    })
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;

                let unplayed_resp = self
                    .client
                    .get_unplayed_records(&crate::models::GetUnplayedRecordsArgs {
                        page: Some(1),
                        per_page: Some(1),
                    })
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;

                let genre_breakdown = self
                    .client
                    .get_genre_breakdown()
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;

                let summary_resource = crate::models::CollectionSummaryResource {
                    total_records: i64::from(collection_resp.pagination.items),
                    vinyl_count: i64::from(vinyl_resp.pagination.items),
                    cd_count: i64::from(cd_resp.pagination.items),
                    unplayed_count: i64::from(unplayed_resp.pagination.items),
                    top_genres: genre_breakdown,
                };

                let text = serde_json::to_string_pretty(&summary_resource)
                    .map_err(|e| rmcp::ErrorData::internal_error(e.to_string(), None))?;

                let content = rmcp::model::ResourceContents::text(text, uri)
                    .with_mime_type("application/json");

                Ok(rmcp::model::ReadResourceResult::new(vec![content]).into())
            }
            "vinyl://collection/value" => {
                let val_resp = self
                    .client
                    .get_collection_value()
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;

                let text = serde_json::to_string_pretty(&val_resp)
                    .map_err(|e| rmcp::ErrorData::internal_error(e.to_string(), None))?;

                let content = rmcp::model::ResourceContents::text(text, uri)
                    .with_mime_type("application/json");

                Ok(rmcp::model::ReadResourceResult::new(vec![content]).into())
            }
            "vinyl://stats/overview" => {
                let top_records = self
                    .client
                    .get_top_records(None, None)
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;
                let top_5: Vec<_> = top_records.into_iter().take(5).collect();

                let recent_listens = self
                    .client
                    .get_recent_listens(None, None)
                    .await
                    .map_err(|e| rmcp::ErrorData::internal_error(e, None))?;
                let recent_5: Vec<_> = recent_listens.into_iter().take(5).collect();

                let stats_json = serde_json::json!({
                    "top_records": top_5,
                    "recent_listens": recent_5,
                });

                let text = serde_json::to_string_pretty(&stats_json)
                    .map_err(|e| rmcp::ErrorData::internal_error(e.to_string(), None))?;

                let content = rmcp::model::ResourceContents::text(text, uri)
                    .with_mime_type("application/json");

                Ok(rmcp::model::ReadResourceResult::new(vec![content]).into())
            }
            _ => Err(rmcp::ErrorData::resource_not_found(
                format!("Resource not found: {uri}"),
                None,
            )),
        }
    }
}

#[cfg(test)]
mod contract_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tools_registered() {
        let t1 = VinylMcpServer::get_user_collection_tool_attr();
        assert_eq!(t1.name, "get_user_collection");

        let t2 = VinylMcpServer::sync_collection_tool_attr();
        assert_eq!(t2.name, "sync_collection");

        let t3 = VinylMcpServer::add_to_collection_tool_attr();
        assert_eq!(t3.name, "add_to_collection");

        let t4 = VinylMcpServer::remove_from_collection_tool_attr();
        assert_eq!(t4.name, "remove_from_collection");

        let t5 = VinylMcpServer::scan_barcode_tool_attr();
        assert_eq!(t5.name, "scan_barcode");

        let t6 = VinylMcpServer::log_record_listen_tool_attr();
        assert_eq!(t6.name, "log_record_listen");

        let t7 = VinylMcpServer::delete_scan_tool_attr();
        assert_eq!(t7.name, "delete_scan");

        let t8 = VinylMcpServer::reset_all_listens_tool_attr();
        assert_eq!(t8.name, "reset_all_listens");

        let t9 = VinylMcpServer::get_recent_listens_tool_attr();
        assert_eq!(t9.name, "get_recent_listens");

        let t10 = VinylMcpServer::get_top_records_tool_attr();
        assert_eq!(t10.name, "get_top_records");

        let t11 = VinylMcpServer::get_collection_value_tool_attr();
        assert_eq!(t11.name, "get_collection_value");

        let t12 = VinylMcpServer::get_genre_breakdown_tool_attr();
        assert_eq!(t12.name, "get_genre_breakdown");

        let t13 = VinylMcpServer::get_current_user_tool_attr();
        assert_eq!(t13.name, "get_current_user");

        let t14 = VinylMcpServer::get_random_record_tool_attr();
        assert_eq!(t14.name, "get_random_record");

        let t15 = VinylMcpServer::get_unplayed_records_tool_attr();
        assert_eq!(t15.name, "get_unplayed_records");

        let t16 = VinylMcpServer::get_record_details_tool_attr();
        assert_eq!(t16.name, "get_record_details");

        let t17 = VinylMcpServer::search_discogs_tool_attr();
        assert_eq!(t17.name, "search_discogs");

        let t18 = VinylMcpServer::get_roon_zones_tool_attr();
        assert_eq!(t18.name, "get_roon_zones");

        let t19 = VinylMcpServer::play_record_on_roon_tool_attr();
        assert_eq!(t19.name, "play_record_on_roon");

        let t20 = VinylMcpServer::update_record_condition_tool_attr();
        assert_eq!(t20.name, "update_record_condition");

        let t21 = VinylMcpServer::refresh_collection_prices_tool_attr();
        assert_eq!(t21.name, "refresh_collection_prices");

        let t22 = VinylMcpServer::get_roon_status_tool_attr();
        assert_eq!(t22.name, "get_roon_status");

        let t23 = VinylMcpServer::export_collection_tool_attr();
        assert_eq!(t23.name, "export_collection");

        let t24 = VinylMcpServer::get_record_placement_tool_attr();
        assert_eq!(t24.name, "get_record_placement");

        let t25 = VinylMcpServer::get_storage_layout_tool_attr();
        assert_eq!(t25.name, "get_storage_layout");

        let t26 = VinylMcpServer::get_top_artists_tool_attr();
        assert_eq!(t26.name, "get_top_artists");

        let t27 = VinylMcpServer::get_label_inbox_tool_attr();
        assert_eq!(t27.name, "get_label_inbox");

        let t28 = VinylMcpServer::resolve_label_photo_tool_attr();
        assert_eq!(t28.name, "resolve_label_photo");
    }

    #[test]
    fn test_prompts_registered() {
        let p1 = VinylMcpServer::recommend_record_prompt_attr();
        assert_eq!(p1.name, "recommend_record");

        let p2 = VinylMcpServer::grading_audit_prompt_attr();
        assert_eq!(p2.name, "grading_audit");

        let p3 = VinylMcpServer::identify_record_from_label_prompt_attr();
        assert_eq!(p3.name, "identify_record_from_label");

        let p4 = VinylMcpServer::process_label_inbox_prompt_attr();
        assert_eq!(p4.name, "process_label_inbox");
    }

    #[test]
    fn test_server_capabilities_declared() {
        let client = VinylApiClient::new(
            "http://localhost:8080".to_string(),
            None,
            Some("user".to_string()),
            Some("pass".to_string()),
        );
        let server = VinylMcpServer::new(client);
        let config = server.get_info();
        assert!(config.capabilities.tools.is_some());
        assert!(config.capabilities.prompts.is_some());
        assert!(config.capabilities.resources.is_some());
    }
}
