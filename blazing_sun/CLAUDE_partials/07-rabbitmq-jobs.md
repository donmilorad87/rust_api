# RabbitMQ Jobs

## Job Priority Levels

| Priority | Name | Use Case |
|----------|------|----------|
| 0 | FIFO | Default, processed in order |
| 1 | Low | Non-urgent (welcome emails) |
| 2 | Normal | Standard priority |
| 3 | Medium | Important tasks |
| 4 | High | Time-sensitive |
| 5 | Critical | Must process immediately |

## Existing Jobs

| Job | Description | Parameters |
|-----|-------------|------------|
| `create_user` | Create user in database | `CreateUserParams { email, password, first_name, last_name }` |
| `send_email` | Send email via SMTP | `SendEmailParams { to, name, template, variables }` |

## Enqueueing Jobs

```rust
use crate::bootstrap::mq::{self, JobOptions, JobStatus};

// Fire and forget
let options = JobOptions::new()
    .priority(1)
    .fault_tolerance(3);  // Retry 3 times

mq::enqueue_job_dyn(&mq, "send_email", &params, options).await?;

// Wait for completion (with timeout)
let status = mq::enqueue_and_wait_dyn(&mq, "create_user", &params, options, 30000).await?;
match status {
    JobStatus::Completed => { /* success */ }
    JobStatus::Failed => { /* failed after retries */ }
    JobStatus::Pending => { /* still processing */ }
    JobStatus::Timeout => { /* timed out */ }
}
```

## Email Templates

| Template | Variables | Purpose |
|----------|-----------|---------|
| `welcome` | `first_name`, `email` | Welcome new user |
| `account_activation` | `first_name`, `email`, `activation_code` | Activation code |
| `forgot_password` | `first_name`, `reset_code` | Password reset |
| `user_must_set_password` | `first_name`, `set_password_code` | Force password set |
| `password_change` | `first_name` | Password changed notification |
| `activation_success` | `first_name` | Account activated |
| `password_reset_success` | `first_name` | Password reset success |
