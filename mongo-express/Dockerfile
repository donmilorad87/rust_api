FROM mongo-express:latest

# Install system updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Copy entrypoint script
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Mongo Express default port
EXPOSE 8081

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
