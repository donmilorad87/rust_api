#!/bin/bash
set -e

echo "Starting Checkout service..."

# Wait for Kafka to be ready
echo "Waiting for Kafka..."
until nc -z kafka 9092 2>/dev/null; do
    echo "Kafka not ready, waiting..."
    sleep 2
done
echo "Kafka is ready!"

if [ "$BUILD_ENV" = "dev" ]; then
    echo "Starting in DEVELOPMENT mode with hot reload..."
    exec cargo watch --poll -x "run --bin checkout"
else
    echo "Starting in PRODUCTION mode..."
    cargo build --release --bin checkout
    exec ./target/release/checkout
fi
