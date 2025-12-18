FROM postgres:16

# Install openssl for certificate generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

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
COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY pg_hba.conf /etc/postgresql/pg_hba.conf

# Use custom config
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf", "-c", "hba_file=/etc/postgresql/pg_hba.conf"]