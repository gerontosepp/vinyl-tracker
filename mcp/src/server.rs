use crate::client::VinylApiClient;
use crate::models::*;
use rmcp::{
    ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    tool, tool_handler, tool_router,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct VinylMcpServer {
    client: Arc<VinylApiClient>,
    tool_router: ToolRouter<Self>,
}

impl VinylMcpServer {
    pub fn new(client: VinylApiClient) -> Self {
        Self {
            client: Arc::new(client),
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router(router = tool_router)]
impl VinylMcpServer {
    /// Retrieve the user's vinyl collection with optional pagination, sorting, search, and min_plays filter.
    #[tool(
        name = "get_user_collection",
        description = "Retrieve the user's vinyl collection from Vinyl Tracker. Supports pagination (page, per_page), sorting ('artist', 'listens', 'addedAt'), sort order ('asc', 'desc'), minimum plays filter, search terms, category filter ('all', 'vinyl', 'cd'), genres filter (e.g. ['Jazz', 'Rock']), and years filter (e.g. '1970-1972, 1975')."
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
            "Sync completed successfully: {} added, {} removed.",
            result.added_count, result.removed_count
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
        Ok(format!(
            "Successfully added release {} to collection. Sync result: {} added, {} removed.",
            args.release_id, result.added_count, result.removed_count
        ))
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
        description = "Fetches comprehensive details for a record by its database ID or Discogs release ID, including tracklist, release formats, labels, release notes, and personal listen history."
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
        description = "Searches the global Discogs database for vinyl records and releases by album title, artist, barcode, or catalog number."
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
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for VinylMcpServer {}

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
    }
}
