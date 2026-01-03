# Application Overview

**Blazing Sun** - Rust web API for personal finance tracking with event-driven architecture.

## Tech Stack

| Category | Technology | Crate |
|----------|------------|-------|
| Framework | Actix-web 4 | `actix-web`, `actix-cors`, `actix-multipart` |
| Database | PostgreSQL | `sqlx` (compile-time checked) |
| Queue (Tasks) | RabbitMQ | `lapin` |
| Events (Streaming) | Apache Kafka | `rdkafka` |
| Cache | Redis | `redis` |
| Email | SMTP | `lettre` |
| Templates | Tera | `tera` |
| Auth | JWT | `jsonwebtoken`, `bcrypt` |
| Cron | Scheduler | `tokio-cron-scheduler` |
| Async | Tokio | `tokio` |
| Logging | Tracing | `tracing`, `tracing-subscriber` |
| Validation | Validator | `validator` |
| Serialization | Serde | `serde`, `serde_json` |
| UUID | uuid v4 | `uuid` |
| DateTime | Chrono | `chrono` |
| File Hashing | SHA256 | `sha2` |
