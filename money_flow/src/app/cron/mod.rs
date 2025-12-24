//! Cron Job Functions
//!
//! This module contains all cron job implementations.
//! Jobs are registered in `routes/crons.rs` using the Schedule API.
//!
//! # Adding a new cron job
//!
//! 1. Create a new module in `app/cron/`
//! 2. Export it here
//! 3. Register it in `crons/mod.rs` using Schedule API

pub mod list_user_emails;
pub mod user_counter;
