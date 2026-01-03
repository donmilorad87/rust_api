use once_cell::sync::Lazy;

pub struct ActivationConfig {
    pub expiry_account_activation: i64,
    pub expiry_forgot_password: i64,
    pub expiry_user_must_set_password: i64,
    pub expiry_password_change: i64,
    pub expiry_email_change: i64,
}

pub static ACTIVATION: Lazy<ActivationConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();
    ActivationConfig {
        expiry_account_activation: std::env::var("EXPIRY_ACCOUNT_ACTIVATION")
            .unwrap_or_else(|_| "60".to_string())
            .parse()
            .expect("EXPIRY_ACCOUNT_ACTIVATION must be a valid number"),
        expiry_forgot_password: std::env::var("EXPIRY_FORGOT_PASSWORD")
            .unwrap_or_else(|_| "60".to_string())
            .parse()
            .expect("EXPIRY_FORGOT_PASSWORD must be a valid number"),
        expiry_user_must_set_password: std::env::var("EXPIRY_USER_MUST_SET_PASSWORD")
            .unwrap_or_else(|_| "1440".to_string())
            .parse()
            .expect("EXPIRY_USER_MUST_SET_PASSWORD must be a valid number"),
        expiry_password_change: std::env::var("EXPIRY_PASSWORD_CHANGE")
            .unwrap_or_else(|_| "15".to_string())
            .parse()
            .expect("EXPIRY_PASSWORD_CHANGE must be a valid number"),
        expiry_email_change: std::env::var("EXPIRY_EMAIL_CHANGE")
            .unwrap_or_else(|_| "60".to_string())
            .parse()
            .expect("EXPIRY_EMAIL_CHANGE must be a valid number"),
    }
});

impl ActivationConfig {
    /// Expiry time for account activation in minutes (default: 60)
    pub fn expiry_account_activation() -> i64 {
        ACTIVATION.expiry_account_activation
    }

    /// Expiry time for forgot password in minutes (default: 60)
    pub fn expiry_forgot_password() -> i64 {
        ACTIVATION.expiry_forgot_password
    }

    /// Expiry time for user must set password in minutes (default: 1440 = 24 hours)
    pub fn expiry_user_must_set_password() -> i64 {
        ACTIVATION.expiry_user_must_set_password
    }

    /// Expiry time for logged-in user password change in minutes (default: 15)
    pub fn expiry_password_change() -> i64 {
        ACTIVATION.expiry_password_change
    }

    /// Expiry time for email change verification in minutes (default: 60)
    pub fn expiry_email_change() -> i64 {
        ACTIVATION.expiry_email_change
    }
}
