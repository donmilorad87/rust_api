#!/bin/sh
set -e

# Substitute environment variables in rabbitmq.conf template
envsubst '${RABBITMQ_USER} ${RABBITMQ_PASSWORD} ${RABBITMQ_VHOST} ${RABBITMQ_PORT} ${RABBITMQ_MANAGEMENT_PORT}' \
    < /etc/rabbitmq/rabbitmq.conf.template \
    > /etc/rabbitmq/rabbitmq.conf

echo "RabbitMQ Configuration:"
echo "  Port: ${RABBITMQ_PORT}"
echo "  Management Port: ${RABBITMQ_MANAGEMENT_PORT}"
echo "  User: ${RABBITMQ_USER}"
echo "  VHost: ${RABBITMQ_VHOST}"
echo ""

# Start RabbitMQ
exec docker-entrypoint.sh rabbitmq-server
