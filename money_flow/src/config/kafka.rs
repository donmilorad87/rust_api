use once_cell::sync::Lazy;

pub struct KafkaConfig {
    pub bootstrap_servers: String,
    pub host: String,
    pub port: u16,
    pub client_id: String,
    pub group_id: String,
    pub auto_offset_reset: String,
    pub enable_auto_commit: bool,
}

pub static KAFKA: Lazy<KafkaConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("KAFKA_HOST").unwrap_or_else(|_| "kafka".to_string());
    let port: u16 = std::env::var("KAFKA_PORT")
        .unwrap_or_else(|_| "9092".to_string())
        .parse()
        .expect("KAFKA_PORT must be a valid number");

    let bootstrap_servers = format!("{}:{}", host, port);

    let client_id =
        std::env::var("KAFKA_CLIENT_ID").unwrap_or_else(|_| "money-flow-app".to_string());

    let group_id =
        std::env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "money-flow-consumers".to_string());

    let auto_offset_reset =
        std::env::var("KAFKA_AUTO_OFFSET_RESET").unwrap_or_else(|_| "earliest".to_string());

    let enable_auto_commit = std::env::var("KAFKA_ENABLE_AUTO_COMMIT")
        .unwrap_or_else(|_| "true".to_string())
        .parse()
        .unwrap_or(true);

    KafkaConfig {
        bootstrap_servers,
        host,
        port,
        client_id,
        group_id,
        auto_offset_reset,
        enable_auto_commit,
    }
});

impl KafkaConfig {
    pub fn bootstrap_servers() -> &'static str {
        &KAFKA.bootstrap_servers
    }

    pub fn host() -> &'static str {
        &KAFKA.host
    }

    pub fn port() -> u16 {
        KAFKA.port
    }

    pub fn client_id() -> &'static str {
        &KAFKA.client_id
    }

    pub fn group_id() -> &'static str {
        &KAFKA.group_id
    }

    pub fn auto_offset_reset() -> &'static str {
        &KAFKA.auto_offset_reset
    }

    pub fn enable_auto_commit() -> bool {
        KAFKA.enable_auto_commit
    }
}
