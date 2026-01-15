# Complete Project Structure

```
blazing_sun/
├── Cargo.toml                          # Dependencies and project config
├── Cargo.lock                          # Locked dependency versions
├── .env                                # App environment variables (synced from Docker)
├── .env.example                        # Example env file
│
├── migrations/                         # SQLx database migrations
│   ├── 20251217202253_create_users_table.sql
│   ├── 20251217203606_create_categories_table.sql
│   ├── 20251217204134_create_transactions_table.sql
│   ├── 20251222231150_add_user_fields_and_activation_hashes.sql
│   └── 20251224120000_create_uploads_table.sql
│
├── .sqlx/                              # SQLx query cache (COMMIT TO GIT)
│   └── query-*.json                    # Cached query metadata for offline builds
│
├── storage/                            # File storage
│   └── app/
│       ├── public/                     # Public files (nginx serves at /storage/)
│       └── private/                    # Private files (API serves with auth)
│
├── tests/                              # Integration tests
│   └── routes_test.rs
│
└── src/
    ├── main.rs                         # Application entry point
    ├── lib.rs                          # Module exports for library usage
    │
    ├── config/                         # Configuration modules (once_cell::Lazy)
    │   ├── mod.rs                      # Re-exports all config modules
    │   ├── app.rs                      # AppConfig: HOST, PORT, RUST_LOG
    │   ├── database.rs                 # DatabaseConfig: DATABASE_URL, max_connections
    │   ├── jwt.rs                      # JwtConfig: JWT_SECRET, EXPIRATION_TIME
    │   ├── redis.rs                    # RedisConfig: REDIS_URL
    │   ├── rabbitmq.rs                 # RabbitMQConfig: RABBITMQ_URL
    │   ├── kafka.rs                    # KafkaConfig: bootstrap_servers, group_id
    │   ├── email.rs                    # EmailConfig: SMTP settings
    │   ├── activation.rs               # ActivationConfig: token expiry times
    │   ├── cron.rs                     # CronConfig: job schedules
    │   └── upload.rs                   # UploadConfig: max_file_size, allowed_types, storage
    │
    ├── bootstrap/                      # Core Framework Layer
    │   ├── mod.rs                      # Re-exports: database, events, includes, middleware, mq, routes, utility
    │   │
    │   ├── database/                   # Database connection and state
    │   │   ├── mod.rs                  # Re-exports database module
    │   │   └── database.rs             # AppState, DynMq, SharedEventBus, create_pool()
    │   │
    │   ├── events/                     # Kafka Event System
    │   │   ├── mod.rs                  # EventBus, SharedEventBus, init(), start_consumer(), publish module
    │   │   ├── types.rs                # DomainEvent, EventType, EventMetadata, EventBuilder
    │   │   ├── topics.rs               # Topic constants: USER_EVENTS, AUTH_EVENTS, etc.
    │   │   ├── producer.rs             # EventProducer: publish(), publish_batch(), publish_with_retry()
    │   │   ├── consumer.rs             # EventConsumer, EventHandler trait, EventHandlerError
    │   │   └── handlers/               # Event subscribers
    │   │       ├── mod.rs              # Handler registration: create_handlers()
    │   │       ├── user.rs             # UserEventHandler, UserAuditHandler
    │   │       └── auth.rs             # AuthEventHandler
    │   │
    │   ├── includes/                   # Shared Controllers and Services
    │   │   ├── mod.rs                  # Re-exports controllers and storage
    │   │   ├── controllers/
    │   │   │   ├── mod.rs              # Re-exports all shared controllers
    │   │   │   ├── email.rs            # EmailController: send_email() via SMTP
    │   │   │   └── uploads.rs          # UploadsController: handle file uploads
    │   │   └── storage/                # Storage Driver Abstraction (S3-ready)
    │   │       ├── mod.rs              # StorageDriver trait, Storage manager, StorageError
    │   │       ├── local.rs            # LocalStorageDriver: filesystem storage
    │   │       └── s3.rs               # S3StorageDriver: AWS S3 (placeholder)
    │   │
    │   ├── middleware/                 # HTTP Middleware
    │   │   ├── mod.rs                  # Re-exports middleware controllers
    │   │   └── controllers/
    │   │       ├── mod.rs              # Re-exports all middleware, json_error_handler
    │   │       ├── auth.rs             # JwtMiddleware: validate JWT, extract claims
    │   │       ├── cors.rs             # CORS configuration: configure()
    │   │       ├── json_error.rs       # JSON error handler for invalid JSON
    │   │       ├── security_headers.rs # Security headers: X-Content-Type-Options, etc.
    │   │       └── tracing_logger.rs   # Request logging: init(), configure()
    │   │
    │   ├── mq/                         # RabbitMQ Message Queue Core
    │   │   ├── mod.rs                  # Re-exports mq controller
    │   │   └── controller/
    │   │       ├── mod.rs              # Re-exports mq functions
    │   │       └── mq.rs               # MessageQueue, SharedQueue, JobOptions, JobStatus, enqueue functions
    │   │
    │   ├── routes/                     # Route Registration
    │   │   ├── mod.rs                  # Re-exports route controllers
    │   │   └── controller/
    │   │       ├── mod.rs              # Re-exports api and crons
    │   │       ├── api.rs              # register(): all API route definitions
    │   │       └── crons.rs            # register(): all cron job schedules
    │   │
    │   └── utility/                    # Utility Functions
    │       ├── mod.rs                  # Re-exports auth and template
    │       ├── auth.rs                 # Auth utilities: JWT generation, password hashing
    │       └── template.rs             # Template helpers: assets(), asset(), private_asset()
    │
    ├── app/                            # Application Layer
    │   ├── mod.rs                      # Re-exports: cron, db_query, http, mq
    │   │
    │   ├── cron/                       # Cron Job Implementations
    │   │   ├── mod.rs                  # Re-exports all cron jobs
    │   │   ├── user_counter.rs         # UserCounterJob: counts users periodically
    │   │   └── list_user_emails.rs     # ListUserEmailsJob: lists all user emails
    │   │
    │   ├── db_query/                   # Database Queries
    │   │   ├── mod.rs                  # Re-exports read and mutations
    │   │   ├── read/                   # SELECT queries (read-only)
    │   │   │   ├── mod.rs              # Re-exports read modules
    │   │   │   ├── user/
    │   │   │   │   └── mod.rs          # get_by_id, get_by_email, has_with_email, sign_in, count
    │   │   │   └── upload/
    │   │   │       └── mod.rs          # get_by_uuid, get_by_user_id, get_public_by_uuid
    │   │   └── mutations/              # INSERT/UPDATE/DELETE queries
    │   │       ├── mod.rs              # Re-exports mutation modules
    │   │       ├── user/
    │   │       │   └── mod.rs          # create, update_partial, update_full, delete
    │   │       ├── upload/
    │   │       │   └── mod.rs          # create, delete
    │   │       └── activation_hash/
    │   │           └── mod.rs          # create, verify, delete, generate_hash
    │   │
    │   ├── http/                       # HTTP Layer
    │   │   ├── mod.rs                  # Re-exports api and web modules
    │   │   ├── api/                    # REST API
    │   │   │   ├── mod.rs              # Re-exports controllers, validators, middlewares
    │   │   │   ├── controllers/
    │   │   │   │   ├── mod.rs          # Re-exports all controllers
    │   │   │   │   ├── auth.rs         # AuthController: sign_up(), sign_in()
    │   │   │   │   ├── user.rs         # UserController: get_current(), update_*, delete()
    │   │   │   │   ├── activation.rs   # ActivationController: activate, forgot_password, reset
    │   │   │   │   ├── upload.rs       # UploadController: single, multiple, chunked, download
    │   │   │   │   └── responses.rs    # BaseResponse, UserDto, ValidationErrorResponse
    │   │   │   ├── validators/
    │   │   │   │   ├── mod.rs          # Re-exports validators
    │   │   │   │   ├── auth.rs         # SignupRequest, SigninRequest, validate_password()
    │   │   │   │   └── user.rs         # UpdateUserRequest, user field validators
    │   │   │   └── middlewares/
    │   │   │       └── mod.rs          # API-specific middlewares
    │   │   └── web/                    # Web Pages (Tera templates)
    │   │       ├── mod.rs              # Re-exports web modules
    │   │       ├── controllers/
    │   │       │   ├── mod.rs
    │   │       │   └── pages.rs        # Page handlers: index, dashboard, etc.
    │   │       ├── validators/
    │   │       │   └── mod.rs
    │   │       └── middlewares/
    │   │           └── mod.rs
    │   │
    │   └── mq/                         # Message Queue Jobs
    │       ├── mod.rs                  # Re-exports jobs and workers
    │       ├── jobs/                   # Job Definitions (parameters)
    │       │   ├── mod.rs              # Re-exports job modules
    │       │   ├── create_user/
    │       │   │   └── mod.rs          # CreateUserParams, execute()
    │       │   └── email/
    │       │       └── mod.rs          # SendEmailParams, EmailTemplate enum
    │       └── workers/                # Job Processors (executors)
    │           ├── mod.rs              # Worker router: process_job()
    │           ├── create_user/
    │           │   └── mod.rs          # CreateUserWorker: process()
    │           └── email/
    │               └── mod.rs          # EmailWorker: process(), render templates
    │
    ├── routes/                         # Route Definitions
    │   ├── mod.rs                      # Named routes registry
    │   ├── api.rs                      # API routes: /api/v1/*
    │   ├── web.rs                      # Web routes: /, /dashboard, etc.
    │   └── crons.rs                    # Cron job schedules
    │
    └── resources/                      # Static Resources
        ├── css/
        │   └── toastify.min.css
        ├── js/
        │   └── toastify.min.js
        └── views/
            ├── emails/                 # Tera email templates
            │   ├── base.html           # Base layout (header, footer, styles)
            │   ├── welcome.html
            │   ├── account_activation.html
            │   ├── forgot_password.html
            │   ├── user_must_set_password.html
            │   ├── password_change.html
            │   ├── activation_success.html
            │   └── password_reset_success.html
            └── web/                    # Tera web page templates
```
