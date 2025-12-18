#!/bin/sh
set -eux

echo "Installing DEVELOPMENT dependencies..."

export DEBIAN_FRONTEND=noninteractive

# Install WASM system packages
apt-get update
apt-get install -y --no-install-recommends \
  binaryen \
  wabt
rm -rf /var/lib/apt/lists/*

# Rust WASM target
rustup target add wasm32-unknown-unknown

# Cargo tools for dev
cargo install --locked cargo-watch
cargo install --locked sqlx-cli
cargo install --locked wasm-tools
cargo install --locked wasm-pack
cargo install --locked cargo-generate

echo "DEV install complete:"
rustc --version
cargo --version
cargo-watch --version || true
sqlx --version || true
wasm-pack --version || true
wasm-tools --version || true
wasm-opt --version || true