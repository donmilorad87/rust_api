#!/bin/bash
set -e

echo "Starting WebSocket Gateway..."

# Wait for Kafka to be ready
echo "Waiting for Kafka..."
until nc -z kafka 9092 2>/dev/null; do
    echo "Kafka not ready, waiting..."
    sleep 2
done
echo "Kafka is ready!"

# Wait for Redis to be ready
echo "Waiting for Redis..."
until nc -z redis 6379 2>/dev/null; do
    echo "Redis not ready, waiting..."
    sleep 2
done
echo "Redis is ready!"

if [ "$BUILD_ENV" = "dev" ]; then
    echo "Starting in DEVELOPMENT mode with hot reload..."
    exec cargo watch --poll -x "run --bin ws_gateway"
else
    echo "Starting in PRODUCTION mode..."
    cargo build --release --bin ws_gateway
    exec ./target/release/ws_gateway
fi
