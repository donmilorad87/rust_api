//! Version Manager
//!
//! Manages ASSETS_VERSION in the .env file for cache busting.

use std::fs;
use std::path::Path;
use regex::Regex;

/// Error type for versioner operations
#[derive(Debug, thiserror::Error)]
pub enum VersionerError {
    #[error("Failed to read .env file: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Invalid regex: {0}")]
    RegexError(#[from] regex::Error),
    #[error("ASSETS_VERSION not found in .env")]
    VersionNotFound,
    #[error("Invalid version format: {0}")]
    InvalidFormat(String),
}

/// Parse the current ASSETS_VERSION from .env file
pub fn get_current_version(env_path: &Path) -> Result<String, VersionerError> {
    let content = fs::read_to_string(env_path)?;
    parse_version_from_string(&content)
}

/// Parse version from .env content string
pub fn parse_version_from_string(content: &str) -> Result<String, VersionerError> {
    let re = Regex::new(r#"^ASSETS_VERSION\s*=\s*["']?([^"'\s\n]+)["']?"#)?;

    for line in content.lines() {
        if let Some(caps) = re.captures(line) {
            if let Some(version) = caps.get(1) {
                return Ok(version.as_str().to_string());
            }
        }
    }

    Err(VersionerError::VersionNotFound)
}

/// Increment the version (patch level)
/// Supports formats: 1.0.0, 1.0.001, v1.0.0
pub fn increment_version(current: &str) -> Result<String, VersionerError> {
    // Handle 'v' prefix
    let (prefix, version) = if current.starts_with('v') {
        ("v", &current[1..])
    } else {
        ("", current)
    };

    // Split by dots
    let parts: Vec<&str> = version.split('.').collect();

    match parts.len() {
        3 => {
            // Standard semver: major.minor.patch
            let major = parts[0];
            let minor = parts[1];
            let patch = parts[2];

            // Check if patch has leading zeros (like 001)
            let patch_num: u32 = patch
                .parse()
                .map_err(|_| VersionerError::InvalidFormat(current.to_string()))?;

            let new_patch = patch_num + 1;

            // Preserve leading zeros format
            let new_patch_str = if patch.len() > 1 && patch.starts_with('0') {
                format!("{:0>width$}", new_patch, width = patch.len())
            } else {
                new_patch.to_string()
            };

            Ok(format!("{}{}.{}.{}", prefix, major, minor, new_patch_str))
        }
        2 => {
            // major.minor format - add patch
            let major = parts[0];
            let minor: u32 = parts[1]
                .parse()
                .map_err(|_| VersionerError::InvalidFormat(current.to_string()))?;

            Ok(format!("{}{}.{}", prefix, major, minor + 1))
        }
        1 => {
            // Single number format
            let num: u32 = parts[0]
                .parse()
                .map_err(|_| VersionerError::InvalidFormat(current.to_string()))?;

            Ok(format!("{}{}", prefix, num + 1))
        }
        _ => Err(VersionerError::InvalidFormat(current.to_string())),
    }
}

/// Update ASSETS_VERSION in .env file
pub fn update_version(env_path: &Path, new_version: &str) -> Result<(), VersionerError> {
    let content = fs::read_to_string(env_path)?;
    let updated = update_version_in_string(&content, new_version)?;

    // Write atomically via temp file
    let temp_path = env_path.with_extension("env.tmp");
    fs::write(&temp_path, &updated)?;
    fs::rename(&temp_path, env_path)?;

    Ok(())
}

/// Update version in .env content string
pub fn update_version_in_string(content: &str, new_version: &str) -> Result<String, VersionerError> {
    let re = Regex::new(r#"^(ASSETS_VERSION\s*=\s*)["']?[^"'\s\n]+["']?"#)?;

    let mut found = false;
    let lines: Vec<String> = content
        .lines()
        .map(|line| {
            if re.is_match(line) {
                found = true;
                format!("ASSETS_VERSION={}", new_version)
            } else {
                line.to_string()
            }
        })
        .collect();

    if !found {
        // Add ASSETS_VERSION if not found
        let mut result = lines;
        result.push(format!("ASSETS_VERSION={}", new_version));
        return Ok(result.join("\n"));
    }

    Ok(lines.join("\n"))
}

/// Increment version in .env file and return the new version
pub fn increment_and_update(env_path: &Path) -> Result<String, VersionerError> {
    let current = get_current_version(env_path)?;
    let new_version = increment_version(&current)?;
    update_version(env_path, &new_version)?;
    Ok(new_version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_version() {
        let content = r#"
APP_NAME=BlazingSun
ASSETS_VERSION=1.0.5
DATABASE_URL=postgres://localhost
"#;
        assert_eq!(parse_version_from_string(content).unwrap(), "1.0.5");
    }

    #[test]
    fn test_parse_version_with_quotes() {
        let content = r#"ASSETS_VERSION="2.0.0""#;
        assert_eq!(parse_version_from_string(content).unwrap(), "2.0.0");

        let content2 = r#"ASSETS_VERSION='3.0.0'"#;
        assert_eq!(parse_version_from_string(content2).unwrap(), "3.0.0");
    }

    #[test]
    fn test_increment_version() {
        assert_eq!(increment_version("1.0.0").unwrap(), "1.0.1");
        assert_eq!(increment_version("1.0.9").unwrap(), "1.0.10");
        assert_eq!(increment_version("1.0.001").unwrap(), "1.0.002");
        assert_eq!(increment_version("v1.0.0").unwrap(), "v1.0.1");
        assert_eq!(increment_version("1.5").unwrap(), "1.6");
        assert_eq!(increment_version("42").unwrap(), "43");
    }

    #[test]
    fn test_update_version_in_string() {
        let content = "APP_NAME=Test\nASSETS_VERSION=1.0.0\nOTHER=value";
        let result = update_version_in_string(content, "1.0.1").unwrap();
        assert!(result.contains("ASSETS_VERSION=1.0.1"));
        assert!(result.contains("APP_NAME=Test"));
    }
}
