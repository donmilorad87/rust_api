//! WebSocket Gateway for Blazing Sun
//!
//! This service handles all WebSocket connections and routes messages
//! between clients and backend services via Kafka.

use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::signal;
use tracing::{info, error, warn};

mod config;
mod server;
mod connection;
mod kafka;
mod redis_client;
mod auth;
mod protocol;
mod error;

use config::Config;
use server::WebSocketServer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenv::dotenv().ok();

    // Initialize tracing
    init_tracing();

    info!("Starting WebSocket Gateway...");

    // Load configuration
    let config = Config::from_env()?;
    info!("Configuration loaded: {}:{}", config.host, config.port);

    // Create the WebSocket server
    let server = WebSocketServer::new(config.clone()).await?;
    let server = Arc::new(server);

    // Bind to address
    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = TcpListener::bind(&addr).await?;
    info!("WebSocket Gateway listening on ws://{}", addr);

    // Spawn health check server
    let health_port = config.health_port;
    tokio::spawn(async move {
        if let Err(e) = run_health_server(health_port).await {
            error!("Health server error: {}", e);
        }
    });

    // Accept connections with graceful shutdown
    let server_clone = server.clone();
    tokio::select! {
        result = accept_connections(listener, server_clone) => {
            if let Err(e) = result {
                error!("Server error: {}", e);
            }
        }
        _ = shutdown_signal() => {
            info!("Shutdown signal received, stopping server...");
        }
    }

    // Graceful shutdown
    info!("Shutting down WebSocket Gateway...");
    server.shutdown().await;
    info!("WebSocket Gateway stopped");

    Ok(())
}

/// Accept incoming WebSocket connections
async fn accept_connections(
    listener: TcpListener,
    server: Arc<WebSocketServer>,
) -> anyhow::Result<()> {
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                let server = server.clone();
                tokio::spawn(async move {
                    if let Err(e) = server.handle_connection(stream, addr).await {
                        warn!("Connection error from {}: {}", addr, e);
                    }
                });
            }
            Err(e) => {
                error!("Failed to accept connection: {}", e);
            }
        }
    }
}

/// Run a simple HTTP health check server
async fn run_health_server(port: u16) -> anyhow::Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let addr: SocketAddr = format!("0.0.0.0:{}", port).parse()?;
    let listener = TcpListener::bind(&addr).await?;
    info!("Health check server listening on http://{}", addr);

    loop {
        let (mut socket, _) = listener.accept().await?;

        tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            if socket.read(&mut buf).await.is_ok() {
                let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}";
                let _ = socket.write_all(response.as_bytes()).await;
            }
        });
    }
}

/// Wait for shutdown signal (Ctrl+C or SIGTERM)
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

/// Initialize tracing subscriber
fn init_tracing() {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,ws_gateway=debug"));

    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}
