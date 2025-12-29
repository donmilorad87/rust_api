---
name: update_readme_and_claude_mds
description: Scans and documents the entire project infrastructure, updating README.md and CLAUDE.md files.
---

# Document Infrastructure Command

This command scans and documents the entire project infrastructure.

## Instructions

You will perform a comprehensive documentation update for this project. Follow these steps in order:

### Phase 1: Root Folder Infrastructure Analysis

1. **Scan the root folder** including all hidden folders and files:
   - Use `ls -la` and `find` to discover all files and directories
   - Pay special attention to `.env`, `.env.example`, hidden config folders
   - Identify all Docker-related files

2. **Analyze docker-compose.yml**:
   - Read and understand all services defined
   - Note container names, ports, networks, volumes
   - Understand service dependencies and healthchecks
   - Document the startup sequence

3. **Analyze each Docker image folder**:
   - Read Dockerfile and entrypoint scripts for each service
   - Understand configuration files (nginx config, postgres config, redis config, etc.)
   - Note any custom scripts or initialization logic

4. **Analyze environment files**:
   - Read `.env` and `.env.example`
   - Document all environment variables and their purposes
   - Note which services use which variables

### Phase 2: Update Root Documentation

5. **Update README.md** (for humans):
   - Write a clear project overview
   - Include a visual architecture diagram (ASCII)
   - Document all services with their IPs, ports, and purposes
   - Explain the Docker network topology
   - Add startup/shutdown commands
   - Include troubleshooting section
   - Add environment variable reference
   - Be very detailed and human-friendly

6. **Update CLAUDE.md** (for AI understanding):
   - Write comprehensive infrastructure documentation
   - Include service reference table with IPs and ports
   - Document the message broker strategy (RabbitMQ vs Kafka use cases)
   - Add Docker commands reference
   - Include common issues and solutions
   - Document file locations and purposes
   - Be very detailed so future AI sessions understand the infrastructure
   - Note: For money_flow folder, just write 2-3 sentences saying it contains the application code and has its own README.md and CLAUDE.md

### Phase 3: Application Documentation (money_flow/)

7. **Scan money_flow folder**:
   - Read Cargo.toml for dependencies and features
   - Scan all source files in `src/`
   - Understand the module structure
   - Identify all controllers, routes, middleware
   - Understand the database layer
   - Analyze event system (Kafka) and job system (RabbitMQ)

8. **Update money_flow/README.md** (for humans):
   - Write project overview
   - Document tech stack with crate names
   - Include complete folder/file tree structure
   - Explain application lifecycle (startup sequence)
   - Document all API endpoints
   - Explain controllers and their responsibilities
   - Document database schema
   - Include development commands
   - Be very detailed

9. **Update money_flow/CLAUDE.md** (for AI understanding):
   - Write comprehensive module documentation
   - Include complete folder structure with file descriptions
   - Explain each module's purpose and contents
   - Document the configuration pattern
   - Explain AppState and database connection
   - Document event-driven architecture (Kafka topics, handlers)
   - Document message queue jobs (RabbitMQ workers)
   - Document storage system
   - Include all API endpoints with handlers
   - Document database schema and queries
   - Add "how to add new features" guides
   - Be extremely detailed so future AI sessions can work effectively

## Output

After completing all phases, provide a summary of what was documented and any notable findings about the project structure.


## Documentation

You will scan for every web rout and every api route and you will list all routes. You will also show some example how routes are used and how routes are working

## Uplaods

You will explain how uplaods work, how private and publc is working, how we display public and how we display private picture and where asets are stored.

## Permisions

You will explain what permisions are here in system

## Templates

You will explan how we work with templates and how frontend projects are constructed, how every page have its own frontend project to awoid unused css and unused js.

## Output 2.0

You will create folder called Documentation. Thgat folder will be in the root of the project, in the level with docker-compose. Iniside of that project you will add 2 foldeers, one is docker_infrastructure other is money_flow project. Now add inside of docker infrastructure INFRASTRUCTURE.md where infrastructure will be expalined into full details, realy full, dont skip anything. After docker infrastrcuture you will go to money flow where you will create folder Routes, and inside of routes there will be Web and Api. Web will have all web routes documented and api all api routes. You will also create folder called Bootstrap, inisde of bootstrap you will list src/bootstrap componentes and explain it. You will explain how uploads work, you will create separate .md file for everything. I want full details inside of documentations. I want to docs be ultra detailed so anybody could understand full logics. I want every function explained every controller, everything. 100% coverage of explanations.

## Update skills and agents

Update all agents from /home/milner/Desktop/rust/.claude/agents and all skills from /home/milner/Desktop/rust/.claude/skills accordingly. you will scan all code with 1000% details. So you will know what is new and you will upgrade skills and agents, you wont remove anything, you will just add new thing in skills and agents.