//! Theme Configuration
//!
//! Configuration for the theme service that manages SCSS variables and CSS custom properties.

use once_cell::sync::Lazy;
use std::path::PathBuf;

pub struct ThemeConfig {
    /// Path to the GLOBAL Vite project folder
    pub global_page_path: PathBuf,
    /// Path to _variables.scss file
    pub variables_file: PathBuf,
    /// Path to _theme.scss file
    pub theme_file: PathBuf,
    /// Path to .env file (for ASSETS_VERSION)
    pub env_file: PathBuf,
    /// Build timeout in seconds
    pub build_timeout_secs: u64,
    /// Backup directory for rollback
    pub backup_path: PathBuf,
    /// Allowed SCSS variable names (whitelist)
    pub allowed_scss_variables: Vec<String>,
    /// Allowed CSS custom property names (whitelist)
    pub allowed_css_properties: Vec<String>,
}

pub static THEME: Lazy<ThemeConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    // Get the project root (CARGO_MANIFEST_DIR at compile time)
    let project_root = std::env::var("THEME_PROJECT_ROOT")
        .unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR")).to_string());

    let global_page_path = PathBuf::from(&project_root).join("src/frontend/pages/GLOBAL");

    let variables_file = global_page_path.join("src/styles/_variables.scss");

    let theme_file = global_page_path.join("src/styles/_theme.scss");

    let env_file = PathBuf::from(&project_root).join(".env");

    let backup_path = PathBuf::from(&project_root).join("storage/app/private/theme_backups");

    // SCSS variables whitelist - only these can be modified
    let allowed_scss_variables = vec![
        // Identity/Branding
        "identity_color_start".to_string(),
        "identity_color_end".to_string(),
        "identity_size".to_string(),
        // Colors
        "color_primary".to_string(),
        "color_primary_dark".to_string(),
        "color_secondary".to_string(),
        // Typography
        "font_size_base".to_string(),
        "font_size_sm".to_string(),
        "font_size_lg".to_string(),
        "font_size_xl".to_string(),
        // Spacing
        "spacing_xs".to_string(),
        "spacing_sm".to_string(),
        "spacing_md".to_string(),
        "spacing_lg".to_string(),
        "spacing_xl".to_string(),
        // Border Radius
        "radius_sm".to_string(),
        "radius_md".to_string(),
        "radius_lg".to_string(),
    ];

    // CSS custom properties whitelist - only these can be modified
    // Must match properties in _theme.scss that can be configured via admin panel
    let allowed_css_properties = vec![
        // Background Gradient
        "bg_gradient_start".to_string(),
        "bg_gradient_end".to_string(),
        "bg_gradient_angle".to_string(),
        // Navigation
        "nav_bg".to_string(),
        "nav_shadow".to_string(),
        "nav_text".to_string(),
        "nav_text_hover".to_string(),
        "nav_border".to_string(),
        // Text
        "text_primary".to_string(),
        "text_secondary".to_string(),
        "text_muted".to_string(),
        "text_on_primary".to_string(),
        "text_on_dark".to_string(),
        "text_disabled".to_string(),
        "text_placeholder".to_string(),
        // Headings
        "heading_h1_color".to_string(),
        "heading_h2_color".to_string(),
        "heading_h3_color".to_string(),
        "heading_h4_color".to_string(),
        "heading_h5_color".to_string(),
        // Paragraph & Inline
        "paragraph_color".to_string(),
        "link_color".to_string(),
        "link_hover_color".to_string(),
        "span_color".to_string(),
        "address_color".to_string(),
        "time_color".to_string(),
        // Cards/Surfaces
        "card_bg".to_string(),
        "card_shadow".to_string(),
        "card_border".to_string(),
        "feature_card_bg".to_string(),
        "feature_card_shadow".to_string(),
        // Forms
        "input_bg".to_string(),
        "input_border".to_string(),
        "input_border_focus".to_string(),
        "input_text".to_string(),
        "input_placeholder".to_string(),
        "input_disabled_bg".to_string(),
        // Toggle/Switch
        "toggle_bg".to_string(),
        "toggle_border".to_string(),
        "toggle_active_bg".to_string(),
        // Semantic Colors
        "color_success".to_string(),
        "color_success_light".to_string(),
        "color_success_dark".to_string(),
        "color_warning".to_string(),
        "color_warning_light".to_string(),
        "color_warning_dark".to_string(),
        "color_error".to_string(),
        "color_error_light".to_string(),
        "color_error_dark".to_string(),
        "color_info".to_string(),
        "color_info_light".to_string(),
        "color_info_dark".to_string(),
        // Accent/Brand
        "color_accent".to_string(),
        "color_accent_light".to_string(),
        "color_accent_dark".to_string(),
        // Borders
        "border_color".to_string(),
        "border_color_light".to_string(),
        "border_color_dark".to_string(),
        // Footer
        "footer_bg".to_string(),
        "footer_text".to_string(),
        "footer_link".to_string(),
        "footer_link_hover".to_string(),
        "footer_border".to_string(),
        // Bottom Bar
        "bottom_bar_bg".to_string(),
        "bottom_bar_text".to_string(),
        "bottom_bar_link".to_string(),
        "bottom_bar_link_hover".to_string(),
        // Scrollbar
        "scrollbar_track".to_string(),
        "scrollbar_thumb".to_string(),
        "scrollbar_thumb_hover".to_string(),
        // Code/Pre
        "code_bg".to_string(),
        "code_text".to_string(),
        "pre_bg".to_string(),
        "pre_text".to_string(),
        // Table
        "table_header_bg".to_string(),
        "table_header_text".to_string(),
        "table_row_bg".to_string(),
        "table_row_alt_bg".to_string(),
        "table_border".to_string(),
        // Dropdown
        "dropdown_bg".to_string(),
        "dropdown_border".to_string(),
        "dropdown_item_hover_bg".to_string(),
        // Modal
        "modal_backdrop".to_string(),
        "modal_bg".to_string(),
        "modal_border".to_string(),
        // Tooltip
        "tooltip_bg".to_string(),
        "tooltip_text".to_string(),
        // Badge
        "badge_default_bg".to_string(),
        "badge_default_text".to_string(),
        "badge_primary_bg".to_string(),
        "badge_primary_text".to_string(),
        "badge_success_bg".to_string(),
        "badge_success_text".to_string(),
        "badge_warning_bg".to_string(),
        "badge_warning_text".to_string(),
        "badge_danger_bg".to_string(),
        "badge_danger_text".to_string(),
        // Skeleton/Loading
        "skeleton_bg".to_string(),
        "skeleton_shine".to_string(),
        // Selection
        "selection_bg".to_string(),
        "selection_text".to_string(),
        // Focus Ring
        "focus_ring".to_string(),
        "focus_ring_offset".to_string(),
    ];

    ThemeConfig {
        global_page_path,
        variables_file,
        theme_file,
        env_file,
        build_timeout_secs: std::env::var("THEME_BUILD_TIMEOUT")
            .unwrap_or_else(|_| "60".to_string())
            .parse()
            .expect("THEME_BUILD_TIMEOUT must be a valid number"),
        backup_path,
        allowed_scss_variables,
        allowed_css_properties,
    }
});

