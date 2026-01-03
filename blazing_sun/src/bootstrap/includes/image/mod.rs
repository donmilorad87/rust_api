//! Image Processing Module
//!
//! Provides server-side image resizing for responsive serving.

pub mod processor;

pub use processor::{
    generate_variants, is_supported_image, format_from_extension, ImageError, VariantInfo,
    BREAKPOINTS,
};
