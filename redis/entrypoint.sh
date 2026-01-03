#!/bin/sh
set -e

# Substitute environment variables in redis.conf template
envsubst '${REDIS_IP} ${REDIS_PASSWORD} ${REDIS_USER} ${REDIS_PORT} ${REDIS_DB}' \
    < /etc/redis/redis.conf.template \
    > /etc/redis/redis.conf

echo "Redis Configuration:"
echo "  IP: ${REDIS_IP}"
echo "  Port: ${REDIS_PORT}"
echo "  User: ${REDIS_USER}"
echo "  Default DB: ${REDIS_DB}"
echo "  Pub/Sub: Enabled"
echo "  AOF Persistence: Enabled"
echo ""

# Start Redis with the generated config
exec redis-server /etc/redis/redis.conf
