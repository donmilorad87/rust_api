//! Error types for WebSocket Gateway

use thiserror::Error;

/// Gateway-specific errors
#[derive(Error, Debug)]
pub enum GatewayError {
    #[error("WebSocket error: {0}")]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Kafka error: {0}")]
    Kafka(#[from] rdkafka::error::KafkaError),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Connection not authenticated")]
    NotAuthenticated,

    #[error("Invalid message: {0}")]
    InvalidMessage(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Connection closed")]
    ConnectionClosed,

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type alias for gateway operations
pub type GatewayResult<T> = Result<T, GatewayError>;
