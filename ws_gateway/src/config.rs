//! Configuration module for WebSocket Gateway
//!
//! Loads configuration from environment variables.

use std::env;
use anyhow::{Context, Result};

/// Main configuration struct
#[derive(Debug, Clone)]
pub struct Config {
    // Server settings
    pub host: String,
    pub port: u16,
    pub health_port: u16,

    // Redis settings
    pub redis_url: String,

    // Kafka settings
    pub kafka_brokers: String,
    pub kafka_consumer_group: String,

    // JWT settings
    pub jwt_public_key_path: String,

    // Connection settings
    pub heartbeat_interval_secs: u64,
    pub heartbeat_timeout_secs: u64,
    pub max_message_size: usize,

    // Rate limiting
    pub rate_limit_messages_per_sec: u32,
    pub rate_limit_burst: u32,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            // Server settings
            host: env::var("WS_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("WS_PORT")
                .unwrap_or_else(|_| "9998".to_string())
                .parse()
                .context("Invalid WS_PORT")?,
            health_port: env::var("WS_HEALTH_PORT")
                .unwrap_or_else(|_| "9997".to_string())
                .parse()
                .context("Invalid WS_HEALTH_PORT")?,

            // Redis settings
            redis_url: env::var("REDIS_URL")
                .or_else(|_| {
                    // Build URL from components if REDIS_URL not set
                    let user = env::var("REDIS_USER").unwrap_or_else(|_| "app".to_string());
                    let password = env::var("REDIS_PASSWORD").unwrap_or_else(|_| "redis_secret_password".to_string());
                    let host = env::var("REDIS_HOST").unwrap_or_else(|_| "redis".to_string());
                    let port = env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
                    let db = env::var("REDIS_DB").unwrap_or_else(|_| "0".to_string());
                    Ok::<_, env::VarError>(format!("redis://{}:{}@{}:{}/{}", user, password, host, port, db))
                })
                .context("Failed to build Redis URL")?,

            // Kafka settings
            kafka_brokers: env::var("KAFKA_BROKERS")
                .or_else(|_| {
                    let host = env::var("KAFKA_HOST").unwrap_or_else(|_| "kafka".to_string());
                    let port = env::var("KAFKA_PORT").unwrap_or_else(|_| "9092".to_string());
                    Ok::<_, env::VarError>(format!("{}:{}", host, port))
                })
                .context("Failed to build Kafka brokers")?,
            kafka_consumer_group: env::var("KAFKA_CONSUMER_GROUP")
                .unwrap_or_else(|_| "ws_gateway".to_string()),

            // JWT settings
            jwt_public_key_path: env::var("JWT_PUBLIC_KEY_PATH")
                .unwrap_or_else(|_| "/keys/jwt_public.pem".to_string()),

            // Connection settings
            heartbeat_interval_secs: env::var("WS_HEARTBEAT_INTERVAL_SECS")
                .unwrap_or_else(|_| "15".to_string())
                .parse()
                .unwrap_or(15),
            heartbeat_timeout_secs: env::var("WS_HEARTBEAT_TIMEOUT_SECS")
                .unwrap_or_else(|_| "45".to_string())
                .parse()
                .unwrap_or(45),
            max_message_size: env::var("WS_MAX_MESSAGE_SIZE")
                .unwrap_or_else(|_| "65536".to_string())
                .parse()
                .unwrap_or(65536),

            // Rate limiting
            rate_limit_messages_per_sec: env::var("WS_RATE_LIMIT_PER_SEC")
                .unwrap_or_else(|_| "50".to_string())
                .parse()
                .unwrap_or(50),
            rate_limit_burst: env::var("WS_RATE_LIMIT_BURST")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
        })
    }
}

/// Kafka topic configuration
#[derive(Debug, Clone)]
pub struct KafkaTopics {
    // System topics
    pub system_events: &'static str,
    pub gateway_presence: &'static str,

    // Chat topics
    pub chat_commands: &'static str,
    pub chat_events: &'static str,

    // Games topics
    pub games_commands: &'static str,
    pub games_events: &'static str,
}

impl Default for KafkaTopics {
    fn default() -> Self {
        Self {
            system_events: "system.events",
            gateway_presence: "gateway.presence",
            chat_commands: "chat.commands",
            chat_events: "chat.events",
            games_commands: "games.commands",
            games_events: "games.events",
        }
    }
}

impl KafkaTopics {
    /// Get all topics that the gateway should consume from
    pub fn consumer_topics(&self) -> Vec<&str> {
        vec![
            self.system_events,
            self.chat_events,
            self.games_events,
        ]
    }

    /// Get all topics that the gateway should produce to
    pub fn producer_topics(&self) -> Vec<&str> {
        vec![
            self.system_events,
            self.gateway_presence,
            self.chat_commands,
            self.games_commands,
        ]
    }
}
