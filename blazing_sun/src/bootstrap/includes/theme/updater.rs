//! Theme File Updater
//!
//! Atomic file updates with backup and rollback support.

use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;

/// Error type for updater operations
#[derive(Debug, thiserror::Error)]
pub enum UpdaterError {
    #[error("Failed to read file: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Invalid regex: {0}")]
    RegexError(#[from] regex::Error),
    #[error("Backup failed: {0}")]
    BackupError(String),
    #[error("Rollback failed: {0}")]
    RollbackError(String),
    #[error("Variable not found: {0}")]
    VariableNotFound(String),
}

/// Represents a backup of files
pub struct Backup {
    pub variables_backup: Option<PathBuf>,
    pub theme_backup: Option<PathBuf>,
    pub env_backup: Option<PathBuf>,
    pub backup_dir: PathBuf,
    pub timestamp: String,
}

impl Backup {
    /// Create a new backup instance
    pub fn new(backup_dir: &Path) -> Self {
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S_%3f").to_string();
        Self {
            variables_backup: None,
            theme_backup: None,
            env_backup: None,
            backup_dir: backup_dir.to_path_buf(),
            timestamp,
        }
    }

    /// Create backups of the specified files
    pub fn create(
        &mut self,
        variables_file: Option<&Path>,
        theme_file: Option<&Path>,
        env_file: Option<&Path>,
    ) -> Result<(), UpdaterError> {
        // Ensure backup directory exists
        fs::create_dir_all(&self.backup_dir)?;

        if let Some(path) = variables_file {
            if path.exists() {
                let backup_path = self.backup_dir.join(format!("variables_{}.scss", self.timestamp));
                fs::copy(path, &backup_path)?;
                self.variables_backup = Some(backup_path);
            }
        }

        if let Some(path) = theme_file {
            if path.exists() {
                let backup_path = self.backup_dir.join(format!("theme_{}.scss", self.timestamp));
                fs::copy(path, &backup_path)?;
                self.theme_backup = Some(backup_path);
            }
        }

        if let Some(path) = env_file {
            if path.exists() {
                let backup_path = self.backup_dir.join(format!("env_{}.txt", self.timestamp));
                fs::copy(path, &backup_path)?;
                self.env_backup = Some(backup_path);
            }
        }

        Ok(())
    }

    /// Rollback all backed up files
    pub fn rollback(
        &self,
        variables_file: Option<&Path>,
        theme_file: Option<&Path>,
        env_file: Option<&Path>,
    ) -> Result<(), UpdaterError> {
        if let (Some(backup), Some(target)) = (&self.variables_backup, variables_file) {
            fs::copy(backup, target).map_err(|e| {
                UpdaterError::RollbackError(format!("Failed to restore variables: {}", e))
            })?;
        }

        if let (Some(backup), Some(target)) = (&self.theme_backup, theme_file) {
            fs::copy(backup, target).map_err(|e| {
                UpdaterError::RollbackError(format!("Failed to restore theme: {}", e))
            })?;
        }

        if let (Some(backup), Some(target)) = (&self.env_backup, env_file) {
            fs::copy(backup, target).map_err(|e| {
                UpdaterError::RollbackError(format!("Failed to restore env: {}", e))
            })?;
        }

        Ok(())
    }

