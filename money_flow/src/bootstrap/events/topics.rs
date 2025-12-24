/// Kafka topic definitions for the event-driven architecture
///
/// Topics are organized by domain:
/// - user.events: User lifecycle events (created, updated, deleted, activated)
/// - auth.events: Authentication events (sign_in, sign_out, password changes)
/// - transaction.events: Financial transaction events
/// - category.events: Category management events
/// - system.events: System-level events (health, metrics)

/// Main event topics
pub mod topic {
    /// User domain events (user.created, user.updated, user.deleted, user.activated)
    pub const USER_EVENTS: &str = "user.events";

    /// Authentication events (auth.sign_in, auth.sign_out, auth.password_reset)
    pub const AUTH_EVENTS: &str = "auth.events";

    /// Transaction events (transaction.created, transaction.updated, transaction.deleted)
    pub const TRANSACTION_EVENTS: &str = "transaction.events";

    /// Category events (category.created, category.updated, category.deleted)
    pub const CATEGORY_EVENTS: &str = "category.events";

    /// System events (health checks, metrics, errors)
    pub const SYSTEM_EVENTS: &str = "system.events";

    /// Dead letter topic for failed event processing
    pub const DEAD_LETTER: &str = "events.dead_letter";

    /// Get all topics for initialization
    pub fn all() -> Vec<&'static str> {
        vec![
            USER_EVENTS,
            AUTH_EVENTS,
            TRANSACTION_EVENTS,
            CATEGORY_EVENTS,
            SYSTEM_EVENTS,
            DEAD_LETTER,
        ]
    }
}

/// Consumer group IDs
pub mod consumer_groups {
    /// Main application consumer group
    pub const MAIN_APP: &str = "money-flow-main";

    /// Analytics consumer group (for building derived data)
    pub const ANALYTICS: &str = "money-flow-analytics";

    /// Notification consumer group (for sending notifications)
    pub const NOTIFICATIONS: &str = "money-flow-notifications";

    /// Audit log consumer group
    pub const AUDIT: &str = "money-flow-audit";
}
