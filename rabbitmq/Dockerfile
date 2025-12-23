FROM rabbitmq:4-management-alpine

# Install envsubst for config templating
RUN apk add --no-cache gettext

# Enable Prometheus plugin for metrics export
RUN rabbitmq-plugins enable --offline rabbitmq_prometheus

# Build arguments from docker-compose
ARG RABBITMQ_USER
ARG RABBITMQ_PASSWORD
ARG RABBITMQ_VHOST
ARG RABBITMQ_PORT
ARG RABBITMQ_MANAGEMENT_PORT

# Set environment variables
ENV RABBITMQ_USER=${RABBITMQ_USER}
ENV RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
ENV RABBITMQ_VHOST=${RABBITMQ_VHOST}
ENV RABBITMQ_PORT=${RABBITMQ_PORT}
ENV RABBITMQ_MANAGEMENT_PORT=${RABBITMQ_MANAGEMENT_PORT}

# Create directories
RUN mkdir -p /etc/rabbitmq

# Copy configuration template
COPY rabbitmq.conf /etc/rabbitmq/rabbitmq.conf.template

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE ${RABBITMQ_PORT}
EXPOSE ${RABBITMQ_MANAGEMENT_PORT}
EXPOSE 15692

# Data volume
VOLUME /var/lib/rabbitmq

ENTRYPOINT ["/entrypoint.sh"]
