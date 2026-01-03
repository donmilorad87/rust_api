//! Integration Tests Entry Point
//!
//! # Test Organization Structure
//!
//! ```text
//! tests/
//! ├── integration.rs          # This file (main entry point)
//! └── routes/
//!     ├── mod.rs              # Route tests module
//!     ├── api/                # API endpoint tests
//!     │   ├── mod.rs
//!     │   ├── sign_in.rs      # Sign-in module entry
//!     │   └── SIGN_IN/        # Sign-in test implementations
//!     │       └── sign_in.rs
//!     └── web/                # Web page tests (Playwright MCP)
//!         └── mod.rs
//! ```
//!
//! # Running Tests
//!
//! ```bash
//! # Inside rust container
//! cargo test --test integration              # Run all integration tests
//! cargo test --test integration sign_in      # Run sign-in tests only
//! cargo test --test integration -- --nocapture  # Show output
//! ```
//!
//! # TDD Workflow
//!
//! 1. **RED** - Write failing test first
//! 2. **GREEN** - Implement minimal code to pass
//! 3. **REFACTOR** - Clean up while tests pass

#[path = "routes/mod.rs"]
mod routes;
