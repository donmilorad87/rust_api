#!/bin/bash
set -e

# Sync PORT from docker environment to money_flow/.env
sync_port() {
    local env_file=".env"
    if [ -n "$PORT" ] && [ -f "$env_file" ]; then
        if grep -q "^PORT=" "$env_file"; then
            sed -i "s/^PORT=.*/PORT=$PORT/" "$env_file"
        else
            echo "PORT=$PORT" >> "$env_file"
        fi
        echo "Synced PORT=$PORT to $env_file"
    fi
}

sync_port

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
    exec cargo watch -i ".sqlx" -i "*.json" -x run
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