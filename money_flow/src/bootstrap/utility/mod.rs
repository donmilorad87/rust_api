//! Utility module
//!
//! Static helper functions without special logic.

pub mod auth;
pub mod template;

pub use auth::*;
pub use template::{assets, asset, private_asset, assets_by_uuid, StorageUrls};
