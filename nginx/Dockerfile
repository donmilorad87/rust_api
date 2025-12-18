FROM nginx:alpine

# Install openssl
RUN apk add --no-cache openssl

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed certificate during build
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/C=RS/ST=Serbia/L=Belgrade/O=MoneyFlow/OU=Dev/CN=money-flow.local" \
    -addext "subjectAltName=DNS:money-flow.local,DNS:localhost,IP:192.168.0.109"

# Set proper permissions
RUN chmod 600 /etc/nginx/ssl/server.key \
    && chmod 644 /etc/nginx/ssl/server.crt

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]