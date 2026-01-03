//! Utility module
//!
//! Static helper functions without special logic.

pub mod assets;
pub mod auth;
pub mod template;

pub use auth::*;
pub use template::{
    assets,
    asset,
    private_asset,
    assets_by_uuid,
    asset_by_id,        // NEW: Unified ID-based asset function (async)
    asset_by_id_or,     // NEW: ID-based with fallback
    StorageUrls
};
