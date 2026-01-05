---
title: Agent - database
scope: /home/milner/Desktop/rust/.claude/agents/database
---

# Agent: database

**Source**: `/home/milner/Desktop/rust/.claude/agents/database.md`

**Role**: Schema, migrations, stored procedures, queries.  
**Prefix**: `[DB]`  
**Maps to skill**: `database`.

**Key rules**
- TDD-first.
- Run `cargo sqlx prepare` after query changes.
- Document schema changes.
