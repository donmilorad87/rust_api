# Troubleshooting Guide

## Common Issues and Solutions

### Stale Files in Container

**Symptom**: Code changes not reflected in running application

**Solution**:
```bash
docker compose restart rust
```

If that doesn't work:
```bash
docker compose down
docker compose up -d --build
```

---

### Database Connection Failed

**Symptom**: Application can't connect to PostgreSQL

**Diagnostic steps**:
```bash
# Check PostgreSQL logs
docker compose logs postgres

# Test database connectivity
docker compose exec postgres pg_isready -U app -d blazing_sun

# Verify database exists
docker compose exec postgres psql -U app -l
```

**Common causes**:
- Database not fully started (wait for healthcheck)
- Wrong credentials in `.env`
- Network issues (check `docker network ls`)

**Solution**:
```bash
# Restart PostgreSQL
docker compose restart postgres

# If that fails, recreate the service
docker compose up -d --force-recreate postgres
```

---

### Redis Connection Failed

**Symptom**: Cache or session operations fail

**Diagnostic steps**:
```bash
# Check Redis logs
docker compose logs redis

# Test connectivity
docker compose exec redis redis-cli -a redis_secret_password ping
```

**Solution**:
```bash
docker compose restart redis
```

---

### RabbitMQ Connection Failed

**Symptom**: Background jobs not processing

**Diagnostic steps**:
```bash
# Check RabbitMQ logs
docker compose logs rabbitmq

# Test connectivity
docker compose exec rabbitmq rabbitmq-diagnostics -q ping

# Check queue status
docker compose exec rabbitmq rabbitmqctl list_queues
```

**Solution**:
```bash
docker compose restart rabbitmq
```

---

### Kafka Connection Failed

**Symptom**: Events not being published or consumed

**Diagnostic steps**:
```bash
# Check Kafka logs
docker compose logs kafka

# Verify broker is running
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# List topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

**Solution**:
```bash
# Restart Kafka
docker compose restart kafka

# If topics are missing, recreate them (entrypoint.sh handles this)
docker compose up -d --force-recreate kafka
```

---

### List Kafka Topics

```bash
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

---

### Consume Kafka Messages (Debugging)

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning
```

**Pro tip**: Use `--from-beginning` to see all historical messages, or omit it to see only new messages.

---

### Port Already in Use

**Symptom**: Can't start services, port conflict errors

**Find what's using the port**:
```bash
# Linux/Mac
sudo lsof -i :9999
sudo netstat -tulpn | grep 9999

# Windows
netstat -ano | findstr :9999
```

**Solution**: Stop the conflicting service or change ports in `.env`

---

### Rebuild from Scratch

**When to use**: Persistent issues, corrupt volumes, major changes

```bash
# Stop everything and delete volumes
docker compose down -v

# Rebuild all images without cache
docker compose build --no-cache

# Start services
docker compose up -d

# Watch logs during startup
docker compose logs -f
```

**Warning**: This deletes all data (databases, caches, uploaded files). Backup first!

---

### Performance Issues

**Symptoms**: Slow response times, high CPU/memory usage

**Diagnostic steps**:
```bash
# Check container resource usage
docker stats

# Check logs for errors
docker compose logs -f rust | grep -i error

# Check database slow queries (if using PostgreSQL logging)
docker compose exec postgres psql -U app -d blazing_sun -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

**Common causes**:
- Missing database indexes
- N+1 query problems
- Memory leaks
- Kafka/RabbitMQ backlog

---

### SSL Certificate Errors

**Symptom**: Browser warns about self-signed certificate

**Solution for development**: Accept the self-signed certificate in your browser

**Solution for production**: Replace with valid certificates:
```bash
docker cp your-cert.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp your-key.pem rust-nginx-1:/etc/nginx/ssl/key.pem
docker compose restart nginx
```

---

### Environment Variables Not Syncing

**Symptom**: Application uses old configuration

**Solution**:
```bash
# Stop services
docker compose down

# Edit .env file
nano .env

# Rebuild and restart (forces env sync)
docker compose up -d --force-recreate rust
```

**Note**: `rust/entrypoint.sh` syncs env vars on startup. If changes aren't reflected, recreate the container.

---

### SQLx Compile Errors

**Symptom**: Rust build fails with "query not found in .sqlx/"

**Solution**:
```bash
# Enter Rust container
docker compose exec rust bash

# Run migrations
sqlx migrate run

# Prepare query metadata
cargo sqlx prepare

# Exit container and rebuild
exit
docker compose restart rust
```
