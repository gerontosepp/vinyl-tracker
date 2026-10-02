mod client;
mod models;
mod server;

use client::VinylApiClient;
use rmcp::ServiceExt;
use server::VinylMcpServer;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file if present
    dotenvy::dotenv().ok();

    // Log to stderr so stdout remains exclusively for MCP JSON-RPC messages
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let base_url = env::var("VINYL_API_URL")
        .or_else(|_| env::var("VINYL_BACKEND_URL"))
        .unwrap_or_else(|_| "http://localhost:8080".to_string());

    let token = env::var("VINYL_AUTH_TOKEN")
        .or_else(|_| env::var("VINYL_TOKEN"))
        .ok();

    let username = env::var("VINYL_USERNAME").ok();
    let password = env::var("VINYL_PASSWORD").ok();

    tracing::info!(
        "Starting Vinyl Tracker MCP Server with backend at: {}",
        base_url
    );

    let client = VinylApiClient::new(base_url, token, username, password);

    // Eagerly verify credentials if provided
    if let Err(e) = client.ensure_authenticated().await {
        tracing::warn!(
            "Initial authentication check encountered a warning: {}. The server will retry on request.",
            e
        );
    } else {
        tracing::info!("Authentication initialized successfully.");
    }

    let server = VinylMcpServer::new(client);
    let service = server.serve(rmcp::transport::stdio()).await?;
    tracing::info!("Vinyl Tracker MCP Server running on stdio transport.");
    service.waiting().await?;

    Ok(())
}
