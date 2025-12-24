use crate::config::EmailConfig;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tera::{Context, Tera};
use tracing::{error, info};

/// Initialize Tera template engine with all email templates
static TEMPLATES: Lazy<Tera> = Lazy::new(|| {
    let template_dir = EmailConfig::template_dir();

    let mut tera = match Tera::new(template_dir) {
        Ok(t) => t,
        Err(e) => {
            panic!("Failed to initialize Tera templates: {}", e);
        }
    };

    tera.autoescape_on(vec![".html"]);
    tera
});

/// Email template types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailTemplate {
    Welcome,
    AccountActivation,
    ForgotPassword,
    UserMustSetPassword,
    PasswordChange,
    ActivationSuccess,
    PasswordResetSuccess,
}

impl EmailTemplate {
    pub fn template_path(&self) -> &'static str {
        match self {
            EmailTemplate::Welcome => "welcome.html",
            EmailTemplate::AccountActivation => "account_activation.html",
            EmailTemplate::ForgotPassword => "forgot_password.html",
            EmailTemplate::UserMustSetPassword => "user_must_set_password.html",
            EmailTemplate::PasswordChange => "password_change.html",
            EmailTemplate::ActivationSuccess => "activation_success.html",
            EmailTemplate::PasswordResetSuccess => "password_reset_success.html",
        }
    }

    pub fn subject(&self) -> &'static str {
        match self {
            EmailTemplate::Welcome => "Welcome to MoneyFlow!",
            EmailTemplate::AccountActivation => "Activate Your MoneyFlow Account",
            EmailTemplate::ForgotPassword => "Reset Your Password",
            EmailTemplate::UserMustSetPassword => "Set Up Your Password",
            EmailTemplate::PasswordChange => "Password Change Request",
            EmailTemplate::ActivationSuccess => "Account Activated Successfully",
            EmailTemplate::PasswordResetSuccess => "Password Changed Successfully",
        }
    }
}

/// Email recipient information
#[derive(Debug, Clone)]
pub struct EmailRecipient {
    pub email: String,
    pub name: String,
}

impl EmailRecipient {
    pub fn new(email: &str, name: &str) -> Self {
        Self {
            email: email.to_string(),
            name: name.to_string(),
        }
    }
}

/// Render an email template using Tera
fn render_template(
    template: &EmailTemplate,
    variables: &HashMap<String, String>,
) -> Result<String, String> {
    let mut context = Context::new();

    // Add all user-provided variables
    for (key, value) in variables {
        context.insert(key, value);
    }

    // Add common variables
    context.insert("year", &chrono::Utc::now().format("%Y").to_string());
    context.insert("app_name", "MoneyFlow");

    TEMPLATES
        .render(template.template_path(), &context)
        .map_err(|e| format!("Template rendering error: {}", e))
}

/// Send an email using the configured SMTP transport
pub async fn send(
    recipient: &EmailRecipient,
    template: &EmailTemplate,
    variables: &HashMap<String, String>,
) -> Result<bool, String> {
    info!(
        "Sending email to: {} ({})",
        recipient.email,
        template.subject()
    );

    // Render the template
    let html_body = render_template(template, variables)?;

    // Build the email message
    let from_address = format!(
        "{} <{}>",
        EmailConfig::from_name(),
        EmailConfig::from_address()
    );
    let to_address = format!("{} <{}>", recipient.name, recipient.email);

    let email = Message::builder()
        .from(
            from_address
                .parse()
                .map_err(|e| format!("Invalid from address: {}", e))?,
        )
        .to(to_address
            .parse()
            .map_err(|e| format!("Invalid to address: {}", e))?)
        .subject(template.subject())
        .header(ContentType::TEXT_HTML)
        .body(html_body)
        .map_err(|e| format!("Failed to build email: {}", e))?;

    // Configure SMTP transport
    let creds = Credentials::new(
        EmailConfig::username().to_string(),
        EmailConfig::password().to_string(),
    );

    let mailer: AsyncSmtpTransport<Tokio1Executor> =
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(EmailConfig::host())
            .map_err(|e| format!("Failed to create SMTP transport: {}", e))?
            .credentials(creds)
            .port(EmailConfig::port())
            .build();

    // Send the email
    match mailer.send(email).await {
        Ok(response) => {
            info!(
                "Email sent successfully to {}: {:?}",
                recipient.email, response
            );
            Ok(true)
        }
        Err(e) => {
            error!("Failed to send email to {}: {}", recipient.email, e);
            Err(format!("SMTP error: {}", e))
        }
    }
}

/// Send a welcome email
pub async fn send_welcome(
    recipient: &EmailRecipient,
    first_name: &str,
) -> Result<bool, String> {
    let mut variables = HashMap::new();
    variables.insert("first_name".to_string(), first_name.to_string());
    variables.insert("email".to_string(), recipient.email.clone());

    send(recipient, &EmailTemplate::Welcome, &variables).await
}
