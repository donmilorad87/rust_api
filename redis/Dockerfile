FROM redis:alpine

# Update system packages (Alpine-based)
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Install envsubst for config templating
RUN apk add --no-cache gettext

# Build arguments from docker-compose
ARG REDIS_IP
ARG REDIS_PASSWORD
ARG REDIS_USER
ARG REDIS_PORT
ARG REDIS_DB

# Set environment variables
ENV REDIS_IP=${REDIS_IP}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV REDIS_USER=${REDIS_USER}
ENV REDIS_PORT=${REDIS_PORT}
ENV REDIS_DB=${REDIS_DB}

# Create directories for data and config
RUN mkdir -p /data /etc/redis

# Copy configuration template
COPY redis.conf /etc/redis/redis.conf.template

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose Redis port
EXPOSE ${REDIS_PORT}

# Data volume
VOLUME /data

ENTRYPOINT ["/entrypoint.sh"]
