# Adding New Features

## New API Endpoint

1. Create handler in `app/http/api/controllers/<name>.rs`
2. Add request validator in `app/http/api/validators/<name>.rs` (if needed)
3. Register route in `routes/api.rs`
4. Add database queries in `app/db_query/read/` or `mutations/`
5. Publish Kafka event on success
6. Run `cargo sqlx prepare` if queries changed

## New Kafka Event Type

1. Add variant to `EventType` enum in `bootstrap/events/types.rs`
2. Add payload struct if needed
3. Add helper function in `bootstrap/events/mod.rs::publish`
4. Create handler in `bootstrap/events/handlers/` if needed
5. Register handler in `bootstrap/events/handlers/mod.rs::create_handlers()`

## New RabbitMQ Job

1. Create params struct in `app/mq/jobs/<job_name>/mod.rs`
2. Create worker in `app/mq/workers/<job_name>/mod.rs`
3. Add to match statement in `app/mq/workers/mod.rs::process_job()`

## New Email Template

1. Create template in `resources/views/emails/<name>.html`
2. Add variant to `EmailTemplate` enum in `app/mq/jobs/email/mod.rs`
3. Implement `template_path()` and `subject()` for the variant

## New Database Table

1. Create migration: `sqlx migrate add <name>`
2. Add read queries in `app/db_query/read/<entity>/mod.rs`
3. Add mutations in `app/db_query/mutations/<entity>/mod.rs`
4. Run `cargo sqlx prepare`

## New Cron Job

1. Create job in `app/cron/<job_name>.rs`
2. Register in `routes/crons.rs`
