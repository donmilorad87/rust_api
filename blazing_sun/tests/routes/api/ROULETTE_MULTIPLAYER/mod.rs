//! Multiplayer Roulette Tests
//!
//! # Test Organization
//!
//! - `bet_validation.rs` - Unit tests for bet validation logic
//! - `payout_calculation.rs` - Unit tests for payout calculations
//! - `multiplayer_state.rs` - Integration tests for multiplayer state endpoints
//!
//! # Test Coverage
//!
//! ## Unit Tests
//! - [x] Bet validation (all 12 bet types)
//! - [x] Payout calculations (winning/losing scenarios)
//! - [x] Balance deduction logic
//! - [x] Color/parity determination
//!
//! ## Integration Tests
//! - [x] GET /api/v1/roulette/multiplayer/state
//! - [x] GET /api/v1/roulette/multiplayer/spin-history
//! - [x] GET /api/v1/roulette/multiplayer/my-bets/{spin_id}

#[path = "bet_validation.rs"]
pub mod bet_validation;

#[path = "payout_calculation.rs"]
pub mod payout_calculation;

#[path = "multiplayer_state.rs"]
pub mod multiplayer_state;
