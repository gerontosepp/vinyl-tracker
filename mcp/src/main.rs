mod client;
mod models;
mod server;

use client::VinylApiClient;
use rmcp::ServiceExt;
use server::{SERVER_NAME, SERVER_VERSION, VinylMcpServer};
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // CLI flags run before anything writes to stdout, which is reserved for MCP JSON-RPC.
    let args: Vec<String> = env::args().skip(1).collect();
    if args.iter().any(|arg| arg == "--version" || arg == "-V") {
        println!("{SERVER_NAME} {SERVER_VERSION}");
        return Ok(());
    }
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        println!(
            "{SERVER_NAME} {SERVER_VERSION}\n\n\
             MCP server for Vinyl Tracker, speaking JSON-RPC over stdio.\n\n\
             Usage: {SERVER_NAME} [--version | --help]\n\n\
             Environment variables:\n  \
             VINYL_API_URL      Backend base URL (default: http://localhost:8080)\n  \
             VINYL_AUTH_TOKEN   Bearer token (optional)\n  \
             VINYL_USERNAME     Login username (optional)\n  \
             VINYL_PASSWORD     Login password (optional)"
        );
        return Ok(());
    }

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
