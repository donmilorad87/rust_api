//! Roulette Tick Producer
//!
//! Background task that produces tick events for the multiplayer roulette game.
//! Sends a tick every second to the `roulette.ticks` Kafka topic with countdown info.

use crate::app::games::roulette_types::{RouletteTick, CYCLE_DURATION_SECONDS};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{error, info};
use uuid::Uuid;

/// Start the roulette tick producer background task
pub fn start_tick_producer(producer: Arc<EventProducer>) {
    info!("Starting roulette tick producer...");

    tokio::spawn(async move {
        run_tick_loop(producer).await;
    });
}

/// Main tick loop - runs forever producing ticks every second
async fn run_tick_loop(producer: Arc<EventProducer>) {
    let mut tick_interval = interval(Duration::from_secs(1));
    let mut spin_id = Uuid::new_v4().to_string();
    let mut seconds_remaining = CYCLE_DURATION_SECONDS;

    info!(spin_id = %spin_id, "Roulette tick producer started, first spin cycle beginning");

    loop {
        tick_interval.tick().await;

        // Create tick event
        let tick = RouletteTick::new(&spin_id, seconds_remaining);

        // Serialize and send to Kafka
        match serde_json::to_vec(&tick) {
            Ok(payload) => {
                if let Err(e) = producer.send_raw(topic::ROULETTE_TICKS, Some(&spin_id), &payload).await {
                    error!(spin_id = %spin_id, error = %e, "Failed to send roulette tick");
                }
            }
            Err(e) => {
                error!(error = %e, "Failed to serialize roulette tick");
            }
        }

        // Decrement countdown
        if seconds_remaining > 0 {
            seconds_remaining -= 1;
        } else {
            // Cycle complete, start new spin
            spin_id = Uuid::new_v4().to_string();
            seconds_remaining = CYCLE_DURATION_SECONDS;
            info!(spin_id = %spin_id, "New roulette spin cycle started");
        }
    }
}
