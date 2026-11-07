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

# Prisma — create a migration (commit the generated folder)
cd packages/backend && npx prisma migrate dev --name <migration_name>

# Prisma — seed categories, levels, sample positions, first HR account (idempotent)
cd packages/backend && npx prisma db seed

# Postgres: full dump of the running dev DB → tmp/db-backups/ (gitignored); db:upgrade moves the data to a new major version
npm run db:backup
npm run db:upgrade    # stop `npm run dev` and `npm run n8n:down` first; keeps the old data as volume <volume>-pg<old>

# n8n (Docker, profile "n8n"; needs the N8N_* / *_DB_PASSWORD vars in .env)
npm run n8n:up        # db + n8n-init (database n8n, roles, grants) + n8n (recreated each run; imports + publishes n8n/workflows/) on http://localhost:5678
npm run n8n:check     # smoke-check: roles / grants / owner / credentials / timezone (read-only)
npm run mcp:check     # MCP server (/mcp/cv-scanner): auth, tool list, get_position_requirements, injection, no candidate data
npm run wf1:test      # WF-1 scoring Code node (runs the code inside n8n/workflows/cvScannerWf1.json; free)
npm run wf1:check     # WF-1 end to end: 5 test CVs through the backend + real Drive + Claude (~7 calls), then cleans up
npm run n8n:export    # workflows → n8n/workflows/*.json (commit them); n8n:import does the reverse
npm run n8n:logs
npm run n8n:down      # stop n8n only; `npm run db:down` stops everything (data kept)
```

## Environment Setup

- **Node ≥ 22** (`nvm use` reads `.nvmrc`). Prisma 7 does not run on Node 18.
- Copy `.env.example` to **root** `.env`. It is read by `docker-compose.dev.yml`, the backend and the Prisma CLI (`packages/backend/prisma.config.ts` loads `packages/backend/.env` and the root `.env`).
- If a local PostgreSQL already uses port 5432, set `POSTGRES_PORT` (and the port in `DATABASE_URL`) to e.g. 5433.
- CV storage: `CV_STORAGE=local` (files in `tmp/cv-uploads`) for dev, `google-drive` for real — setup in `docs/features/submit-application-api/google-drive-setup.md`. The backend refuses to start without a valid `CV_STORAGE`.
- Nx loads the root `.env` into every project, so `PORT=3001` (backend) also reaches Next.js — the frontend targets pin `--port 3000` for that reason.
- Frontend: the browser calls `/api/*` on the Next.js origin, rewritten to `BACKEND_URL` (default `http://localhost:3001`, see `packages/frontend/next.config.js`). Public pages are bilingual: UI texts live in `packages/frontend/src/i18n/dictionaries/{en,vi}.ts` (same shape, checked by a test).
- Prisma config lives in `packages/backend/prisma.config.ts`; migrations in `packages/backend/prisma/migrations/` are committed. Database design: `docs/database.md`.

The Docker Compose files (`docker-compose.dev.yml` for dev, `docker-compose.prod.yml` for prod) spin up PostgreSQL only — the apps run locally via Node. Dev Postgres is `postgres:17-alpine`: a volume holding an older major makes `db:up` fail with "database files are incompatible" — run `npm run db:upgrade`. In dev, n8n (`n8nio/n8n:2.46.6`) also runs in Docker under the compose profile `n8n`, so `npm run db:up` stays Postgres-only.

- n8n setup lives in `n8n/setup/`:
  - `init-db.sh`: database `n8n`, roles `n8n` / `n8n_app` / `mcp_readonly` and **all their GRANTs**. These are not in Prisma migrations. When a migration adds a table that n8n or MCP needs, add its GRANT to `init-db.sh` and to the expected sets in `check-db.sh`.
  - `entrypoint.sh`: owner from `.env`, the credentials with fixed ids (`cvScannerN8nApp`, `cvScannerMcpRead`, `cvScannerMcpToken`, `cvScannerAnthropic`, `cvScannerGoogleDrive`), then imports the workflows of `n8n/workflows/` and publishes those exported with `"active": true`. n8n workflows in the repo are the source of truth: after editing one in the UI run `npm run n8n:export`.
  - Details: `docs/features/n8n-docker-setup/`.
- Docker Compose reads `.env` differently from dotenv / `node --env-file`: `#` only starts a comment after a space, and `$` is interpolated. Single-quote values that contain `#`, `$` or spaces.

## Feature workflow (scenario-first)

Every feature has its own branch (`feature/<name>`) and folder `docs/features/<name>/`. Example: `docs/features/fe-public-pages/`.

1. **Analyse** — ask about anything unclear or undecided (with a recommended option), and record the answers in the feature's decision table and, for project-wide choices, in `docs/project-overview.md` (D…).
2. **`requirements.md`** — once analysis is done, write the acceptance criteria as **scenarios**: `AC-n` IDs, in Given / When / Then form (Vietnamese text, Gherkin keywords; use a table for rule lists). Also include scope, decisions, and a **"Kiểm thử" table that maps each AC to its test file(s)**. Get the scenarios reviewed before coding.
3. **`tasks.md`** — the checklist of implementation steps, test results and real runs (by AC ID).
4. **Tests** — every scenario is covered, and every test title or scenario references its AC ID:
   - Frontend: Gherkin `.feature` + `*.steps.spec.tsx` (jest-cucumber, Testing Library) next to the page or component under `__tests__/`, plus unit tests. Shared mocks and fixtures live in `packages/frontend/src/test-utils/`. Async Server Components are rendered with `renderPage()`.
   - Backend: Jest unit tests (`*.spec.ts`). When a behaviour lives in Nest or multer config (limits, filters, pipes), use an HTTP spec with a real Nest app (`app.listen(0)` + `fetch`) and the services mocked.
   - Only what needs a real environment (proxy, Google Drive) is verified by hand, and recorded in `tasks.md`.
   - Infra features with no FE / BE code (e.g. `n8n-docker-setup`): a smoke-check script that verifies each AC on the real environment (`npm run n8n:check`), plus manual checks recorded in `tasks.md`.

## Architecture

- **Backend** uses NestJS modules. Each domain lives under `packages/backend/src/app/modules/<domain>/` with controller, service, repository, and module files. `PrismaService` (a global NestJS service) wraps the Prisma client and is provided via `PrismaModule`.
- **Shared** package (`@org/shared`) is the source of truth for DTOs and types. Import from here rather than duplicating types in either app.
- **Nx** orchestrates builds and tasks. Target names: `build`, `serve`, `test`, `lint`. The backend uses Webpack (with HMR in dev) instead of the default `tsc` output.
- HMR is enabled for the backend in development via `webpack-hmr.config.js`.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cv-ai-scanner** (1421 symbols, 2330 relationships, 54 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cv-ai-scanner/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cv-ai-scanner/clusters` | All functional areas |
| `gitnexus://repo/cv-ai-scanner/processes` | All execution flows |
| `gitnexus://repo/cv-ai-scanner/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
