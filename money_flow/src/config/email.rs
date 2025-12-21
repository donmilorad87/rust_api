use once_cell::sync::Lazy;

pub struct EmailConfig {
    pub mailer: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from_address: String,
    pub from_name: String,
}

pub static EMAIL: Lazy<EmailConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    EmailConfig {
        mailer: std::env::var("MAIL_MAILER")
            .unwrap_or_else(|_| "smtp".to_string()),
        host: std::env::var("MAIL_HOST")
            .expect("MAIL_HOST must be set"),
        port: std::env::var("MAIL_PORT")
            .unwrap_or_else(|_| "587".to_string())
            .parse()
            .expect("MAIL_PORT must be a valid number"),
        username: std::env::var("MAIL_USERNAME")
            .expect("MAIL_USERNAME must be set"),
        password: std::env::var("MAIL_PASSWORD")
            .expect("MAIL_PASSWORD must be set"),
        from_address: std::env::var("MAIL_FROM_ADDRESS")
            .unwrap_or_else(|_| "noreply@example.com".to_string()),
        from_name: std::env::var("MAIL_FROM_NAME")
            .unwrap_or_else(|_| "App".to_string()),
    }
});

impl EmailConfig {
    pub fn mailer() -> &'static str {
        &EMAIL.mailer
    }

    pub fn host() -> &'static str {
        &EMAIL.host
    }

    pub fn port() -> u16 {
        EMAIL.port
    }

    pub fn username() -> &'static str {
        &EMAIL.username
    }

    pub fn password() -> &'static str {
        &EMAIL.password
    }

    pub fn from_address() -> &'static str {
        &EMAIL.from_address
    }

    pub fn from_name() -> &'static str {
        &EMAIL.from_name
    }
}
