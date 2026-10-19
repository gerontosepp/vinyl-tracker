# Design: MCP Resources, Prompts and Collection Export

## 1. Architecture & Component Interaction
The MCP Server (`mcp/`) connects via HTTP (`reqwest`) to the Vinyl Tracker REST backend.

```
Client (e.g. Claude Desktop, Antigravity)
   |
   | JSON-RPC 2.0 (Stdio)
   v
VinylMcpServer (mcp/src/server.rs)
   |-- Tools: ToolRouter (get_user_collection, export_collection, ...)
   |-- Prompts: PromptRouter (recommend_record, grading_audit)
   |-- Resources: ServerHandler (list_resources, read_resource)
   v
VinylApiClient (mcp/src/client.rs)
   v
Backend REST API (/api/collection/export, /api/analytics, /api/collection)
```

## 2. Technical Details

### 2.1 Export Tool (`export_collection`)
- Arguments struct in `mcp/src/models.rs`:
  ```rust
  #[derive(Debug, Deserialize, schemars::JsonSchema)]
  pub struct ExportCollectionArgs {
      /// Export format: 'json' or 'csv'
      pub format: String,
  }
  ```
- Client method in `mcp/src/client.rs`:
  `export_collection(&self, format: &str) -> Result<String, String>`
- Server tool in `mcp/src/server.rs`:
  `export_collection(&self, Parameters(args): Parameters<ExportCollectionArgs>) -> Result<String, String>`

### 2.2 MCP Resources
- Trait methods implemented on `VinylMcpServer` for `ServerHandler`:
  - `list_resources(&self, ...)` returns the list of 3 resources with URIs:
    - `vinyl://collection/summary`
    - `vinyl://collection/value`
    - `vinyl://stats/overview`
  - `read_resource(&self, request, ...)` matches `request.uri`:
    - `vinyl://collection/summary`: fetches collection pagination / genre breakdown to construct JSON summary.
    - `vinyl://collection/value`: calls `self.client.get_collection_value()`.
    - `vinyl://stats/overview`: calls `self.client.get_top_records(Some(5))` and `self.client.get_recent_listens(Some(5))`.

### 2.3 MCP Prompts
- Defined via `#[rmcp::prompt]` in a dedicated `impl VinylMcpServer` block with `#[prompt_router(router = prompt_router)]`:
  - `recommend_record(&self, Parameters(args): Parameters<RecommendRecordPromptArgs>) -> Result<Vec<PromptMessage>, String>`
  - `grading_audit(&self, Parameters(args): Parameters<GradingAuditPromptArgs>) -> Result<Vec<PromptMessage>, String>`
- Prompt router stored on `VinylMcpServer` and wired into `ServerHandler` via `#[prompt_handler(router = self.prompt_router)]`.

### 2.4 Server Capabilities (`get_info`)
- Override `get_info(&self) -> rmcp::model::ServerConfig` on `ServerHandler` declaring:
  - `tools: Some(ToolsCapability::default())`
  - `prompts: Some(PromptsCapability::default())`
  - `resources: Some(ResourcesCapability::default())`
