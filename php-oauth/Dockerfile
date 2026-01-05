FROM php:8.2-apache

RUN a2enmod rewrite ssl

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/apache2/ssl

RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/apache2/ssl/server.key \
    -out /etc/apache2/ssl/server.crt \
    -subj "/C=RS/ST=Serbia/L=Belgrade/O=BlazingSun/OU=Dev/CN=php-oauth.local" \
    -addext "subjectAltName=DNS:php-oauth.local,DNS:localhost,IP:127.0.0.1"

RUN sed -i "s|/etc/ssl/certs/ssl-cert-snakeoil.pem|/etc/apache2/ssl/server.crt|g" /etc/apache2/sites-available/default-ssl.conf \
    && sed -i "s|/etc/ssl/private/ssl-cert-snakeoil.key|/etc/apache2/ssl/server.key|g" /etc/apache2/sites-available/default-ssl.conf

RUN a2ensite default-ssl

WORKDIR /var/www/html
