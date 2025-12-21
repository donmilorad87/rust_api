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
    let template_dir = format!(
        "{}/src/resources/views/emails/**/*",
        env!("CARGO_MANIFEST_DIR")
    );

    let mut tera = match Tera::new(&template_dir) {
        Ok(t) => t,
        Err(e) => {
            panic!("Failed to initialize Tera templates: {}", e);
        }
    };

    // Register custom filters if needed
    tera.autoescape_on(vec![".html"]);

    tera
});

/// Email template types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailTemplate {
    Welcome,
}

impl EmailTemplate {
    pub fn template_path(&self) -> &'static str {
        match self {
            EmailTemplate::Welcome => "welcome.html",
        }
    }

    pub fn subject(&self) -> &'static str {
        match self {
            EmailTemplate::Welcome => "Welcome to MoneyFlow!",
        }
    }
}

/// Parameters for send_email job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendEmailParams {
    pub to_email: String,
    pub to_name: String,
    pub template: EmailTemplate,
    pub variables: HashMap<String, String>,
}

impl SendEmailParams {
    pub fn new(to_email: &str, to_name: &str, template: EmailTemplate) -> Self {
        Self {
            to_email: to_email.to_string(),
            to_name: to_name.to_string(),
            template,
            variables: HashMap::new(),
        }
    }

    pub fn with_variable(mut self, key: &str, value: &str) -> Self {
        self.variables.insert(key.to_string(), value.to_string());
        self
    }

    pub fn with_variables(mut self, vars: HashMap<String, String>) -> Self {
        self.variables.extend(vars);
        self
    }
}

/// Render an email template using Tera
fn render_template(template: &EmailTemplate, variables: &HashMap<String, String>) -> Result<String, String> {
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

/// Execute the send_email job
pub async fn execute(params: &SendEmailParams) -> Result<bool, String> {
    info!("Sending email to: {} ({})", params.to_email, params.template.subject());

    // Render the template
    let html_body = render_template(&params.template, &params.variables)?;

    // Build the email message
    let from_address = format!("{} <{}>", EmailConfig::from_name(), EmailConfig::from_address());
    let to_address = format!("{} <{}>", params.to_name, params.to_email);

    let email = Message::builder()
        .from(from_address.parse().map_err(|e| format!("Invalid from address: {}", e))?)
        .to(to_address.parse().map_err(|e| format!("Invalid to address: {}", e))?)
        .subject(params.template.subject())
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
            info!("Email sent successfully to {}: {:?}", params.to_email, response);
            Ok(true)
        }
        Err(e) => {
            error!("Failed to send email to {}: {}", params.to_email, e);
            Err(format!("SMTP error: {}", e))
        }
    }
}
