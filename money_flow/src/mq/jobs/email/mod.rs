use crate::config::EmailConfig;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info};

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

/// Load and render an email template
fn render_template(template: &EmailTemplate, variables: &HashMap<String, String>) -> Result<String, String> {
    let template_path = format!(
        "{}/src/resources/views/emails/{}",
        env!("CARGO_MANIFEST_DIR"),
        template.template_path()
    );

    let content = std::fs::read_to_string(&template_path)
        .map_err(|e| format!("Failed to read template {}: {}", template_path, e))?;

    // Simple template rendering: replace {{variable_name}} with values
    let mut rendered = content;
    for (key, value) in variables {
        let placeholder = format!("{{{{{}}}}}", key);
        rendered = rendered.replace(&placeholder, value);
    }

    // Add current year if not provided
    if rendered.contains("{{year}}") {
        let year = chrono::Utc::now().format("%Y").to_string();
        rendered = rendered.replace("{{year}}", &year);
    }

    Ok(rendered)
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
