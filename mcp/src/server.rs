use crate::client::VinylApiClient;
use crate::models::*;
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    tool, tool_handler, tool_router, ServerHandler,
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
        description = "Retrieve the user's vinyl collection from Vinyl Tracker. Supports pagination (page, per_page), sorting ('artist', 'listens', 'addedAt'), sort order ('asc', 'desc'), minimum plays filter, and search terms."
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

        let t3 = VinylMcpServer::scan_barcode_tool_attr();
        assert_eq!(t3.name, "scan_barcode");

        let t4 = VinylMcpServer::delete_scan_tool_attr();
        assert_eq!(t4.name, "delete_scan");

        let t5 = VinylMcpServer::reset_all_listens_tool_attr();
        assert_eq!(t5.name, "reset_all_listens");

        let t6 = VinylMcpServer::get_recent_listens_tool_attr();
        assert_eq!(t6.name, "get_recent_listens");

        let t7 = VinylMcpServer::get_top_records_tool_attr();
        assert_eq!(t7.name, "get_top_records");

        let t8 = VinylMcpServer::get_collection_value_tool_attr();
        assert_eq!(t8.name, "get_collection_value");

        let t9 = VinylMcpServer::get_genre_breakdown_tool_attr();
        assert_eq!(t9.name, "get_genre_breakdown");

        let t10 = VinylMcpServer::get_current_user_tool_attr();
        assert_eq!(t10.name, "get_current_user");
    }
}

