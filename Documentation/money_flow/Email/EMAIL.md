# Email System Documentation

This document provides comprehensive documentation for the email system in the Money Flow application.

---

## Overview

The Money Flow application uses a robust email system built on:
- **Lettre** - Rust email library for SMTP
- **Tera** - Template engine for HTML emails
- **RabbitMQ** - Async processing via job queue

**File Locations:**
- Email Controller: `bootstrap/includes/controllers/email.rs`
- Email Job: `app/mq/jobs/email/mod.rs`
- Email Worker: `app/mq/workers/email/mod.rs`
- Email Templates: `resources/views/emails/`
- Email Config: `config/email.rs`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Email System Flow                                 │
└────────────────────────────────────────────────────────────────────────────┘

┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌──────────┐
│   Controller  │────▶│   RabbitMQ    │────▶│ Email Worker  │────▶│   SMTP   │
│  (API Route)  │     │    Queue      │     │  (Processor)  │     │  Server  │
└───────────────┘     └───────────────┘     └───────────────┘     └──────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │     Tera      │
                                            │   Templates   │
                                            └───────────────┘
```

### Why Async Processing?

Emails are sent via RabbitMQ job queue for:
1. **Non-blocking requests** - API returns immediately
2. **Retry capability** - Failed emails retry automatically
3. **Scalability** - Multiple workers can process emails
4. **Reliability** - Jobs persist if server restarts

---

## Configuration

### Environment Variables

```env
# SMTP Configuration
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_FROM_ADDRESS=noreply@moneyflow.app
MAIL_FROM_NAME=MoneyFlow
MAIL_ENCRYPTION=starttls
```

### EmailConfig (`config/email.rs`)

```rust
use once_cell::sync::Lazy;

pub struct EmailConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from_address: String,
    pub from_name: String,
    pub encryption: String,
    pub template_dir: String,
}

pub static EMAIL: Lazy<EmailConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();
    EmailConfig {
        host: std::env::var("MAIL_HOST").expect("MAIL_HOST required"),
        port: std::env::var("MAIL_PORT")
            .unwrap_or_else(|_| "587".to_string())
            .parse()
            .expect("MAIL_PORT must be a number"),
        username: std::env::var("MAIL_USERNAME").expect("MAIL_USERNAME required"),
        password: std::env::var("MAIL_PASSWORD").expect("MAIL_PASSWORD required"),
        from_address: std::env::var("MAIL_FROM_ADDRESS")
            .unwrap_or_else(|_| "noreply@moneyflow.app".to_string()),
        from_name: std::env::var("MAIL_FROM_NAME")
            .unwrap_or_else(|_| "MoneyFlow".to_string()),
        encryption: std::env::var("MAIL_ENCRYPTION")
            .unwrap_or_else(|_| "starttls".to_string()),
        template_dir: "src/resources/views/emails/**/*".to_string(),
    }
});

impl EmailConfig {
    pub fn host() -> &'static str { &EMAIL.host }
    pub fn port() -> u16 { EMAIL.port }
    pub fn username() -> &'static str { &EMAIL.username }
    pub fn password() -> &'static str { &EMAIL.password }
    pub fn from_address() -> &'static str { &EMAIL.from_address }
    pub fn from_name() -> &'static str { &EMAIL.from_name }
    pub fn template_dir() -> &'static str { &EMAIL.template_dir }
}
```

---

## Email Templates

### Available Templates

| Template | File | Subject | Variables |
|----------|------|---------|-----------|
| Welcome | `welcome.html` | "Welcome to MoneyFlow!" | `first_name`, `email` |
| Account Activation | `account_activation.html` | "Activate Your MoneyFlow Account" | `first_name`, `email`, `activation_code` |
| Forgot Password | `forgot_password.html` | "Reset Your Password" | `first_name`, `reset_code` |
| User Must Set Password | `user_must_set_password.html` | "Set Up Your Password" | `first_name`, `set_password_code` |
| Password Change | `password_change.html` | "Password Change Request" | `first_name`, `change_code` |
| Activation Success | `activation_success.html` | "Account Activated Successfully" | `first_name` |
| Password Reset Success | `password_reset_success.html` | "Password Changed Successfully" | `first_name` |

### EmailTemplate Enum

```rust
// bootstrap/includes/controllers/email.rs

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
```

### Template Structure

```
resources/views/emails/
├── base.html                    # Base layout with styles
├── welcome.html                 # Welcome email
├── account_activation.html      # Activation code email
├── forgot_password.html         # Password reset email
├── user_must_set_password.html  # Force password set
├── password_change.html         # Password change request
├── activation_success.html      # Activation confirmed
└── password_reset_success.html  # Password reset confirmed
```

### Base Template (`base.html`)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4A90D9; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background: #4A90D9;
                  color: white; text-decoration: none; border-radius: 4px; }
        .code { font-size: 32px; font-weight: bold; color: #4A90D9; letter-spacing: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ app_name }}</h1>
        </div>
        <div class="content">
            {% block content %}{% endblock %}
        </div>
        <div class="footer">
            <p>&copy; {{ year }} {{ app_name }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
```

