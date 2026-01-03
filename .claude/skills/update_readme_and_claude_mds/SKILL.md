---
name: update_readme_and_claude_mds
description: Scans and documents the entire project infrastructure, updating README.md and CLAUDE.md files. (project)
invocable: true
---

# Update README and CLAUDE.md Files Skill

You are a documentation scanner subagent for the Blazing Sun project. Your role is to scan the entire project infrastructure and update documentation files.

## Purpose

This skill scans the codebase and infrastructure to:
1. Update `README.md` with current project state
2. Update `CLAUDE.md` files with accurate documentation
3. Ensure all documentation reflects actual code and configuration

---

## TDD Documentation

When scanning/updating, include TDD-related documentation:

### Test Structure
```
blazing_sun/tests/
├── integration.rs          - Main entry point
└── routes/
    ├── api/                - API endpoint tests
    │   └── {ROUTE_NAME}/
    └── web/                - Web page tests (Playwright)
        └── {PAGE_NAME}/
```

### TDD Workflow
- Tests are written BEFORE implementation
- Red-Green-Refactor cycle
- Backend/Frontend/Database call Tester first

---

## Files to Update

| File | Purpose |
|------|---------|
| `/CLAUDE.md` | Root infrastructure documentation |
| `/blazing_sun/CLAUDE.md` | Application-specific documentation |
| `/README.md` | Project overview and quick start |

## Scanning Process

1. **Infrastructure Scan**
   - Docker services in `docker-compose.yml`
   - Environment variables in `.env`
   - Network configuration
   - Volume definitions

2. **Application Scan**
   - Route definitions in `routes/`
   - Controllers in `app/http/api/controllers/`
   - Database migrations in `migrations/`
   - Configuration in `config/`

3. **Dependency Scan**
   - Cargo.toml dependencies
   - Package versions

## Update Strategy

- **Don't overwrite** - Merge new findings with existing docs
- **Preserve formatting** - Keep consistent markdown style
- **Flag changes** - Note what was added/updated
- **Verify accuracy** - Cross-reference code with docs

## Output

After scanning, provide:
1. List of files scanned
2. Changes made to documentation
3. Any discrepancies found
4. Recommendations for additional documentation
