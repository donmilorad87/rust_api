#!/bin/sh
set -e

echo "============================================"
echo "Starting pgAdmin 4"
echo "============================================"
echo ""
echo "Configuration:"
echo "  Email: ${PGADMIN_DEFAULT_EMAIL}"
echo "  Script Path: ${SCRIPT_NAME:-/pgadmin}"
echo "  PostgreSQL Host: ${POSTGRES_HOST}"
echo ""

# Create pgpass file for automatic PostgreSQL authentication
# Format: hostname:port:database:username:password
echo "${POSTGRES_HOST}:${POSTGRES_PORT}:*:${POSTGRES_USER}:${POSTGRES_PASSWORD}" > /tmp/pgpass
chmod 600 /tmp/pgpass

# Execute the default entrypoint
exec /entrypoint.sh
