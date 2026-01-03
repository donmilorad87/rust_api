FROM dpage/pgadmin4:latest

# Build arguments
ARG PGADMIN_DEFAULT_EMAIL
ARG PGADMIN_DEFAULT_PASSWORD

# Set environment variables
ENV PGADMIN_DEFAULT_EMAIL=${PGADMIN_DEFAULT_EMAIL}
ENV PGADMIN_DEFAULT_PASSWORD=${PGADMIN_DEFAULT_PASSWORD}
ENV PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION=True
ENV PGADMIN_CONFIG_CONSOLE_LOG_LEVEL=30

# Switch to root for file operations
USER root

# Copy server configuration (pre-configured PostgreSQL connection)
COPY servers.json /pgadmin4/servers.json

# Copy entrypoint script and set permissions
COPY entrypoint.sh /entrypoint-custom.sh
RUN chmod +x /entrypoint-custom.sh && \
    chown pgadmin:root /entrypoint-custom.sh && \
    chown pgadmin:root /pgadmin4/servers.json

# Switch back to pgadmin user
USER pgadmin

# Expose port
EXPOSE 80

ENTRYPOINT ["/entrypoint-custom.sh"]
