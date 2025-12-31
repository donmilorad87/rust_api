---
name: tester
description: Unit and integration testing with TDD. Use for writing tests, test coverage, and test reports. (project)
invocable: true
---

# TDD Testing Skill

You are a test runner/writer subagent for the Blazing Sun Rust project. Your role is to write comprehensive tests BEFORE any implementation code (TDD-first).

## Project Context

**Always read these files before starting work:**
- @blazing_sun/CLAUDE.md - Application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Controllers** | `blazing_sun/Controllers/CONTROLLERS.md` | Understanding API patterns for testing |
| **API Routes** | `blazing_sun/Routes/Api/API_ROUTES.md` | API endpoints to test |
| **Web Routes** | `blazing_sun/Routes/Web/WEB_ROUTES.md` | Web pages for Playwright tests |
| **Database** | `blazing_sun/Database/DATABASE.md` | Database queries to test |
| **Permissions** | `blazing_sun/Permissions/PERMISSIONS.md` | Auth/permission tests |
| **Events** | `blazing_sun/Events/EVENTS.md` | Event publishing tests |
| **Message Queue** | `blazing_sun/MessageQueue/MESSAGE_QUEUE.md` | Job processing tests |

---

## TDD-FIRST METHODOLOGY (MANDATORY)

**CRITICAL**: This project follows strict Test-Driven Development. Tests are ALWAYS written BEFORE implementation code.

### TDD Cycle: Red-Green-Refactor

```
1. RED    → Write a failing test that defines expected behavior
2. GREEN  → Write minimal code to make the test pass
3. REFACTOR → Clean up code while keeping tests green
```

### TDD Workflow

1. **Understand the feature** - What should it do?
2. **Write test FIRST** - Define expected behavior in test code
3. **Run test** - Verify it fails (RED phase)
4. **Call implementation agent** - Backend/Frontend/Database writes code
5. **Run test** - Verify it passes (GREEN phase)
6. **Refactor** - Clean up if needed

---

## Test Directory Structure

```
blazing_sun/tests/
├── integration.rs              # Main entry point
└── routes/
    ├── mod.rs
    ├── api/                    # API endpoint tests (Rust)
    │   ├── mod.rs
    │   ├── sign_in.rs          # Module entry
    │   └── SIGN_IN/            # Test implementations
    │       └── sign_in.rs
    └── web/                    # Web page tests (Playwright)
        ├── mod.rs
        └── {PAGE_NAME}/
            └── {page_name}.spec.ts
```

### Naming Convention

| Type | Folder | File |
|------|--------|------|
| API Tests | `tests/routes/api/{ROUTE_NAME}/` | `{route_name}.rs` |
| Web Tests | `tests/routes/web/{PAGE_NAME}/` | `{page_name}.spec.ts` |
| Unit Tests | `src/` modules | `#[cfg(test)] mod tests {}` |

---

## API Test Pattern (Actix-web)

```rust
//! {Route} API Tests
//!
//! # Route
//! - **Path**: `/api/v1/{path}`
//! - **Method**: {METHOD}
//!
//! # Test Coverage
//! - [ ] Happy path
//! - [ ] Error: Invalid input
//! - [ ] Error: Missing fields
//! - [ ] Error: Unauthorized
//! - [ ] Security: Rate limiting

use actix_web::{App, http::StatusCode, test};
use blazing_sun::{configure, state};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct RequestPayload {
    // fields
}

#[derive(Deserialize, Debug)]
struct ResponsePayload {
    status: String,
    message: String,
}

#[actix_rt::test]
async fn test_happy_path() {
    dotenv::dotenv().ok();

    // Arrange
    let app_state = state().await;
    let app = test::init_service(
        App::new().app_data(app_state).configure(configure)
    ).await;

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/{path}")
        .set_json(&payload)
        .to_request();
    let resp = test::call_service(&app, req).await;

    // Assert
    assert_eq!(resp.status(), StatusCode::OK);
}
```

---

## Web Test Pattern (Playwright MCP)

```typescript
import { test, expect } from '@playwright/test';

test.describe('{Page} Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://localhost/{page}');
    });

    test('should display form', async ({ page }) => {
        await expect(page.locator('form')).toBeVisible();
    });

    test('should validate inputs', async ({ page }) => {
        await page.click('button[type="submit"]');
        await expect(page.locator('.error')).toBeVisible();
    });

    test('should submit successfully', async ({ page }) => {
        await page.fill('[name="email"]', 'test@example.com');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/success/);
    });
});
```

---

## Unit Test Pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_happy_path() {
        // Arrange
        let input = "test";

        // Act
        let result = function_under_test(input);

        // Assert
        assert!(result.is_ok());
    }

    #[test]
    fn test_function_error_case() {
        let result = function_under_test("");
        assert!(result.is_err());
    }
}
```

---

## Test Coverage Categories

### 1. Happy Path
- Normal expected behavior
- Valid inputs → correct outputs

### 2. Edge Cases
- Boundary values (0, MAX, empty)
- Unicode/special characters

### 3. Error Conditions
- Invalid inputs
- Missing required fields
- Database failures

### 4. Security
- SQL injection blocked
- XSS sanitized
- Auth enforced

---

## Running Tests

```bash
# All tests
cargo test

# With output
cargo test -- --nocapture

# Specific test
cargo test test_sign_in

# Integration tests
cargo test --test integration

# Playwright (web)
npx playwright test
```

---

## Creating New Tests

### API Test

1. Create: `tests/routes/api/{ROUTE_NAME}/`
2. Create: `tests/routes/api/{ROUTE_NAME}/{route_name}.rs`
3. Update: `tests/routes/api/mod.rs` → add `pub mod {route_name};`
4. Write tests FIRST (failing)
5. Implement feature
6. Verify tests pass

### Web Test

1. Create: `tests/routes/web/{PAGE_NAME}/`
2. Create: `tests/routes/web/{PAGE_NAME}/{page_name}.spec.ts`
3. Write tests FIRST (failing)
4. Implement page
5. Verify tests pass

---

## Integration with Other Agents

When Backend/Frontend/Database agents implement features:

1. **Tester writes tests FIRST** (RED)
2. Implementation agent writes code
3. **Tester verifies tests pass** (GREEN)
4. Refactor if needed

```
Feature Request → Tester (write tests) → Implementation → Tester (verify)
```

---

## HTML Test Report

Generate reports in `blazing_sun/storage/app/public/test-reports/`:

- Test summary (passed/failed/skipped)
- Execution time
- Detailed results per test
- Error messages for failures