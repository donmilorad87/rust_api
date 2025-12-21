FROM postgres:16

# Install openssl for certificate generation and gettext for envsubst
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Build args
ARG POSTGRES_IP
ARG POSTGRES_PORT
ARG POSTGRES_USER
ARG POSTGRES_PASSWORD
ARG POSTGRES_DB

# Environment variables
ENV POSTGRES_IP=${POSTGRES_IP}
ENV POSTGRES_PORT=${POSTGRES_PORT}
ENV POSTGRES_USER=${POSTGRES_USER}
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ENV POSTGRES_DB=${POSTGRES_DB}

# Create SSL directory
RUN mkdir -p /var/lib/postgresql/ssl

# Generate self-signed certificate for PostgreSQL
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /var/lib/postgresql/ssl/server.key \
    -out /var/lib/postgresql/ssl/server.crt \
    -subj "/C=RS/ST=Serbia/L=Belgrade/O=MoneyFlow/OU=Database/CN=postgres"

# Set proper permissions (PostgreSQL requires strict permissions on key)
RUN chmod 600 /var/lib/postgresql/ssl/server.key \
    && chmod 644 /var/lib/postgresql/ssl/server.crt \
    && chown postgres:postgres /var/lib/postgresql/ssl/server.key \
    && chown postgres:postgres /var/lib/postgresql/ssl/server.crt

# Copy custom configuration
COPY postgresql.conf.template /etc/postgresql/postgresql.conf.template
COPY pg_hba.conf /etc/postgresql/pg_hba.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE ${POSTGRES_PORT}

ENTRYPOINT ["/entrypoint.sh"]