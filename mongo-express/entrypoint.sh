#!/bin/sh
set -e

echo "=== Mongo Express Initialization ==="
echo "Connecting to MongoDB at: ${ME_CONFIG_MONGODB_SERVER}:${ME_CONFIG_MONGODB_PORT}"
echo "Base Path: ${ME_CONFIG_SITE_BASEURL}"

# Start mongo-express with tini (default entrypoint)
exec tini -- node app
