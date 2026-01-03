# CLAUDE_partials

This directory contains the split documentation for the Blazing Sun application.

## Organization

The main `CLAUDE.md` file has been split into 15 focused documents for better navigation and maintenance:

| File | Topic | Lines |
|------|-------|-------|
| 01-overview.md | Application overview and tech stack | 24 |
| 02-project-structure.md | Complete directory structure | 191 |
| 03-modules.md | Main modules (main.rs, lib.rs) | 27 |
| 04-configuration.md | Configuration pattern and AppState | 77 |
| 05-database-queries.md | Database read and mutation operations | 53 |
| 06-event-driven.md | Kafka event system | 134 |
| 07-rabbitmq-jobs.md | RabbitMQ job queue | 53 |
| 08-storage-system.md | File storage abstraction | 64 |
| 09-api-endpoints.md | REST API endpoints | 64 |
| 10-admin-theme.md | Admin theme configuration system | 332 |
| 11-named-routes.md | Laravel-like named routes with i18n | 170 |
| 12-database-schema.md | Database tables and schema | 50 |
| 13-adding-features.md | Guides for adding new features | 42 |
| 14-development.md | Development commands and workflow | 32 |
| 15-important-notes.md | Important reminders and patterns | 43 |

## Usage

The main `CLAUDE.md` file contains:
- Table of contents with links to all partials
- Quick reference section for common operations
- Important reminders

Each partial file is self-contained and covers a specific topic in depth.

## Benefits

1. **Easier Navigation**: Find specific topics quickly
2. **Better Maintenance**: Update individual sections without touching unrelated content
3. **Cleaner Organization**: Each file has a single, focused purpose
4. **Improved Readability**: Smaller files are easier to read and understand
5. **Version Control**: Clearer diffs when making changes
