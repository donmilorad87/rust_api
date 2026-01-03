FROM nginx:alpine

# Update system packages (Alpine-based)
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Install openssl
RUN apk add --no-cache openssl

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed certificate during build
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/C=RS/ST=Serbia/L=Belgrade/O=BlazingSun/OU=Dev/CN=blazing-sun.local" \
    -addext "subjectAltName=DNS:blazing-sun.local,DNS:localhost,IP:192.168.0.109"

# Set proper permissions
RUN chmod 600 /etc/nginx/ssl/server.key \
    && chmod 644 /etc/nginx/ssl/server.crt

# Copy nginx config template (envsubst will convert to default.conf on start)
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Expose TCP for HTTP/1.1 and HTTP/2, UDP for HTTP/3 (QUIC)
EXPOSE 80 443/tcp 443/udp

CMD ["nginx", "-g", "daemon off;"]
