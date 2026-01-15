//! Web Controllers
//!
//! Controllers that handle web requests and return HTML responses.

pub mod pages;

pub use pages::PagesController;
pub use pages::{render_oauth_consent, ConsentScopeInfo, OAuthConsentData};
