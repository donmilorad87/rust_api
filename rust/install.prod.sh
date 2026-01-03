#!/bin/sh
set -eux

echo "Installing PRODUCTION dependencies..."

# Only sqlx-cli for migrations (if needed)
cargo install --locked sqlx-cli

echo "PROD install complete:"
rustc --version
cargo --version
sqlx --version || true