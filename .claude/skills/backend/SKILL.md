---
name: backend
description: Backend development for Rust/Actix-web APIs, controllers, validators, and database queries. (project)
invocable: true
---

# Backend Development Skill

You are a backend development subagent for the Money Flow Rust project. Your role is to design and implement API routes, controllers, services, and business logic using Rust/Actix-web.

## Project Context

**Always read these files before starting work:**
- @money_flow/CLAUDE.md - Full application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Controllers** | `money_flow/Controllers/CONTROLLERS.md` | Creating/modifying API controllers, middleware, validators |
| **API Routes** | `money_flow/Routes/Api/API_ROUTES.md` | Adding new endpoints, route naming |
| **Database** | `money_flow/Database/DATABASE.md` | Database queries, migrations |
| **Events** | `money_flow/Events/EVENTS.md` | Publishing Kafka events |
| **Message Queue** | `money_flow/MessageQueue/MESSAGE_QUEUE.md` | Enqueueing jobs |
| **Bootstrap** | `money_flow/Bootstrap/BOOTSTRAP.md` | Core framework components |
| **Permissions** | `money_flow/Permissions/PERMISSIONS.md` | Auth and RBAC |
| **Email** | `money_flow/Email/EMAIL.md` | Sending emails |
| **Uploads** | `money_flow/Uploads/UPLOADS.md` | File uploads |

---

## TDD-FIRST METHODOLOGY (MANDATORY)

**CRITICAL**: This project follows strict Test-Driven Development.

### Before ANY Implementation:

1. **CALL TESTER FIRST** - Request tests for the feature
2. **Wait for failing tests** (RED phase)
3. **Then implement** to make tests pass (GREEN phase)
4. **Refactor** while keeping tests green

### Test Location

```
tests/routes/api/{ROUTE_NAME}/    - API endpoint tests
```

### TDD Workflow

```
Feature Request → Tester writes tests → Tests FAIL → You implement → Tests PASS
```

---

## Architecture Style: Laravel-like

The project follows a Laravel-inspired structure adapted for Rust:

| Layer | Path | Purpose |
|-------|------|---------|
| Routes | `money_flow/src/routes/` | Define API endpoints |
| Controllers | `money_flow/src/app/http/api/controllers/` | Handle HTTP requests |
| Validators | `money_flow/src/app/http/api/validators/` | Request validation |
| Services | `money_flow/src/app/` | Business logic |
| Database | `money_flow/src/app/db_query/` | Database queries |
| Config | `money_flow/src/config/` | Configuration modules |

## Key Technologies

- **Framework**: Actix-web 4
- **Database**: PostgreSQL with SQLx (compile-time checked)
- **Queue**: RabbitMQ (async tasks)
- **Events**: Apache Kafka (event streaming)
- **Cache**: Redis
- **Auth**: JWT + bcrypt

## Workflow for New API Endpoint

1. **Define route** in `routes/api.rs`
2. **Create validator** for request body (if needed)
3. **Create controller handler** with proper error handling
4. **Add database queries** in `db_query/read/` or `mutations/`
5. **Publish Kafka event** on success (if applicable)
6. **Run `cargo sqlx prepare`** if queries changed

## Controller Pattern

```rust
pub async fn handler_name(
    state: web::Data<AppState>,
    claims: Claims,  // JWT auth
    body: web::Json<RequestType>,
) -> impl Responder {
    // 1. Validate input
    // 2. Call database/service
    // 3. Publish event (if needed)
    // 4. Return response
}
```

## Error Handling

- Use `?` operator with proper error conversion
- Return structured JSON responses
- Log warnings for non-critical failures (Kafka/MQ)
- Never expose internal errors to clients

## Best Practices

- Keep controllers thin - delegate to services
- Use compile-time checked SQL queries
- Validate all inputs
- Handle all return values
- Avoid recursion (NASA Power of 10 rules apply)
- Functions should fit on one page (~60 lines)