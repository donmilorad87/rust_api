use once_cell::sync::Lazy;

pub struct RabbitMQConfig {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub vhost: String,
}

pub static RABBITMQ: Lazy<RabbitMQConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("RABBITMQ_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = std::env::var("RABBITMQ_PORT")
        .unwrap_or_else(|_| "5672".to_string())
        .parse()
        .expect("RABBITMQ_PORT must be a valid number");
    let user = std::env::var("RABBITMQ_USER").unwrap_or_else(|_| "guest".to_string());
    let password = std::env::var("RABBITMQ_PASSWORD").unwrap_or_else(|_| "guest".to_string());
    let vhost = std::env::var("RABBITMQ_VHOST").unwrap_or_else(|_| "/".to_string());

    // Build AMQP URL
    let encoded_vhost = if vhost == "/" {
        "%2F".to_string()
    } else {
        vhost.clone()
    };

    let url = format!(
        "amqp://{}:{}@{}:{}/{}",
        user, password, host, port, encoded_vhost
    );

    RabbitMQConfig {
        url,
        host,
        port,
        user,
        password,
        vhost,
    }
});

impl RabbitMQConfig {
    pub fn url() -> &'static str {
        &RABBITMQ.url
    }

    pub fn host() -> &'static str {
        &RABBITMQ.host
    }

    pub fn port() -> u16 {
        RABBITMQ.port
    }

    pub fn user() -> &'static str {
        &RABBITMQ.user
    }

    pub fn password() -> &'static str {
        &RABBITMQ.password
    }

    pub fn vhost() -> &'static str {
        &RABBITMQ.vhost
    }
}
