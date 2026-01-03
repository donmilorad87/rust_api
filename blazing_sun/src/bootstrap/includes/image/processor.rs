//! Image Processing Module
//!
//! Handles server-side image resizing for responsive serving.
//!
//! Supported formats: JPEG, PNG, WebP, AVIF
//! Default breakpoints: thumb (100px), small (320px), medium (768px), large (1280px), full (original)

use image::{imageops::FilterType, ImageFormat};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ImageError {
    #[error("Failed to open image: {0}")]
    OpenError(#[from] image::ImageError),

    #[error("Failed to save image: {0}")]
    SaveError(String),

    #[error("Unsupported image format: {0}")]
    UnsupportedFormat(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Image variant breakpoint definition
#[derive(Debug, Clone)]
pub struct VariantBreakpoint {
    pub name: &'static str,
    pub max_dimension: u32,
}

/// Default responsive breakpoints
pub const BREAKPOINTS: &[VariantBreakpoint] = &[
    VariantBreakpoint {
        name: "thumb",
        max_dimension: 100,
    },
    VariantBreakpoint {
        name: "small",
        max_dimension: 320,
    },
    VariantBreakpoint {
        name: "medium",
        max_dimension: 768,
    },
    VariantBreakpoint {
        name: "large",
        max_dimension: 1280,
    },
];

/// Information about a generated image variant
#[derive(Debug, Clone)]
pub struct VariantInfo {
    pub variant_name: String,
    pub width: u32,
    pub height: u32,
    pub size_bytes: u64,
    pub path: PathBuf,
}

/// Check if the file extension is a supported image format
pub fn is_supported_image(extension: &str) -> bool {
    matches!(
        extension.to_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "avif"
    )
}

/// Determine ImageFormat from file extension
pub fn format_from_extension(extension: &str) -> Result<ImageFormat, ImageError> {
    match extension.to_lowercase().as_str() {
        "jpg" | "jpeg" => Ok(ImageFormat::Jpeg),
        "png" => Ok(ImageFormat::Png),
        "webp" => Ok(ImageFormat::WebP),
        "avif" => Ok(ImageFormat::Avif),
        _ => Err(ImageError::UnsupportedFormat(extension.to_string())),
    }
}

/// Generate all responsive variants for an image
///
/// # Arguments
/// * `source_path` - Path to the original image file
/// * `output_dir` - Directory where variants will be saved
/// * `base_filename` - Base filename (without extension) for variants
/// * `extension` - File extension (e.g., "jpg", "png")
///
/// # Returns
/// Vector of VariantInfo for each generated variant (including "full")
pub async fn generate_variants(
    source_path: &Path,
    output_dir: &Path,
    base_filename: &str,
    extension: &str,
) -> Result<Vec<VariantInfo>, ImageError> {
    // Validate format
    let format = format_from_extension(extension)?;

    // Log the exact path being opened
    tracing::info!("Opening image at path: {:?}", source_path);
    tracing::info!("Path exists: {}", source_path.exists());
    tracing::info!("Current working directory: {:?}", std::env::current_dir());

    // Open original image
    let img = image::open(source_path)?;
    let original_width = img.width();
    let original_height = img.height();
    let original_max_dim = std::cmp::max(original_width, original_height);

    let mut variants = Vec::new();

    // Generate each breakpoint variant
    for breakpoint in BREAKPOINTS {
        let variant_name = breakpoint.name;
        let max_dim = breakpoint.max_dimension;

        // Don't upscale: if original is smaller than breakpoint, use original size
        let target_max_dim = if original_max_dim <= max_dim {
            original_max_dim
        } else {
            max_dim
        };

        // Calculate new dimensions while preserving aspect ratio
        let (new_width, new_height) = if original_width >= original_height {
            // Landscape or square
            let ratio = target_max_dim as f32 / original_width as f32;
            (target_max_dim, (original_height as f32 * ratio) as u32)
        } else {
            // Portrait
            let ratio = target_max_dim as f32 / original_height as f32;
            ((original_width as f32 * ratio) as u32, target_max_dim)
        };

        // Resize image
        let resized = img.resize(new_width, new_height, FilterType::Lanczos3);

        // Generate output path: basefilename_variant.ext (e.g., "image_thumb.jpg")
        let output_filename = format!("{}_{}.{}", base_filename, variant_name, extension);
        let output_path = output_dir.join(&output_filename);

        // Save resized image
        resized
            .save_with_format(&output_path, format)
            .map_err(|e| ImageError::SaveError(e.to_string()))?;

        // Get file size
        let metadata = std::fs::metadata(&output_path)?;
        let size_bytes = metadata.len();

        variants.push(VariantInfo {
            variant_name: variant_name.to_string(),
            width: new_width,
            height: new_height,
            size_bytes,
            path: output_path,
        });
    }

    // Add "full" variant (copy of original)
    let full_filename = format!("{}_{}.{}", base_filename, "full", extension);
    let full_path = output_dir.join(&full_filename);
    std::fs::copy(source_path, &full_path)?;

    let full_metadata = std::fs::metadata(&full_path)?;
    variants.push(VariantInfo {
        variant_name: "full".to_string(),
        width: original_width,
        height: original_height,
        size_bytes: full_metadata.len(),
        path: full_path,
    });

    Ok(variants)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_supported_image() {
        assert!(is_supported_image("jpg"));
        assert!(is_supported_image("JPG"));
        assert!(is_supported_image("jpeg"));
        assert!(is_supported_image("png"));
        assert!(is_supported_image("webp"));
        assert!(is_supported_image("avif"));

        assert!(!is_supported_image("gif"));
        assert!(!is_supported_image("mp4"));
        assert!(!is_supported_image("pdf"));
    }

    #[test]
    fn test_format_from_extension() {
        assert!(format_from_extension("jpg").is_ok());
        assert!(format_from_extension("png").is_ok());
        assert!(format_from_extension("webp").is_ok());
        assert!(format_from_extension("avif").is_ok());
        assert!(format_from_extension("gif").is_err());
    }
}
