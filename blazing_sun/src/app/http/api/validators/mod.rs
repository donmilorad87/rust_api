//! HTTP Validators
//!
//! Validators handle request data validation before it reaches controllers.
//! Each validator module corresponds to a feature/resource.

pub mod auth;
pub mod balance;
pub mod store_category;
pub mod store_product;
pub mod user;

// Re-export common validators
pub use auth::{
    validate_password, SigninRequest, SigninRequestRaw, SignupRequest, SignupRequestRaw,
};
pub use balance::{BalanceCheckoutRequest, BalanceCheckoutRequestRaw};
pub use store_category::{
    CreateStoreCategoryRequest, ReorderCategoriesRequest, UpdateStoreCategoryRequest,
};
pub use store_product::{
    AdminGalleriesQuery, AdminListProductsQuery, CreateStoreProductRequest,
    FeaturedProductsQuery, ListProductsQuery, TagsQuery, UpdateStoreProductRequest,
};
pub use user::{PatchUserRequest, PatchUserRequestRaw, PutUserRequest};
