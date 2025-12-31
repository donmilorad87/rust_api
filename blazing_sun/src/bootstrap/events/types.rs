use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;
use uuid::Uuid;

/// Event types for the User domain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserEventType {
    Created,
    Updated,
    Deleted,
    Activated,
    Deactivated,
    PasswordChanged,
    ProfileUpdated,
    BalanceUpdated,
}

impl fmt::Display for UserEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            UserEventType::Created => "user.created",
            UserEventType::Updated => "user.updated",
            UserEventType::Deleted => "user.deleted",
            UserEventType::Activated => "user.activated",
            UserEventType::Deactivated => "user.deactivated",
            UserEventType::PasswordChanged => "user.password_changed",
            UserEventType::ProfileUpdated => "user.profile_updated",
            UserEventType::BalanceUpdated => "user.balance_updated",
        };
        write!(f, "{}", s)
    }
}

/// Event types for Authentication domain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthEventType {
    SignIn,
    SignOut,
    SignInFailed,
    PasswordResetRequested,
    PasswordResetCompleted,
    AccountLocked,
    AccountUnlocked,
}

impl fmt::Display for AuthEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            AuthEventType::SignIn => "auth.sign_in",
            AuthEventType::SignOut => "auth.sign_out",
            AuthEventType::SignInFailed => "auth.sign_in_failed",
            AuthEventType::PasswordResetRequested => "auth.password_reset_requested",
            AuthEventType::PasswordResetCompleted => "auth.password_reset_completed",
            AuthEventType::AccountLocked => "auth.account_locked",
            AuthEventType::AccountUnlocked => "auth.account_unlocked",
        };
        write!(f, "{}", s)
    }
}

/// Event types for Transaction domain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransactionEventType {
    Created,
    Updated,
    Deleted,
    Categorized,
    AmountAdjusted,
}

impl fmt::Display for TransactionEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            TransactionEventType::Created => "transaction.created",
            TransactionEventType::Updated => "transaction.updated",
            TransactionEventType::Deleted => "transaction.deleted",
            TransactionEventType::Categorized => "transaction.categorized",
            TransactionEventType::AmountAdjusted => "transaction.amount_adjusted",
        };
        write!(f, "{}", s)
    }
}

/// Event types for Category domain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CategoryEventType {
    Created,
    Updated,
    Deleted,
    BalanceRecalculated,
}

impl fmt::Display for CategoryEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            CategoryEventType::Created => "category.created",
            CategoryEventType::Updated => "category.updated",
            CategoryEventType::Deleted => "category.deleted",
            CategoryEventType::BalanceRecalculated => "category.balance_recalculated",
        };
        write!(f, "{}", s)
    }
}

/// Event types for System domain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SystemEventType {
    HealthCheck,
    Error,
    Warning,
    ServiceStarted,
    ServiceStopped,
}

impl fmt::Display for SystemEventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            SystemEventType::HealthCheck => "system.health_check",
            SystemEventType::Error => "system.error",
            SystemEventType::Warning => "system.warning",
            SystemEventType::ServiceStarted => "system.service_started",
            SystemEventType::ServiceStopped => "system.service_stopped",
        };
        write!(f, "{}", s)
    }
}

/// Unified event type enum for all domains
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "domain", content = "type")]
pub enum EventType {
    User(UserEventType),
    Auth(AuthEventType),
    Transaction(TransactionEventType),
    Category(CategoryEventType),
    System(SystemEventType),
}

impl fmt::Display for EventType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EventType::User(t) => write!(f, "{}", t),
            EventType::Auth(t) => write!(f, "{}", t),
            EventType::Transaction(t) => write!(f, "{}", t),
            EventType::Category(t) => write!(f, "{}", t),
            EventType::System(t) => write!(f, "{}", t),
        }
    }
}

impl EventType {
    /// Get the topic name for this event type
    pub fn topic(&self) -> &'static str {
        use super::topics::topic;
        match self {
            EventType::User(_) => topic::USER_EVENTS,
            EventType::Auth(_) => topic::AUTH_EVENTS,
            EventType::Transaction(_) => topic::TRANSACTION_EVENTS,
            EventType::Category(_) => topic::CATEGORY_EVENTS,
            EventType::System(_) => topic::SYSTEM_EVENTS,
        }
    }

    /// Get the entity type name
    pub fn entity_type(&self) -> &'static str {
        match self {
            EventType::User(_) => "user",
            EventType::Auth(_) => "auth",
            EventType::Transaction(_) => "transaction",
            EventType::Category(_) => "category",
            EventType::System(_) => "system",
        }
    }
}

/// Metadata for event tracing and debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMetadata {
    /// Correlation ID for tracing related events across services
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,

    /// ID of the event that caused this event (event chain)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub causation_id: Option<String>,

    /// User ID who triggered the event (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_id: Option<i64>,

    /// Source service/module that generated the event
    pub source: String,

    /// IP address of the request (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,

    /// User agent string (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,

    /// Request ID for HTTP request tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,

    /// Schema version for payload compatibility
    pub schema_version: String,
}

