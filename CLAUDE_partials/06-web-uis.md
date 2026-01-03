# Web UIs and Access

## Web Interface Endpoints

| Service     | URL                           | Credentials                          |
|-------------|-------------------------------|--------------------------------------|
| Application | https://localhost/            | -                                    |
| RabbitMQ    | http://localhost:15672        | app / rabbitmq_secret_password       |
| Kafka UI    | http://localhost:8080/kafka   | admin / kafka_ui_secret_password     |
| pgAdmin     | http://localhost:5050/pgadmin | admin@blazingsun.app / pgadmin_secret_password |
| Grafana     | https://localhost/grafana/    | admin / admin                        |
| Prometheus  | http://localhost:9090         | -                                    |

## Nginx Configuration

Nginx serves multiple purposes in this infrastructure:

### 1. SSL Termination
- **HTTPS on port 443**: All production traffic uses SSL
- **HTTP redirect**: Port 80 automatically redirects to HTTPS
- **Self-signed certificates**: Included for development (replace in production)

### 2. Reverse Proxy
- Routes requests to Rust application on port 9999
- Handles client connections efficiently
- Buffers and manages upstream connections

### 3. Static File Serving
- **`/storage/`** path serves files from `blazing_sun/storage/app/public/`
- Direct file serving (bypasses Rust app for performance)
- Handles uploaded images, documents, and public assets
- Proper MIME types and caching headers

### 4. Sub-path Routing
- **`/grafana/`** proxies to Grafana dashboard service
- Preserves authentication and WebSocket connections
- Rewrites paths appropriately for backend services

## SSL Certificates (Production)

To use your own SSL certificates in production:

```bash
# Copy certificate files to nginx container
docker cp your-cert.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp your-key.pem rust-nginx-1:/etc/nginx/ssl/key.pem

# Restart nginx
docker compose restart nginx
```

### Let's Encrypt Integration

For automated SSL with Let's Encrypt:

1. Update `nginx/default.conf.template` to include ACME challenge location
2. Mount certificate directory as volume
3. Use certbot container for automatic renewal

## Accessing Services from Host

All services are accessible from the host machine:

- Application: Browser to https://localhost/
- RabbitMQ Management: Browser to http://localhost:15672
- Kafka UI: Browser to http://localhost:8080/kafka
- pgAdmin: Browser to http://localhost:5050/pgadmin
- Grafana: Browser to https://localhost/grafana/
- Prometheus: Browser to http://localhost:9090

## Accessing Services Between Containers

Services use internal DNS names within the Docker network:

- Rust → Postgres: `postgres:5432`
- Rust → Redis: `redis:6379`
- Rust → RabbitMQ: `rabbitmq:5672`
- Rust → Kafka: `kafka:9092`
- Prometheus → Services: Uses static IPs (172.28.0.x)
