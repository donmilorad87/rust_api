#!/bin/bash
set -e

echo "=== MongoDB Startup Script ==="
echo "Configuring MongoDB with environment variables..."

# Default port if not set
export MONGO_PORT=${MONGO_PORT:-27017}

# Generate config from template using envsubst
echo "Generating /etc/mongo/mongod.conf from template..."
envsubst < /etc/mongo/mongod.conf.template > /etc/mongo/mongod.conf

# Display the generated config (for debugging)
echo "Generated MongoDB configuration:"
echo "================================"
cat /etc/mongo/mongod.conf
echo "================================"

# Display environment variables being used
echo ""
echo "MongoDB Environment:"
echo "  MONGO_PORT: ${MONGO_PORT}"
echo "  MONGO_INITDB_DATABASE: ${MONGO_INITDB_DATABASE}"
echo "  MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME}"
echo "  MONGO_USER: ${MONGO_USER}"
echo ""

# Call the original MongoDB entrypoint with config file
# The original entrypoint handles initialization scripts in /docker-entrypoint-initdb.d/
exec docker-entrypoint.sh mongod --config /etc/mongo/mongod.conf "$@"
