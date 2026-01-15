/// Kafka topic definitions for the event-driven architecture
///
/// Topics are organized by domain:
/// - user.events: User lifecycle events (created, updated, deleted, activated)
/// - auth.events: Authentication events (sign_in, sign_out, password changes)
/// - transaction.events: Financial transaction events
/// - category.events: Category management events
/// - system.events: System-level events (health, metrics)
/// - checkout.commands: Checkout commands from main service
/// - checkout.events: Checkout events from payment service
/// - chat.commands: Chat commands from WebSocket gateway
/// - chat.events: Chat events to send to WebSocket gateway
/// - games.commands: Game commands from WebSocket gateway
/// - games.events: Game events to send to WebSocket gateway
/// - gateway.presence: Presence updates from WebSocket gateway

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

    /// Checkout commands from main service (create_session, etc.)
    pub const CHECKOUT_COMMANDS: &str = "checkout.commands";

    /// Checkout events from payment service (session_created, payment_succeeded, etc.)
    pub const CHECKOUT_EVENTS: &str = "checkout.events";

    /// New checkout request topic (user_id, amount_cents)
    pub const CHECKOUT: &str = "checkout";

    /// New checkout finished topic (success/failed status after Stripe webhook)
    pub const CHECKOUT_FINISHED: &str = "checkout_finished";

    // === WebSocket Gateway Topics ===

    /// Chat commands from WebSocket gateway (send_message, mark_read, etc.)
    pub const CHAT_COMMANDS: &str = "chat.commands";

    /// Chat events to send back to WebSocket gateway
    pub const CHAT_EVENTS: &str = "chat.events";

    /// Game commands from WebSocket gateway (create_room, join_room, roll_dice, etc.)
    pub const GAMES_COMMANDS: &str = "games.commands";

    /// Game events to send back to WebSocket gateway
    pub const GAMES_EVENTS: &str = "games.events";

    /// Presence updates from WebSocket gateway (user online/offline)
    pub const GATEWAY_PRESENCE: &str = "gateway.presence";

    /// Get all topics for initialization
    pub fn all() -> Vec<&'static str> {
        vec![
            USER_EVENTS,
            AUTH_EVENTS,
            TRANSACTION_EVENTS,
            CATEGORY_EVENTS,
            SYSTEM_EVENTS,
            DEAD_LETTER,
            CHECKOUT_COMMANDS,
            CHECKOUT_EVENTS,
            CHECKOUT,
            CHECKOUT_FINISHED,
            CHAT_COMMANDS,
            CHAT_EVENTS,
            GAMES_COMMANDS,
            GAMES_EVENTS,
            GATEWAY_PRESENCE,
        ]
    }
}

/// Consumer group IDs
pub mod consumer_groups {
    /// Main application consumer group
    pub const MAIN_APP: &str = "blazing-sun-main";

    /// Analytics consumer group (for building derived data)
    pub const ANALYTICS: &str = "blazing-sun-analytics";

    /// Notification consumer group (for sending notifications)
    pub const NOTIFICATIONS: &str = "blazing-sun-notifications";

    /// Audit log consumer group
    pub const AUDIT: &str = "blazing-sun-audit";
}
