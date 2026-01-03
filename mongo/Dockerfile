FROM mongo:latest

# Build arguments for initialization
ARG MONGO_INITDB_ROOT_USERNAME
ARG MONGO_INITDB_ROOT_PASSWORD
ARG MONGO_INITDB_DATABASE
ARG MONGO_USER
ARG MONGO_PASSWORD
ARG MONGO_PORT=27017

# Install system updates and envsubst
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Create log directory
RUN mkdir -p /var/log/mongodb && chown -R mongodb:mongodb /var/log/mongodb

# Copy configuration template
COPY mongod.conf.template /etc/mongo/mongod.conf.template

# Copy initialization script (runs on first start)
COPY entrypoint.sh /docker-entrypoint-initdb.d/init-mongo.sh
RUN chmod +x /docker-entrypoint-initdb.d/init-mongo.sh

# Copy custom startup script
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# MongoDB port (from build arg, default 27017)
EXPOSE ${MONGO_PORT}

# Health check - uses mongosh to ping the database
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD mongosh --eval "db.adminCommand('ping')" --quiet || exit 1

# Use custom startup script
ENTRYPOINT ["/startup.sh"]
