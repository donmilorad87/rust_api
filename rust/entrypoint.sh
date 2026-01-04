#!/bin/bash
set -e

ENV_FILE=".env"

# Sync a single environment variable to blazing_sun/.env
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

# Sync all environment variables from docker to blazing_sun/.env
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

    # Sync RabbitMQ variables
    sync_env_var "RABBITMQ_HOST" "$RABBITMQ_HOST"
    sync_env_var "RABBITMQ_PORT" "$RABBITMQ_PORT"
    sync_env_var "RABBITMQ_USER" "$RABBITMQ_USER"
    sync_env_var "RABBITMQ_PASSWORD" "$RABBITMQ_PASSWORD"
    sync_env_var "RABBITMQ_VHOST" "$RABBITMQ_VHOST"

    # Construct and sync RABBITMQ_URL
    if [ -n "$RABBITMQ_HOST" ] && [ -n "$RABBITMQ_PORT" ]; then
        # Encode vhost (/ becomes %2F)
        local encoded_vhost
        if [ "$RABBITMQ_VHOST" = "/" ]; then
            encoded_vhost="%2F"
        else
            encoded_vhost="$RABBITMQ_VHOST"
        fi
        local rabbitmq_url="amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@${RABBITMQ_HOST}:${RABBITMQ_PORT}/${encoded_vhost}"
        sync_env_var "RABBITMQ_URL" "$rabbitmq_url"
    fi

    # Sync Kafka variables
    sync_env_var "KAFKA_HOST" "$KAFKA_HOST"
    sync_env_var "KAFKA_PORT" "$KAFKA_PORT"

    # Construct and sync KAFKA_BROKERS (comma-separated list of brokers)
    if [ -n "$KAFKA_HOST" ] && [ -n "$KAFKA_PORT" ]; then
        local kafka_brokers="${KAFKA_HOST}:${KAFKA_PORT}"
        sync_env_var "KAFKA_BROKERS" "$kafka_brokers"
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

    # Sync Email variables
    sync_env_var "MAIL_MAILER" "$MAIL_MAILER"
    sync_env_var "MAIL_HOST" "$MAIL_HOST"
    sync_env_var "MAIL_PORT" "$MAIL_PORT"
    sync_env_var "MAIL_USERNAME" "$MAIL_USERNAME"
    sync_env_var "MAIL_PASSWORD" "$MAIL_PASSWORD"
    sync_env_var "MAIL_FROM_ADDRESS" "$MAIL_FROM_ADDRESS"
    sync_env_var "MAIL_FROM_NAME" "$MAIL_FROM_NAME"

    # Sync MongoDB variables
    sync_env_var "MONGO_HOST" "$MONGO_HOST"
    sync_env_var "MONGO_PORT" "$MONGO_PORT"
    sync_env_var "MONGO_USER" "$MONGO_USER"
    sync_env_var "MONGO_PASSWORD" "$MONGO_PASSWORD"
    sync_env_var "MONGO_INITDB_DATABASE" "$MONGO_INITDB_DATABASE"

    # Construct and sync MONGO_URL
    if [ -n "$MONGO_HOST" ] && [ -n "$MONGO_PORT" ]; then
        local mongo_url="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_INITDB_DATABASE}"
        sync_env_var "MONGO_URL" "$mongo_url"
    fi

    # Sync Upload Configuration variables
    sync_env_var "UPLOAD_STORAGE_PATH" "$UPLOAD_STORAGE_PATH"

    # Sync Session Configuration variables
    sync_env_var "SESSION_DRIVER" "$SESSION_DRIVER"
    sync_env_var "SESSION_REDIS_URL" "$SESSION_REDIS_URL"
    sync_env_var "SESSION_COOKIE" "$SESSION_COOKIE"
    sync_env_var "SESSION_LIFETIME_MINUTES" "$SESSION_LIFETIME_MINUTES"
    sync_env_var "SESSION_REFRESH_TTL" "$SESSION_REFRESH_TTL"
    sync_env_var "SESSION_REGENERATE_ON_LOGIN" "$SESSION_REGENERATE_ON_LOGIN"
    sync_env_var "SESSION_SECURE_COOKIE" "$SESSION_SECURE_COOKIE"
    sync_env_var "SESSION_HTTP_ONLY" "$SESSION_HTTP_ONLY"
    sync_env_var "SESSION_SAMESITE" "$SESSION_SAMESITE"
    sync_env_var "SESSION_COOKIE_PATH" "$SESSION_COOKIE_PATH"
    sync_env_var "SESSION_KEY_PREFIX" "$SESSION_KEY_PREFIX"

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
    exec cargo watch --poll -i ".sqlx" -i "*.json" -i "tests" -i "*.spec.ts" -i "test-results" -i "**/storage/**" -i "**/storage" -i "src/storage/*" -i "src/resources/css/*" -i "src/resources/js/*" -i "src/frontend/**" -i "node_modules" -x run
else
    echo "Starting in PRODUCTION mode..."
    
    # Run migrations if they exist
    if [ -d "migrations" ]; then
        echo "Running migrations..."
        sqlx migrate run || true
    fi
    
    cargo build --release
    exec ./target/release/blazing_sun
fi