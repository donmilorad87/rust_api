use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::topics::topic;
use crate::events::types::{DomainEvent, EventType, UserEventType};
use async_trait::async_trait;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

/// Handler for user-related events
/// This handler can be used to:
/// - Update denormalized data
/// - Sync to external systems
/// - Trigger downstream processes
/// - Build audit logs
pub struct UserEventHandler {
    _db: Arc<Mutex<Pool<Postgres>>>,
}

impl UserEventHandler {
    pub fn new(db: Arc<Mutex<Pool<Postgres>>>) -> Self {
        Self { _db: db }
    }
}

#[async_trait]
impl EventHandler for UserEventHandler {
    fn name(&self) -> &'static str {
        "user_event_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::USER_EVENTS]
    }

    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        // Only handle user events
        let user_event_type = match &event.event_type {
            EventType::User(t) => t,
            _ => return Err(EventHandlerError::Skip),
        };

        match user_event_type {
            UserEventType::Created => self.handle_user_created(event).await,
            UserEventType::Updated => self.handle_user_updated(event).await,
            UserEventType::Deleted => self.handle_user_deleted(event).await,
            UserEventType::Activated => self.handle_user_activated(event).await,
            UserEventType::PasswordChanged => self.handle_password_changed(event).await,
            UserEventType::BalanceUpdated => self.handle_balance_updated(event).await,
            _ => {
                info!(
                    event_id = %event.id,
                    event_type = %event.event_type,
                    "User event type not handled"
                );
                Ok(())
            }
        }
    }
}

impl UserEventHandler {
    async fn handle_user_created(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        let email = event
            .payload
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        info!(
            event_id = %event.id,
            user_id = %event.entity_id,
            email = %email,
            "Processing user.created event"
        );

        // Example: Could sync to external CRM, analytics, etc.
        // Example: Could update user count metrics
        // Example: Could trigger welcome email (though that's better via RabbitMQ)

        Ok(())
    }

    async fn handle_user_updated(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        let fields_changed = event
            .payload
            .get("fields_changed")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_else(|| "unknown".to_string());

        info!(
            event_id = %event.id,
            user_id = %event.entity_id,
            fields_changed = %fields_changed,
            "Processing user.updated event"
        );

        // Example: Could update search indexes
        // Example: Could invalidate caches
        // Example: Could notify external systems

        Ok(())
    }

    async fn handle_user_deleted(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        info!(
            event_id = %event.id,
            user_id = %event.entity_id,
            "Processing user.deleted event"
        );

        // Example: Could clean up related data in other systems
        // Example: Could update analytics
        // Example: Could trigger GDPR compliance workflows

        Ok(())
    }

    async fn handle_user_activated(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        info!(
            event_id = %event.id,
            user_id = %event.entity_id,
            "Processing user.activated event"
        );

        // Example: Could send welcome email
        // Example: Could enable premium features
        // Example: Could notify sales team

        Ok(())
    }

    async fn handle_password_changed(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        info!(
            event_id = %event.id,
            user_id = %event.entity_id,
            "Processing user.password_changed event"
        );

        // Example: Could invalidate all sessions
        // Example: Could send security notification email
        // Example: Could log to security audit

        Ok(())
    }

    async fn handle_balance_updated(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        let new_balance = event
            .payload
            .get("balance")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        info!(
            event_id = %event.id,
            user_id = %event.entity_id,
            new_balance = %new_balance,
            "Processing user.balance_updated event"
        );

        // Example: Could check for low balance alerts
        // Example: Could update dashboard metrics
        // Example: Could trigger budget notifications

        Ok(())
    }
}

/// Handler for building audit logs from user events
pub struct UserAuditHandler {
    _db: Arc<Mutex<Pool<Postgres>>>,
}

impl UserAuditHandler {
    pub fn new(db: Arc<Mutex<Pool<Postgres>>>) -> Self {
        Self { _db: db }
    }

    async fn log_audit_entry(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        // In a real implementation, this would write to an audit_logs table
        info!(
            audit_event_id = %event.id,
            audit_event_type = %event.event_type,
            audit_entity_type = %event.entity_type,
            audit_entity_id = %event.entity_id,
            audit_actor_id = ?event.metadata.actor_id,
            audit_timestamp = %event.timestamp,
            "Audit log entry created"
        );

        Ok(())
    }
}

#[async_trait]
impl EventHandler for UserAuditHandler {
    fn name(&self) -> &'static str {
        "user_audit_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::USER_EVENTS, topic::AUTH_EVENTS]
    }

    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        self.log_audit_entry(event).await
    }
}