impl ThemeConfig {
    /// Path to the GLOBAL Vite project folder
    pub fn global_page_path() -> &'static PathBuf {
        &THEME.global_page_path
    }

    /// Path to _variables.scss file
    pub fn variables_file() -> &'static PathBuf {
        &THEME.variables_file
    }

    /// Path to _theme.scss file
    pub fn theme_file() -> &'static PathBuf {
        &THEME.theme_file
    }

    /// Path to .env file
    pub fn env_file() -> &'static PathBuf {
        &THEME.env_file
    }

    /// Build timeout in seconds
    pub fn build_timeout_secs() -> u64 {
        THEME.build_timeout_secs
    }

    /// Backup directory path
    pub fn backup_path() -> &'static PathBuf {
        &THEME.backup_path
    }

    /// Allowed SCSS variable names
    pub fn allowed_scss_variables() -> &'static Vec<String> {
        &THEME.allowed_scss_variables
    }

    /// Allowed CSS custom property names
    pub fn allowed_css_properties() -> &'static Vec<String> {
        &THEME.allowed_css_properties
    }

    /// Check if an SCSS variable name is allowed
    /// Accepts both hyphen and underscore formats (normalizes to underscore)
    pub fn is_scss_variable_allowed(name: &str) -> bool {
        // Normalize hyphen to underscore for comparison
        let normalized = name.replace('-', "_");
        THEME.allowed_scss_variables.contains(&normalized)
    }

    /// Check if a CSS property name is allowed
    /// Accepts both hyphen and underscore formats (normalizes to underscore)
    pub fn is_css_property_allowed(name: &str) -> bool {
        // Normalize hyphen to underscore for comparison
        let normalized = name.replace('-', "_");
        THEME.allowed_css_properties.contains(&normalized)
    }

    /// Get all configuration as a reference (for testing)
    pub fn get() -> &'static ThemeConfig {
        &THEME
    }
}
