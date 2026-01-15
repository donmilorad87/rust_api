//! Utility module
//!
//! Static helper functions without special logic.

pub mod assets;
pub mod auth;
pub mod csrf;
pub mod oauth_jwt;
pub mod template;

pub use auth::*;
pub use template::{
    asset,
    asset_by_id,    // NEW: Unified ID-based asset function (async)
    asset_by_id_or, // NEW: ID-based with fallback
    assets,
    assets_by_uuid,
    private_asset,
    StorageUrls,
};
