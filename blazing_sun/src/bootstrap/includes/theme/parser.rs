//! SCSS Parser
//!
//! Parses SCSS variables from _variables.scss and CSS custom properties from _theme.scss.

use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Error type for parser operations
#[derive(Debug, thiserror::Error)]
pub enum ParserError {
    #[error("Failed to read file: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Failed to parse SCSS: {0}")]
    ParseError(String),
    #[error("Invalid regex: {0}")]
    RegexError(#[from] regex::Error),
}

/// Parse SCSS variables from a file
/// Returns a map of variable names (without $) to their values
pub fn parse_scss_variables(path: &Path) -> Result<HashMap<String, String>, ParserError> {
    let content = fs::read_to_string(path)?;
    parse_scss_variables_from_string(&content)
}

/// Parse SCSS variables from a string
pub fn parse_scss_variables_from_string(content: &str) -> Result<HashMap<String, String>, ParserError> {
    let mut variables = HashMap::new();

    // Match SCSS variables: $name: value;
    // Handles values that may contain: colors, numbers, strings, functions
    let re = Regex::new(r#"^\s*\$([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*([^;]+);"#)?;

    for line in content.lines() {
        // Skip comments
        if line.trim().starts_with("//") {
            continue;
        }

        if let Some(caps) = re.captures(line) {
            let name = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
            let value = caps.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default();

            // Keep SCSS variable name format (with hyphens) for frontend compatibility
            variables.insert(name, value);
        }
    }

    Ok(variables)
}

/// Parse CSS custom properties from _theme.scss
/// Returns separate maps for light and dark theme
pub fn parse_theme_file(path: &Path) -> Result<(HashMap<String, String>, HashMap<String, String>), ParserError> {
    let content = fs::read_to_string(path)?;
    parse_theme_from_string(&content)
}

/// Parse CSS custom properties from string
pub fn parse_theme_from_string(content: &str) -> Result<(HashMap<String, String>, HashMap<String, String>), ParserError> {
    let mut light_theme = HashMap::new();
    let mut dark_theme = HashMap::new();

    // Track which section we're in
    let mut in_root = false;
    let mut in_dark = false;
    let mut brace_depth = 0;

    // Match CSS custom properties: --name: value;
    let prop_re = Regex::new(r#"^\s*--([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*([^;]+);"#)?;

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip comments
        if trimmed.starts_with("//") {
            continue;
        }

        // Detect :root section
        if trimmed.contains(":root") {
            in_root = true;
            if trimmed.contains('{') {
                brace_depth += 1;
            }
            continue;
        }

        // Detect [data-theme="dark"] section
        if trimmed.contains("[data-theme=\"dark\"]") || trimmed.contains("[data-theme='dark']") {
            in_dark = true;
            if trimmed.contains('{') {
                brace_depth += 1;
            }
            continue;
        }

        // Track braces
        if trimmed.contains('{') {
            brace_depth += 1;
        }
        if trimmed.contains('}') {
            brace_depth -= 1;
            if brace_depth == 0 {
                in_root = false;
                in_dark = false;
            }
        }

        // Parse properties
        if let Some(caps) = prop_re.captures(line) {
            let name = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
            let value = caps.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default();

            // Keep CSS property name format (with hyphens) for frontend compatibility
            // Frontend expects: --bg-gradient-start not bg_gradient_start
            if in_dark {
                dark_theme.insert(name, value);
            } else if in_root {
                light_theme.insert(name, value);
            }
        }
    }

    Ok((light_theme, dark_theme))
}

/// Convert HashMap to JSON Value
pub fn variables_to_json(variables: &HashMap<String, String>) -> Value {
    let map: serde_json::Map<String, Value> = variables
        .iter()
        .map(|(k, v)| (k.clone(), json!(v)))
        .collect();
    Value::Object(map)
}

/// Convert JSON Value to HashMap
pub fn json_to_variables(json: &Value) -> HashMap<String, String> {
    let mut map = HashMap::new();
    if let Some(obj) = json.as_object() {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                map.insert(k.clone(), s.to_string());
            }
        }
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_scss_variables() {
        let content = r#"
// Colors - Brand
$color-primary: #667eea;
$color-primary-dark: #5a6fd6;
$color-secondary: #764ba2;

// Typography
$font-size-base: 1rem;
$font-size-sm: 0.875rem;
"#;
        let vars = parse_scss_variables_from_string(content).unwrap();
        // Keys now use hyphen format (matching SCSS)
        assert_eq!(vars.get("color-primary"), Some(&"#667eea".to_string()));
        assert_eq!(vars.get("font-size-base"), Some(&"1rem".to_string()));
    }

    #[test]
    fn test_parse_theme_file() {
        let content = r#"
:root {
  --bg-gradient-start: #667eea;
  --text-primary: #333333;
}

[data-theme="dark"] {
  --bg-gradient-start: #1a1a2e;
  --text-primary: #e8e8e8;
}
"#;
        let (light, dark) = parse_theme_from_string(content).unwrap();
        // Keys now use hyphen format (matching CSS custom properties)
        assert_eq!(light.get("bg-gradient-start"), Some(&"#667eea".to_string()));
        assert_eq!(dark.get("bg-gradient-start"), Some(&"#1a1a2e".to_string()));
    }
}