### Example: Account Activation Template

```html
{% extends "base.html" %}

{% block content %}
<h2>Hello {{ first_name }}!</h2>

<p>Thank you for registering with MoneyFlow. To activate your account, please use the following code:</p>

<p style="text-align: center;">
    <span class="code">{{ activation_code }}</span>
</p>

<p>This code will expire in 24 hours.</p>

<p>If you didn't create an account with us, please ignore this email.</p>

<p>Best regards,<br>The MoneyFlow Team</p>
{% endblock %}
```

---

## Sending Emails

### Method 1: Direct Send (Synchronous)

Use the `email::send()` function for immediate sending:

```rust
use crate::bootstrap::includes::controllers::email::{
    send, EmailTemplate, EmailRecipient
};
use std::collections::HashMap;

// Create recipient
let recipient = EmailRecipient::new("user@example.com", "John Doe");

// Prepare variables
let mut variables = HashMap::new();
variables.insert("first_name".to_string(), "John".to_string());
variables.insert("activation_code".to_string(), "ABC123".to_string());

// Send email
match send(&recipient, &EmailTemplate::AccountActivation, &variables).await {
    Ok(true) => println!("Email sent successfully"),
    Ok(false) => println!("Email sending failed"),
    Err(e) => println!("Error: {}", e),
}
```

### Method 2: Via RabbitMQ (Async - Recommended)

Use the job queue for production:

```rust
use crate::bootstrap::mq::{enqueue_job_dyn, JobOptions};
use crate::app::mq::jobs::email::SendEmailParams;
use crate::bootstrap::includes::controllers::email::EmailTemplate;
use std::collections::HashMap;

// Prepare parameters
let mut variables = HashMap::new();
variables.insert("first_name".to_string(), "John".to_string());
variables.insert("activation_code".to_string(), "ABC123".to_string());

let params = SendEmailParams {
    to_email: "user@example.com".to_string(),
    to_name: "John Doe".to_string(),
    template: EmailTemplate::AccountActivation,
    variables,
};

// Enqueue job
let options = JobOptions::new()
    .priority(2)        // Normal priority
    .fault_tolerance(3); // Retry 3 times on failure

let job_id = enqueue_job_dyn(&mq, "send_email", &params, options).await?;
println!("Email job queued: {}", job_id);
```

### Method 3: Convenience Functions

```rust
use crate::bootstrap::includes::controllers::email::{send_welcome, EmailRecipient};

let recipient = EmailRecipient::new("user@example.com", "John Doe");
send_welcome(&recipient, "John").await?;
```

---

## Email Job Structure

### SendEmailParams (`app/mq/jobs/email/mod.rs`)

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::bootstrap::includes::controllers::email::EmailTemplate;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendEmailParams {
    pub to_email: String,
    pub to_name: String,
    pub template: EmailTemplate,
    pub variables: HashMap<String, String>,
}
```

### Email Worker (`app/mq/workers/email/mod.rs`)

```rust
use crate::bootstrap::mq::JobResult;
use crate::bootstrap::includes::controllers::email::{send, EmailRecipient};
use crate::app::mq::jobs::email::SendEmailParams;
use tracing::{info, error};

pub async fn process(params: &SendEmailParams) -> Result<JobResult<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing email job for: {}", params.to_email);

    let recipient = EmailRecipient::new(&params.to_email, &params.to_name);

    match send(&recipient, &params.template, &params.variables).await {
        Ok(true) => {
            info!("Email sent successfully to {}", params.to_email);
            Ok(JobResult::Success(()))
        }
        Ok(false) => {
            error!("Email sending returned false for {}", params.to_email);
            Ok(JobResult::Failed("Email sending returned false".to_string()))
        }
        Err(e) => {
            // Check if error is retryable
            if is_retryable_error(&e) {
                Ok(JobResult::Retry(format!("Retryable error: {}", e)))
            } else {
                Ok(JobResult::Failed(format!("Non-retryable error: {}", e)))
            }
        }
    }
}

fn is_retryable_error(error: &str) -> bool {
    // Retry on connection/timeout errors
    error.contains("timeout") ||
    error.contains("connection") ||
    error.contains("temporarily unavailable")
}
```

---

## Adding New Email Templates

### Step 1: Create HTML Template

Create `resources/views/emails/my_new_template.html`:

```html
{% extends "base.html" %}

{% block content %}
<h2>Hello {{ first_name }}!</h2>

<p>Your custom email content here.</p>

<p>Variable example: {{ custom_variable }}</p>

<p>Best regards,<br>The MoneyFlow Team</p>
{% endblock %}
```

### Step 2: Add to EmailTemplate Enum

```rust
// bootstrap/includes/controllers/email.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailTemplate {
    Welcome,
    AccountActivation,
    // ... existing templates
    MyNewTemplate,  // Add new variant
}

