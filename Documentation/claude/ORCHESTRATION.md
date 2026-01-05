---
title: Orchestration Guide
scope: /home/milner/Desktop/rust/.claude
---

# Orchestration Guide

This document is the entry point for coordinating skills, agents, and commands.
Use it to decide which agent/skill to invoke and in what order.

## Primary Rule: TDD First

1. Call Tester to write failing tests (RED).
2. Call implementation agents (Backend/Frontend/Database) to pass tests (GREEN).
3. Re-run tests and refactor.
4. Update docs if behavior changed.

## Backend-First Philosophy

Prefer backend solutions before frontend changes. Frontend should only handle
UI interactions that cannot be done server-side.

## Reference Index

Skills summary: `Documentation/claude/skills/README.md`  
Agents summary: `Documentation/claude/agents/README.md`  
Commands summary: `Documentation/claude/commands/README.md`

## Source of Truth

When in doubt, open the original files under:
- `/home/milner/Desktop/rust/.claude/skills/`
- `/home/milner/Desktop/rust/.claude/agents/`
- `/home/milner/Desktop/rust/.claude/commands/`
