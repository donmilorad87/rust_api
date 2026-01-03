#!/bin/bash
set -e

# Substitute environment variables in postgresql.conf template
envsubst '${POSTGRES_IP} ${POSTGRES_PORT}' \
    < /etc/postgresql/postgresql.conf.template \
    > /etc/postgresql/postgresql.conf

echo "PostgreSQL Configuration:"
echo "  IP: ${POSTGRES_IP}"
echo "  Port: ${POSTGRES_PORT}"
echo "  User: ${POSTGRES_USER}"
echo "  Database: ${POSTGRES_DB}"
echo ""

# Run the original PostgreSQL entrypoint
exec docker-entrypoint.sh postgres -c config_file=/etc/postgresql/postgresql.conf -c hba_file=/etc/postgresql/pg_hba.conf
