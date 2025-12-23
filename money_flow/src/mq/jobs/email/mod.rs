use crate::core::controllers::email::{self as email_controller, EmailRecipient};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub use crate::core::controllers::email::EmailTemplate;

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

/// Execute the send_email job by delegating to core email controller
pub async fn execute(params: &SendEmailParams) -> Result<bool, String> {
    let recipient = EmailRecipient::new(&params.to_email, &params.to_name);
    email_controller::send(&recipient, &params.template, &params.variables).await
}