    /// Cleanup backup files (call after successful operation)
    pub fn cleanup(&self) -> Result<(), UpdaterError> {
        if let Some(path) = &self.variables_backup {
            if path.exists() {
                fs::remove_file(path)?;
            }
        }
        if let Some(path) = &self.theme_backup {
            if path.exists() {
                fs::remove_file(path)?;
            }
        }
        if let Some(path) = &self.env_backup {
            if path.exists() {
                fs::remove_file(path)?;
            }
        }
        Ok(())
    }
}

/// Update SCSS variables in a file
/// Takes a map of variable names (without $, using underscores) to new values
pub fn update_scss_variables(
    path: &Path,
    variables: &HashMap<String, String>,
) -> Result<(), UpdaterError> {
    let content = fs::read_to_string(path)?;
    let updated = update_scss_variables_in_string(&content, variables)?;

    // Write atomically via temp file
    let temp_path = path.with_extension("scss.tmp");
    fs::write(&temp_path, &updated)?;
    fs::rename(&temp_path, path)?;

    Ok(())
}

/// Update SCSS variables in a string
pub fn update_scss_variables_in_string(
    content: &str,
    variables: &HashMap<String, String>,
) -> Result<String, UpdaterError> {
    let mut result = content.to_string();

    for (name, value) in variables {
        // Convert underscore back to hyphen for SCSS variable names
        let scss_name = name.replace('_', "-");

        // Build regex to match the variable declaration
        let pattern = format!(r"\${}:\s*[^;]+;", regex::escape(&scss_name));
        let re = Regex::new(&pattern)?;

        // Replace with new value
        // Note: $$ is needed to escape $ in the replacement string (regex syntax)
        let replacement = format!("$${}: {};", scss_name, value);
        result = re.replace(&result, replacement.as_str()).to_string();
    }

    Ok(result)
}

/// Update CSS custom properties in _theme.scss
/// Takes separate maps for light and dark theme
pub fn update_theme_file(
    path: &Path,
    light_theme: &HashMap<String, String>,
    dark_theme: &HashMap<String, String>,
) -> Result<(), UpdaterError> {
    let content = fs::read_to_string(path)?;
    let updated = update_theme_in_string(&content, light_theme, dark_theme)?;

    // Write atomically via temp file
    let temp_path = path.with_extension("scss.tmp");
    fs::write(&temp_path, &updated)?;
    fs::rename(&temp_path, path)?;

    Ok(())
}

/// Update CSS custom properties in string
pub fn update_theme_in_string(
    content: &str,
    light_theme: &HashMap<String, String>,
    dark_theme: &HashMap<String, String>,
) -> Result<String, UpdaterError> {
    let mut result = content.to_string();

    // Process all properties in both themes
    let all_properties: std::collections::HashSet<_> = light_theme.keys()
        .chain(dark_theme.keys())
        .collect();

    for name in all_properties {
        // Convert underscore back to hyphen for CSS property names
        let css_name = name.replace('_', "-");

        // Update in :root section (light theme)
        if let Some(value) = light_theme.get(name) {
            let pattern = format!(r"(:root\s*\{{[^}}]*)(--{})\s*:\s*[^;]+;", regex::escape(&css_name));
            if let Ok(re) = Regex::new(&pattern) {
                // This is complex because we need to preserve context
                // Simpler approach: line-by-line replacement
            }
        }

        // Update in [data-theme="dark"] section
        if let Some(value) = dark_theme.get(name) {
            // Similar logic for dark theme
        }
    }

    // Simpler approach: process line by line with section tracking
    result = update_theme_line_by_line(content, light_theme, dark_theme)?;

    Ok(result)
}

/// Line-by-line theme file update
fn update_theme_line_by_line(
    content: &str,
    light_theme: &HashMap<String, String>,
    dark_theme: &HashMap<String, String>,
) -> Result<String, UpdaterError> {
    let mut lines: Vec<String> = Vec::new();
    let mut in_root = false;
    let mut in_dark = false;
    let mut brace_depth = 0;

    let prop_re = Regex::new(r#"^(\s*)--([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*[^;]+;"#)?;

    for line in content.lines() {
        let trimmed = line.trim();

        // Detect :root section
        if trimmed.contains(":root") {
            in_root = true;
            if trimmed.contains('{') {
                brace_depth += 1;
            }
            lines.push(line.to_string());
            continue;
        }

        // Detect [data-theme="dark"] section
        if trimmed.contains("[data-theme=\"dark\"]") || trimmed.contains("[data-theme='dark']") {
            in_dark = true;
            if trimmed.contains('{') {
                brace_depth += 1;
            }
            lines.push(line.to_string());
            continue;
        }

        // Track braces
        if trimmed.contains('{') && !trimmed.contains(":root") && !trimmed.contains("[data-theme") {
            brace_depth += 1;
        }
        if trimmed.contains('}') {
            brace_depth -= 1;
            if brace_depth == 0 {
                in_root = false;
                in_dark = false;
            }
            lines.push(line.to_string());
            continue;
        }

        // Check if this line is a CSS property we need to update
        if let Some(caps) = prop_re.captures(line) {
            let indent = caps.get(1).map(|m| m.as_str()).unwrap_or("  ");
            let prop_name = caps.get(2).map(|m| m.as_str()).unwrap_or("");

            let theme = if in_dark { dark_theme } else if in_root { light_theme } else { &HashMap::new() };

            // Try underscore format first (frontend uses this), then hyphen format for backwards compatibility
            // This is important because the database may have BOTH formats, and underscore has the newer value
            let underscore_name = prop_name.replace('-', "_");
            let new_value = theme.get(&underscore_name)
                .or_else(|| theme.get(prop_name));

            if let Some(value) = new_value {
                // Replace with new value
                lines.push(format!("{}--{}: {};", indent, prop_name, value));
                continue;
            }
        }

        // Keep line as-is
        lines.push(line.to_string());
    }

    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_scss_variables() {
        let content = r#"
$color-primary: #667eea;
$font-size-base: 1rem;
"#;
        let mut vars = HashMap::new();
        // Use hyphen format (matching frontend)
        vars.insert("color-primary".to_string(), "#ff0000".to_string());

        let result = update_scss_variables_in_string(content, &vars).unwrap();
        assert!(result.contains("$color-primary: #ff0000;"));
        assert!(result.contains("$font-size-base: 1rem;"));
    }

    #[test]
    fn test_update_scss_variables_underscore_format() {
        // Test backwards compatibility with underscore format
        let content = r#"
$color-primary: #667eea;
$font-size-base: 1rem;
"#;
        let mut vars = HashMap::new();
        // Underscore format should still work (converted to hyphen)
        vars.insert("color_primary".to_string(), "#00ff00".to_string());

        let result = update_scss_variables_in_string(content, &vars).unwrap();
        assert!(result.contains("$color-primary: #00ff00;"));
    }

    #[test]
    fn test_update_theme_line_by_line() {
        let content = r#":root {
  --bg-gradient-start: #667eea;
  --text-primary: #333333;
}

[data-theme="dark"] {
  --bg-gradient-start: #1a1a2e;
  --text-primary: #e8e8e8;
}"#;

        let mut light = HashMap::new();
        // Frontend uses underscore format
        light.insert("bg_gradient_start".to_string(), "#new-light".to_string());

        let mut dark = HashMap::new();
        dark.insert("bg_gradient_start".to_string(), "#new-dark".to_string());

        let result = update_theme_line_by_line(content, &light, &dark).unwrap();
        assert!(result.contains("--bg-gradient-start: #new-light;"));
        assert!(result.contains("--bg-gradient-start: #new-dark;"));
    }

    #[test]
    fn test_update_theme_underscore_priority() {
        // Test that underscore format takes priority when both exist (database may have both)
        let content = r#":root {
  --bg-gradient-start: #667eea;
}"#;

        let mut light = HashMap::new();
        // Both formats exist, underscore should win (has newer value)
        light.insert("bg_gradient_start".to_string(), "#new-value".to_string());
        light.insert("bg-gradient-start".to_string(), "#old-value".to_string());

        let result = update_theme_line_by_line(content, &light, &HashMap::new()).unwrap();
        assert!(result.contains("--bg-gradient-start: #new-value;"), "Underscore format should take priority");
    }

    #[test]
    fn test_update_theme_hyphen_fallback() {
        // Test backwards compatibility with hyphen-only format
        let content = r#":root {
  --bg-gradient-start: #667eea;
}"#;

        let mut light = HashMap::new();
        // Only hyphen format exists
        light.insert("bg-gradient-start".to_string(), "#hyphen-value".to_string());

        let result = update_theme_line_by_line(content, &light, &HashMap::new()).unwrap();
        assert!(result.contains("--bg-gradient-start: #hyphen-value;"));
    }
}
