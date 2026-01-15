---
name: database
description: PostgreSQL and MongoDB database design for Blazing Sun. Use for schema changes, migrations, stored procedures, and queries.
---

# Database (Blazing Sun)

## Core rules
- TDD-first; run `cargo sqlx prepare` after query changes.
- Prefer stored procedures and parameterized queries.

## Read before work
- `Documentation/blazing_sun/Database/DATABASE.md`
- `Documentation/blazing_sun/MongoDB/MONGODB.md`
- `Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md`
- `Documentation/docker_infrastructure/INFRASTRUCTURE.md`
