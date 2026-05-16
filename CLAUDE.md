# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nx monorepo with three packages:
- **`packages/backend`** — NestJS API (port 3001, global prefix `/api`), Prisma ORM, PostgreSQL
- **`packages/frontend`** — Next.js 16 app (React 19)
- **`packages/shared`** — Shared DTOs, types, constants, and validation utilities imported by both apps

## Commands

```bash
# Install dependencies
npm install

# Start everything (backend + frontend)
npm run dev

# Start DB only (Docker)
npm run db:up

# Build all packages
npm run build

# Run all tests
npm test

# Run tests for a single package (e.g. backend)
npx nx test @org/backend

# Lint all
npx nx run-many -t lint --all

# Prisma — regenerate client after schema changes
cd packages/backend && npx prisma generate

# Prisma — create a migration
cd packages/backend && npx prisma migrate dev --name <migration_name>
```

## Environment Setup

Create `packages/backend/.env` (or root `.env`) with:

```
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=your_db
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_db
PORT=3001
```

The Docker Compose files (`docker-compose.dev.yml` for dev, `docker-compose.prod.yml` for prod) spin up PostgreSQL only — the apps run locally via Node.

## Architecture

- **Backend** uses NestJS modules. Each domain lives under `packages/backend/src/app/modules/<domain>/` with controller, service, repository, and module files. `PrismaService` (a global NestJS service) wraps the Prisma client and is provided via `PrismaModule`.
- **Shared** package (`@org/shared`) is the source of truth for DTOs and types. Import from here rather than duplicating types in either app.
- **Nx** orchestrates builds and tasks. Target names: `build`, `serve`, `test`, `lint`. The backend uses Webpack (with HMR in dev) instead of the default `tsc` output.
- HMR is enabled for the backend in development via `webpack-hmr.config.js`.

<!-- gitnexus:start -->
## GitNexus — Code Intelligence

This project is indexed by GitNexus as **cv-ai-scanner** (195 symbols, 297 relationships, 5 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

### Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping.
- When you need full context on a specific symbol, use `gitnexus_context({name: "symbolName"})`.

### Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

### Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cv-ai-scanner/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cv-ai-scanner/clusters` | All functional areas |
| `gitnexus://repo/cv-ai-scanner/processes` | All execution flows |
| `gitnexus://repo/cv-ai-scanner/process/{name}` | Step-by-step execution trace |

### Skill Files

| Task | Skill file |
|------|------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
| Work in the Users area (15 symbols) | `.claude/skills/generated/users/SKILL.md` |

<!-- gitnexus:end -->
