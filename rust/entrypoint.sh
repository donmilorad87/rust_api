#!/bin/bash
set -e

if [ "$BUILD_ENV" = "dev" ]; then
    echo "Starting in DEVELOPMENT mode..."
    
    # Wait for postgres to be ready
    echo "Waiting for PostgreSQL..."
    while ! sqlx database create 2>/dev/null; do
        sleep 1
    done
    echo "PostgreSQL is ready!"
    
    # Run migrations if they exist
    if [ -d "migrations" ]; then
        echo "Running migrations..."
        sqlx migrate run || true
    fi
    
    # Prepare SQLx offline queries
    echo "Preparing SQLx offline queries..."
    cargo sqlx prepare || true
    
    echo "Starting with hot reload..."
    exec cargo watch -s "cargo sqlx prepare && cargo run"
else
    echo "Starting in PRODUCTION mode..."
    
    # Run migrations if they exist
    if [ -d "migrations" ]; then
        echo "Running migrations..."
        sqlx migrate run || true
    fi
    
    cargo build --release
    exec ./target/release/money_flow
fi