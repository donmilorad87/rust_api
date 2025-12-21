#!/bin/bash
set -e

ENV_FILE=".env"

# Sync a single environment variable to money_flow/.env
sync_env_var() {
    local var_name=$1
    local var_value=$2

    if [ -n "$var_value" ] && [ -f "$ENV_FILE" ]; then
        if grep -q "^${var_name}=" "$ENV_FILE"; then
            sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" "$ENV_FILE"
        else
            echo "${var_name}=${var_value}" >> "$ENV_FILE"
        fi
        echo "Synced ${var_name}=${var_value}"
    fi
}

# Sync all environment variables from docker to money_flow/.env
sync_env_vars() {
    echo "Syncing environment variables to $ENV_FILE..."

    # Sync PORT
    sync_env_var "PORT" "$PORT"

    # Sync PostgreSQL variables
    sync_env_var "POSTGRES_IP" "$POSTGRES_IP"
    sync_env_var "POSTGRES_USER" "$POSTGRES_USER"
    sync_env_var "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
    sync_env_var "POSTGRES_DB" "$POSTGRES_DB"
    sync_env_var "POSTGRES_HOST" "$POSTGRES_HOST"
    sync_env_var "POSTGRES_PORT" "$POSTGRES_PORT"

    # Construct and sync DATABASE_URL
    if [ -n "$POSTGRES_HOST" ] && [ -n "$POSTGRES_PORT" ]; then
        local database_url="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
        sync_env_var "DATABASE_URL" "$database_url"
    fi

    # Sync Redis variables
    sync_env_var "REDIS_IP" "$REDIS_IP"
    sync_env_var "REDIS_HOST" "$REDIS_HOST"
    sync_env_var "REDIS_PORT" "$REDIS_PORT"
    sync_env_var "REDIS_USER" "$REDIS_USER"
    sync_env_var "REDIS_PASSWORD" "$REDIS_PASSWORD"
    sync_env_var "REDIS_DB" "$REDIS_DB"

    # Construct and sync REDIS_URL
    if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
        local redis_url="redis://${REDIS_USER}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}"
        sync_env_var "REDIS_URL" "$redis_url"
    fi

    echo ""
}

sync_env_vars

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