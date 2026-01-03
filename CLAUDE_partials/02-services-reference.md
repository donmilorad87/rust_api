# Services Reference

## Services Table

| Service    | IP           | Port(s)       | Healthcheck                          | Purpose                              |
|------------|--------------|---------------|--------------------------------------|--------------------------------------|
| rust       | 172.28.0.10  | 9999          | -                                    | Actix-web application                |
| postgres   | 172.28.0.11  | 5432          | `pg_isready -U app -d blazing_sun`    | PostgreSQL database                  |
| nginx      | 172.28.0.12  | 80/443        | -                                    | SSL reverse proxy + static files     |
| redis      | 172.28.0.13  | 6379          | `redis-cli -a password ping`         | Cache/session store                  |
| rabbitmq   | 172.28.0.14  | 5672/15672    | `rabbitmq-diagnostics -q ping`       | Message queue (async tasks)          |
| prometheus | 172.28.0.15  | 9090          | -                                    | Metrics collection                   |
| grafana    | 172.28.0.16  | 3000          | -                                    | Monitoring dashboards                |
| kafka      | 172.28.0.17  | 9092/9093     | Broker API + topics exist            | Event streaming (KRaft mode)         |
| kafka-ui   | 172.28.0.18  | 8080          | -                                    | Kafka management UI                  |
| pgadmin    | 172.28.0.19  | 5050          | -                                    | PostgreSQL admin panel               |

**Network**: `devnet` (172.28.0.0/16)

## Startup Sequence & Dependencies

Services start with proper healthcheck-based dependencies:

```
Phase 1: Infrastructure (parallel start)
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │  RabbitMQ    │ │    Kafka     │
│ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │
│ pg_isready   │ │ redis-cli    │ │ rabbitmq-    │ │ broker API + │
│              │ │   ping       │ │ diagnostics  │ │ topics exist │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                                │
                                ▼
Phase 2: Application (waits for Phase 1 healthy)
┌─────────────────────────────────────────────────────────────────┐
│                           Rust App                               │
│   depends_on: postgres(healthy), redis(healthy),                 │
│               rabbitmq(healthy), kafka(healthy)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
Phase 3: UI Services
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Nginx   │ │ Kafka UI │ │ pgAdmin  │ │ Grafana  │
│(on rust) │ │(on kafka)│ │(on pg)   │ │(on prom) │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```
