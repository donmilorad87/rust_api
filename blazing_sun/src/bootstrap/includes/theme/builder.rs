//! Theme Build Runner
//!
//! Executes npm build in the GLOBAL folder with timeout handling.

use std::path::Path;
use std::process::{Command, Stdio};
use std::time::Duration;
use tokio::time::timeout;

/// Error type for builder operations
#[derive(Debug, thiserror::Error)]
pub enum BuilderError {
    #[error("Build timed out after {0} seconds")]
    Timeout(u64),
    #[error("Build failed: {0}")]
    BuildFailed(String),
    #[error("npm not found or not executable")]
    NpmNotFound,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Working directory does not exist: {0}")]
    WorkingDirNotFound(String),
}

/// Result of a build operation
#[derive(Debug, Clone)]
pub struct BuildResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub duration_ms: u64,
}

impl BuildResult {
    /// Get a summary message for logging
    pub fn summary(&self) -> String {
        if self.success {
            format!("Build succeeded in {}ms", self.duration_ms)
        } else {
            format!(
                "Build failed (exit code: {:?}) in {}ms: {}",
                self.exit_code,
                self.duration_ms,
                self.stderr.lines().next().unwrap_or("Unknown error")
            )
        }
    }
}

/// Run npm build in the specified directory
pub fn run_build(working_dir: &Path, timeout_secs: u64) -> Result<BuildResult, BuilderError> {
    // Verify working directory exists
    if !working_dir.exists() {
        return Err(BuilderError::WorkingDirNotFound(
            working_dir.to_string_lossy().to_string(),
        ));
    }

    let start = std::time::Instant::now();

    // Run npm run build
    let output = Command::new("npm")
        .arg("run")
        .arg("build")
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let duration_ms = start.elapsed().as_millis() as u64;

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();

            Ok(BuildResult {
                success: output.status.success(),
                stdout,
                stderr,
                exit_code: output.status.code(),
                duration_ms,
            })
        }
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                Err(BuilderError::NpmNotFound)
            } else {
                Err(BuilderError::IoError(e))
            }
        }
    }
}

/// Run npm build asynchronously with timeout
pub async fn run_build_async(
    working_dir: &Path,
    timeout_secs: u64,
) -> Result<BuildResult, BuilderError> {
    let working_dir = working_dir.to_path_buf();

    // Spawn blocking task for the build
    let build_future = tokio::task::spawn_blocking(move || {
        run_build(&working_dir, timeout_secs)
    });

    // Apply timeout
    match timeout(Duration::from_secs(timeout_secs), build_future).await {
        Ok(result) => {
            match result {
                Ok(build_result) => build_result,
                Err(e) => Err(BuilderError::BuildFailed(format!("Task panicked: {}", e))),
            }
        }
        Err(_) => Err(BuilderError::Timeout(timeout_secs)),
    }
}

/// Check if npm is available
pub fn check_npm_available() -> bool {
    Command::new("npm")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Install npm dependencies if node_modules doesn't exist
pub fn ensure_dependencies(working_dir: &Path) -> Result<(), BuilderError> {
    let node_modules = working_dir.join("node_modules");
    if !node_modules.exists() {
        tracing::info!("Installing npm dependencies in {:?}", working_dir);

        let output = Command::new("npm")
            .arg("install")
            .current_dir(working_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(BuilderError::BuildFailed(format!(
                "npm install failed: {}",
                stderr
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_npm_available() {
        // This test depends on npm being installed
        // Just verify it doesn't panic
        let _ = check_npm_available();
    }
}