impl Default for EventMetadata {
    fn default() -> Self {
        Self {
            correlation_id: None,
            causation_id: None,
            actor_id: None,
            source: "blazing-sun-api".to_string(),
            ip_address: None,
            user_agent: None,
            request_id: None,
            schema_version: "1.0".to_string(),
        }
    }
}

impl EventMetadata {
    pub fn new(source: &str) -> Self {
        Self {
            source: source.to_string(),
            ..Default::default()
        }
    }

    pub fn with_actor(mut self, actor_id: i64) -> Self {
        self.actor_id = Some(actor_id);
        self
    }

    pub fn with_correlation_id(mut self, correlation_id: &str) -> Self {
        self.correlation_id = Some(correlation_id.to_string());
        self
    }

    pub fn with_causation_id(mut self, causation_id: &str) -> Self {
        self.causation_id = Some(causation_id.to_string());
        self
    }

    pub fn with_request_context(
        mut self,
        request_id: Option<String>,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> Self {
        self.request_id = request_id;
        self.ip_address = ip_address;
        self.user_agent = user_agent;
        self
    }
}

/// The main domain event structure
/// This is what gets published to Kafka
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    /// Unique identifier for this event
    pub id: String,

    /// Type of event
    pub event_type: EventType,

    /// Entity type (user, transaction, etc.)
    pub entity_type: String,

    /// ID of the affected entity
    pub entity_id: String,

    /// Event payload (flexible JSON structure)
    pub payload: Value,

    /// Event metadata for tracing
    pub metadata: EventMetadata,

    /// Unix timestamp in milliseconds when the event occurred
    pub timestamp: i64,

    /// Version number for optimistic locking / ordering
    pub version: i64,
}

impl DomainEvent {
    /// Create a new domain event
    pub fn new(event_type: EventType, entity_id: &str, payload: Value) -> Self {
        let entity_type = event_type.entity_type().to_string();
        Self {
            id: Uuid::new_v4().to_string(),
            event_type,
            entity_type,
            entity_id: entity_id.to_string(),
            payload,
            metadata: EventMetadata::default(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            version: 1,
        }
    }

    /// Create event with custom metadata
    pub fn with_metadata(mut self, metadata: EventMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    /// Set the version number
    pub fn with_version(mut self, version: i64) -> Self {
        self.version = version;
        self
    }

    /// Get the topic for this event
    pub fn topic(&self) -> &'static str {
        self.event_type.topic()
    }

    /// Get the partition key (entity_id is used for ordering)
    pub fn partition_key(&self) -> &str {
        &self.entity_id
    }

    /// Serialize to JSON bytes for Kafka
    pub fn to_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Deserialize from JSON bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }
}

/// Builder for creating domain events with a fluent API
pub struct EventBuilder {
    event_type: EventType,
    entity_id: String,
    payload: Value,
    metadata: EventMetadata,
    version: i64,
}

impl EventBuilder {
    pub fn new(event_type: EventType, entity_id: &str) -> Self {
        Self {
            event_type,
            entity_id: entity_id.to_string(),
            payload: Value::Null,
            metadata: EventMetadata::default(),
            version: 1,
        }
    }

    pub fn payload<T: Serialize>(mut self, payload: T) -> Self {
        self.payload = serde_json::to_value(payload).unwrap_or(Value::Null);
        self
    }

    pub fn metadata(mut self, metadata: EventMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    pub fn actor(mut self, actor_id: i64) -> Self {
        self.metadata.actor_id = Some(actor_id);
        self
    }

    pub fn correlation_id(mut self, id: &str) -> Self {
        self.metadata.correlation_id = Some(id.to_string());
        self
    }

    pub fn version(mut self, version: i64) -> Self {
        self.version = version;
        self
    }

    pub fn build(self) -> DomainEvent {
        DomainEvent::new(self.event_type, &self.entity_id, self.payload)
            .with_metadata(self.metadata)
            .with_version(self.version)
    }
}

/// Convenience type aliases for common event payloads
pub mod payloads {
    use serde::{Deserialize, Serialize};

    /// Payload for user created event
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct UserCreatedPayload {
        pub email: String,
        pub first_name: String,
        pub last_name: String,
        pub activated: bool,
    }

    /// Payload for user updated event
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct UserUpdatedPayload {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub first_name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub last_name: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub balance: Option<i64>,
        pub fields_changed: Vec<String>,
    }

    /// Payload for user deleted event
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct UserDeletedPayload {
        pub email: String,
        pub reason: Option<String>,
    }

    /// Payload for auth sign in event
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AuthSignInPayload {
        pub email: String,
        pub success: bool,
        pub failure_reason: Option<String>,
    }

    /// Payload for transaction created event
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TransactionCreatedPayload {
        pub user_id: i64,
        pub category_id: i64,
        pub amount: i64,
        pub transaction_type: String, // "income" or "expense"
        pub memo: Option<String>,
    }

    /// Payload for category created event
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CategoryCreatedPayload {
        pub user_id: i64,
        pub name: String,
        pub description: Option<String>,
    }
}
