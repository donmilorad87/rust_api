# Module Details

## `main.rs` - Entry Point

```rust
// Initialization sequence:
1. tracing_logger::init()           // Initialize logging
2. crons::register(pool)            // Start cron scheduler
3. mq::init(pool)                   // Connect to RabbitMQ
4. mq::start_processor(queue, 4)    // Start 4 worker threads
5. events::init(pool)               // Connect to Kafka
6. events::start_consumer(consumer) // Start event consumer
7. HttpServer::new()                // Start HTTP server
```

## `lib.rs` - Module Exports

```rust
pub mod app;        // Application layer (http, db_query, cron, mq)
pub mod bootstrap;  // Core framework (database, events, middleware, routes, utility)
pub mod config;     // Configuration
pub mod routes;     // Route definitions

// Re-exports for convenience
pub use bootstrap::database;
pub use bootstrap::middleware::controllers::json_error_handler;
```