impl EmailTemplate {
    pub fn template_path(&self) -> &'static str {
        match self {
            // ... existing matches
            EmailTemplate::MyNewTemplate => "my_new_template.html",
        }
    }

    pub fn subject(&self) -> &'static str {
        match self {
            // ... existing matches
            EmailTemplate::MyNewTemplate => "Your New Email Subject",
        }
    }
}
```

### Step 3: Create Convenience Function (Optional)

```rust
// bootstrap/includes/controllers/email.rs

pub async fn send_my_new_email(
    recipient: &EmailRecipient,
    first_name: &str,
    custom_variable: &str,
) -> Result<bool, String> {
    let mut variables = HashMap::new();
    variables.insert("first_name".to_string(), first_name.to_string());
    variables.insert("custom_variable".to_string(), custom_variable.to_string());

    send(recipient, &EmailTemplate::MyNewTemplate, &variables).await
}
```

### Step 4: Use in Controller

```rust
use crate::bootstrap::mq::{enqueue_job_dyn, JobOptions};
use crate::app::mq::jobs::email::SendEmailParams;
use crate::bootstrap::includes::controllers::email::EmailTemplate;

let params = SendEmailParams {
    to_email: user.email.clone(),
    to_name: format!("{} {}", user.first_name, user.last_name),
    template: EmailTemplate::MyNewTemplate,
    variables: {
        let mut vars = HashMap::new();
        vars.insert("first_name".to_string(), user.first_name.clone());
        vars.insert("custom_variable".to_string(), "value".to_string());
        vars
    },
};

enqueue_job_dyn(&mq, "send_email", &params, JobOptions::default()).await?;
```

---

## Email Controller Functions

### Core Functions

```rust
// bootstrap/includes/controllers/email.rs

/// Send an email using SMTP
pub async fn send(
    recipient: &EmailRecipient,
    template: &EmailTemplate,
    variables: &HashMap<String, String>,
) -> Result<bool, String>

/// Send a welcome email
pub async fn send_welcome(
    recipient: &EmailRecipient,
    first_name: &str,
) -> Result<bool, String>
```

### EmailRecipient Struct

```rust
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
```

---

## Template Variables

### Common Variables (Auto-Injected)

| Variable | Description | Example |
|----------|-------------|---------|
| `year` | Current year | "2024" |
| `app_name` | Application name | "MoneyFlow" |

### Template-Specific Variables

| Template | Variable | Required | Description |
|----------|----------|----------|-------------|
| Welcome | `first_name` | Yes | User's first name |
| Welcome | `email` | Yes | User's email |
| AccountActivation | `first_name` | Yes | User's first name |
| AccountActivation | `activation_code` | Yes | 6-character code |
| ForgotPassword | `first_name` | Yes | User's first name |
| ForgotPassword | `reset_code` | Yes | Reset code |
| PasswordChange | `first_name` | Yes | User's first name |
| PasswordChange | `change_code` | Yes | Verification code |

---

## Using Named Routes in Email Templates

Email templates support the `route()` function for generating URLs:

```html
{% extends "base.html" %}

{% block content %}
<h2>Hello {{ first_name }}!</h2>

<p>Click here to view your profile:</p>

<p>
    <a href="{{ route(name='web.profile') }}" class="button">
        View Profile
    </a>
</p>

<p>Or sign in here: <a href="{{ route(name='web.sign_in') }}">Sign In</a></p>
{% endblock %}
```

---

## Error Handling

### Retryable Errors

The email worker identifies retryable errors and re-queues jobs:

- Connection timeouts
- Temporary SMTP failures
- Network errors

### Non-Retryable Errors

These errors cause immediate failure:

- Invalid recipient address
- Invalid from address
- Template rendering errors
- Authentication failures

### Example Error Flow

```
Job Enqueued → Worker Processes → SMTP Error (Timeout)
                                       ↓
                                  Retry Logic
                                       ↓
                              Attempt 1 Failed → Re-queue
                              Attempt 2 Failed → Re-queue
                              Attempt 3 Failed → Move to jobs_failed queue
```

---

## Testing Emails

### Local Development

Use Mailtrap.io for testing:

```env
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=<mailtrap_user>
MAIL_PASSWORD=<mailtrap_pass>
```

### Preview Templates

```rust
// In a test or debug route
use crate::bootstrap::includes::controllers::email::render_template;

let mut vars = HashMap::new();
vars.insert("first_name".to_string(), "Test".to_string());
vars.insert("activation_code".to_string(), "ABC123".to_string());

let html = render_template(&EmailTemplate::AccountActivation, &vars)?;
// Output HTML for preview
```

---

## Best Practices

1. **Always use RabbitMQ** for production emails
2. **Include meaningful variables** in all templates
3. **Test templates locally** before deployment
4. **Monitor the `jobs_failed` queue** for failed emails
5. **Use appropriate priority levels**:
   - Critical: Password reset
   - High: Account activation
   - Normal: Welcome emails
   - Low: Marketing/newsletters

---

## Related Documentation

- [Message Queue (RabbitMQ)](../MessageQueue/MESSAGE_QUEUE.md) - Job queue system
- [Bootstrap Documentation](../Bootstrap/BOOTSTRAP.md) - Core framework
- [API Routes](../Routes/Api/API_ROUTES.md) - API endpoint documentation
