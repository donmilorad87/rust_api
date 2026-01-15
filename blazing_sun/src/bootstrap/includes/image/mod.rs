//! Image Processing Module
//!
//! Provides server-side image resizing for responsive serving.

pub mod processor;

pub use processor::{
    format_from_extension, generate_variants, is_supported_image, ImageError, VariantInfo,
    BREAKPOINTS,
};
