//! Theme Service
//!
//! Manages theme configuration including SCSS variables, CSS custom properties,
//! file updates, builds, and version management.

pub mod builder;
pub mod parser;
pub mod updater;
pub mod versioner;

pub use builder::{BuildResult, BuilderError};
pub use parser::ParserError;
pub use updater::{Backup, UpdaterError};
pub use versioner::VersionerError;

use crate::config::ThemeConfig;
use serde_json::Value;

/// Error type for theme service operations
#[derive(Debug, thiserror::Error)]
pub enum ThemeServiceError {
    #[error("Parser error: {0}")]
    Parser(#[from] ParserError),
    #[error("Updater error: {0}")]
    Updater(#[from] UpdaterError),
    #[error("Builder error: {0}")]
    Builder(#[from] BuilderError),
    #[error("Versioner error: {0}")]
    Versioner(#[from] VersionerError),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Rollback triggered: {0}")]
    RollbackTriggered(String),
}

/// Result of a theme update operation
#[derive(Debug)]
pub struct ThemeUpdateResult {
    pub success: bool,
    pub new_version: Option<String>,
    pub build_output: Option<BuildResult>,
    pub error: Option<String>,
}

/// Theme Service - main coordinator for theme operations
pub struct ThemeService;

impl ThemeService {
    /// Get current theme variables from SCSS files
    pub fn get_current_variables() -> Result<(Value, Value, Value), ThemeServiceError> {
        let variables_path = ThemeConfig::variables_file();
        let theme_path = ThemeConfig::theme_file();

        // Parse SCSS variables
        let scss_vars = parser::parse_scss_variables(variables_path)?;
        let scss_json = parser::variables_to_json(&scss_vars);

        // Parse theme file
        let (light, dark) = parser::parse_theme_file(theme_path)?;
        let light_json = parser::variables_to_json(&light);
        let dark_json = parser::variables_to_json(&dark);

        Ok((scss_json, light_json, dark_json))
    }

    /// Validate that all variable names are in the whitelist
    pub fn validate_variables(
        scss_variables: Option<&Value>,
        theme_light: Option<&Value>,
        theme_dark: Option<&Value>,
    ) -> Result<(), ThemeServiceError> {
        // Validate SCSS variables
        if let Some(scss) = scss_variables {
            if let Some(obj) = scss.as_object() {
                for key in obj.keys() {
                    if !ThemeConfig::is_scss_variable_allowed(key) {
                        return Err(ThemeServiceError::Validation(format!(
                            "SCSS variable '{}' is not allowed",
                            key
                        )));
                    }
                }
            }
        }

        // Validate light theme
        if let Some(light) = theme_light {
            if let Some(obj) = light.as_object() {
                for key in obj.keys() {
                    if !ThemeConfig::is_css_property_allowed(key) {
                        return Err(ThemeServiceError::Validation(format!(
                            "CSS property '{}' is not allowed in light theme",
                            key
                        )));
                    }
                }
            }
        }

        // Validate dark theme
        if let Some(dark) = theme_dark {
            if let Some(obj) = dark.as_object() {
                for key in obj.keys() {
                    if !ThemeConfig::is_css_property_allowed(key) {
                        return Err(ThemeServiceError::Validation(format!(
                            "CSS property '{}' is not allowed in dark theme",
                            key
                        )));
                    }
                }
            }
        }

        Ok(())
    }

    /// Update theme files and rebuild
    /// This is the main entry point for theme updates
    pub async fn update_and_build(
        scss_variables: Option<Value>,
        theme_light: Option<Value>,
        theme_dark: Option<Value>,
    ) -> Result<ThemeUpdateResult, ThemeServiceError> {
        tracing::info!("=== ThemeService::update_and_build STARTED ===");
        tracing::info!("scss_variables: {:?}", scss_variables.is_some());
        tracing::info!("theme_light: {:?}", theme_light);
        tracing::info!("theme_dark: {:?}", theme_dark);

        // 1. Validate variables
        tracing::info!("Step 1: Validating variables...");
        Self::validate_variables(
            scss_variables.as_ref(),
            theme_light.as_ref(),
            theme_dark.as_ref(),
        )?;
        tracing::info!("Validation passed");

        let variables_path = ThemeConfig::variables_file();
        let theme_path = ThemeConfig::theme_file();
        let env_path = ThemeConfig::env_file();
        let backup_path = ThemeConfig::backup_path();

        tracing::info!("File paths:");
        tracing::info!("  variables_path: {:?}", variables_path);
        tracing::info!("  theme_path: {:?}", theme_path);
        tracing::info!("  env_path: {:?}", env_path);
        tracing::info!("  backup_path: {:?}", backup_path);

        // 2. Create backups
        tracing::info!("Step 2: Creating backups...");
        let mut backup = Backup::new(backup_path);
        backup.create(Some(variables_path), Some(theme_path), Some(env_path))?;
        tracing::info!("Backups created successfully");

        // 3. Update SCSS variables if provided
        tracing::info!("Step 3: Checking SCSS variables...");
        if let Some(scss) = &scss_variables {
            let vars = parser::json_to_variables(scss);
            if let Err(e) = updater::update_scss_variables(variables_path, &vars) {
                // Rollback on error
                let _ = backup.rollback(Some(variables_path), Some(theme_path), Some(env_path));
                return Err(ThemeServiceError::RollbackTriggered(format!(
                    "Failed to update SCSS variables: {}",
                    e
                )));
            }
        }

        // 4. Update theme file if provided
        tracing::info!("Step 4: Checking theme file update...");
        tracing::info!("theme_light.is_some(): {}", theme_light.is_some());
        tracing::info!("theme_dark.is_some(): {}", theme_dark.is_some());

        if theme_light.is_some() || theme_dark.is_some() {
            let light = theme_light
                .as_ref()
                .map(parser::json_to_variables)
                .unwrap_or_default();
            let dark = theme_dark
                .as_ref()
                .map(parser::json_to_variables)
                .unwrap_or_default();

            tracing::info!("Updating theme file: {:?}", theme_path);
            tracing::info!("Light theme vars ({} entries): {:?}", light.len(), light);
            tracing::info!("Dark theme vars ({} entries): {:?}", dark.len(), dark);
            tracing::info!("Calling updater::update_theme_file...");

            if let Err(e) = updater::update_theme_file(theme_path, &light, &dark) {
                // Rollback on error
                tracing::error!("Failed to update theme file: {}", e);
                let _ = backup.rollback(Some(variables_path), Some(theme_path), Some(env_path));
                return Err(ThemeServiceError::RollbackTriggered(format!(
                    "Failed to update theme file: {}",
                    e
                )));
            }
            tracing::info!("Theme file updated successfully!");
        } else {
            tracing::info!("No theme updates provided, skipping file update");
        }

        // 5. Run npm build
        tracing::info!("Step 5: Running npm build...");
        let global_path = ThemeConfig::global_page_path();
        let timeout = ThemeConfig::build_timeout_secs();

        // Ensure dependencies are installed
        if let Err(e) = builder::ensure_dependencies(global_path) {
            let _ = backup.rollback(Some(variables_path), Some(theme_path), Some(env_path));
            return Err(ThemeServiceError::RollbackTriggered(format!(
                "Failed to install dependencies: {}",
                e
            )));
        }

        let build_result = builder::run_build_async(global_path, timeout).await;

        match build_result {
            Ok(result) if result.success => {
                // 6. Increment version on success
                let new_version = match versioner::increment_and_update(env_path) {
                    Ok(v) => Some(v),
                    Err(e) => {
                        tracing::warn!("Failed to update version: {}", e);
                        None
                    }
                };

                // 7. Cleanup backups
                let _ = backup.cleanup();

                Ok(ThemeUpdateResult {
                    success: true,
                    new_version,
                    build_output: Some(result),
                    error: None,
                })
            }
            Ok(result) => {
                // Build failed - rollback
                let _ = backup.rollback(Some(variables_path), Some(theme_path), Some(env_path));
                Ok(ThemeUpdateResult {
                    success: false,
                    new_version: None,
                    build_output: Some(result.clone()),
                    error: Some(format!("Build failed: {}", result.stderr)),
                })
            }
            Err(e) => {
                // Build error - rollback
                let _ = backup.rollback(Some(variables_path), Some(theme_path), Some(env_path));
                Err(ThemeServiceError::RollbackTriggered(format!(
                    "Build error: {}",
                    e
                )))
            }
        }
    }

    /// Trigger a build without updating files
    pub async fn rebuild() -> Result<ThemeUpdateResult, ThemeServiceError> {
        let global_path = ThemeConfig::global_page_path();
        let env_path = ThemeConfig::env_file();
        let timeout = ThemeConfig::build_timeout_secs();

        // Ensure dependencies
        builder::ensure_dependencies(global_path)?;

        // Run build
        let result = builder::run_build_async(global_path, timeout).await?;

        if result.success {
            // Increment version
            let new_version = versioner::increment_and_update(env_path).ok();

            Ok(ThemeUpdateResult {
                success: true,
                new_version,
                build_output: Some(result),
                error: None,
            })
        } else {
            Ok(ThemeUpdateResult {
                success: false,
                new_version: None,
                build_output: Some(result.clone()),
                error: Some(result.stderr),
            })
        }
    }

    /// Get the current assets version
    pub fn get_current_version() -> Result<String, ThemeServiceError> {
        let env_path = ThemeConfig::env_file();
        Ok(versioner::get_current_version(env_path)?)
    }
}

/// Convenience function to get allowed variables (for frontend)
pub fn get_allowed_variables() -> (Vec<String>, Vec<String>) {
    (
        ThemeConfig::allowed_scss_variables().clone(),
        ThemeConfig::allowed_css_properties().clone(),
    )
}
