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
npm run docker:check  # azure-deploy: builds the 3 images, runs them with a throw-away Postgres (non-superuser admin), checks health / proxy / n8n / migrate / init-db / no secret in logs (~10 min, Docker)
npm run workflow:check # auto-deploy: static check of .github/workflows/deploy.yml + deploy.sh, then the 17 node tests of the deploy scripts (fake az / curl; no Azure)
npm run bicep:check   # azure-deploy: az bicep build + lint + static rules (backend internal, n8n min 1, no secret, …); needs `az bicep install`
npm run drive:auth    # Google Drive one-time OAuth: prints GOOGLE_REFRESH_TOKEN + GOOGLE_DRIVE_CV_FOLDER_ID for .env (Node >= 22: `nvm use` first; needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env)
npm run mail:check    # result email: SMTP login + one test email to the address given, MAIL_REDIRECT_TO or SMTP_USER (never a candidate)
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
- HR sign-in: the backend needs `JWT_SECRET` (≥ 32 chars) and refuses to start without it. Every `/api/hr/*` route is protected by the global `HrAuthGuard` (session = JWT in the httpOnly cookie `cvs_hr_session`); `@nestjs/jwt` stays on 11.x because 12.x is ESM-only and breaks Jest. Details: `docs/features/hr-auth/`.
- Frontend routes: public pages live in the route group `src/app/(public)/` (its layout has the public header / footer), the HR area in `src/app/hr/` (`login/` + `(protected)/`, whose layout checks the session with `GET /api/auth/me`). `src/proxy.ts` (Next.js 16 name of middleware) redirects `/hr/*` without a cookie and sets `no-store` / `noindex`. Server Components read the HR API with `hrBackendGet` (`src/lib/hr-backend.ts`, forwards the cookie, 401 → sign-in page); the HR list state lives in the URL (`src/lib/hr-list-url.ts`). HR forms call the API with `hrRequest` (JSON, on top of `hrFetch`) and show the API error `code` in the UI language (`src/lib/hr-errors.ts`; the code → text maps must cover every key of `HR_POSITION_MESSAGES`, checked by a test). Browser calls to `/api/hr/*` go through `hrFetch` (`src/lib/hr-client.ts`), which sends a 401 back to the sign-in page.
- Frontend: the browser calls `/api/*` on the Next.js origin, rewritten to `BACKEND_URL` (default `http://localhost:3001`, see `packages/frontend/next.config.js`). Public pages are bilingual: UI texts live in `packages/frontend/src/i18n/dictionaries/{en,vi}.ts` (same shape, checked by a test).
- Result email (Phase 4): after HR's final decision the backend saves it, then sends the email over SMTP (`modules/mail`, nodemailer; vars `SMTP_*`, `MAIL_FROM`, optional `MAIL_REPLY_TO`, `MAIL_REDIRECT_TO` — set `MAIL_REDIRECT_TO` in dev so tests never reach real candidates). Templates (ACCEPTED/REJECTED × vi/en, no score or notes) are pure functions in `mail-templates.ts`; language = `applications.locale` stored at submission. A failed send keeps the decision (`result_email_sent_at` stays NULL → "Gửi lại"); `result_email_sent_at` is claimed before sending to prevent duplicates. Details: `docs/features/result-email/`.
- Prisma config lives in `packages/backend/prisma.config.ts`; migrations in `packages/backend/prisma/migrations/` are committed. Database design: `docs/database.md`.

`docker-compose.dev.yml` spins up PostgreSQL (and n8n under the profile `n8n`) — the apps run locally via Node. Production is Azure Container Apps (Phase 5): images from `packages/backend/Dockerfile`, `packages/frontend/Dockerfile`, `n8n/Dockerfile` (build from the repo root; the frontend needs `--build-arg BACKEND_URL=...`, baked in at build), built and pushed to public `ghcr.io` by `.github/workflows/images.yml` (scanned by `scripts/deploy/scan-image.sh` first — the images are public, so no secret may ever be in them); infrastructure in `infra/azure/main.bicep` (n8n runs only 23:50–02:00 by default, `n8nAlwaysOn=true` for always on); steps in `docs/features/azure-deploy/runbook.md`. **Merging into `main` deploys automatically (it runs only on `main`, never when a PR is opened)** (`.github/workflows/deploy.yml`: test → build → scan → push → migrate → backend → frontend → health check (rolls back) → n8n outside 23:50–02:00; a newer run cancels test/build, never a running deploy; one-time OIDC setup `scripts/deploy/setup-github-oidc.sh`, runbook 6.9). Running Bicep by hand: `IMAGE_TAG=$(sh scripts/deploy/current-tag.sh --backend)`, else the apps go back to the old tag. Details: `docs/features/auto-deploy/`. Dev Postgres is `postgres:17-alpine`: a volume holding an older major makes `db:up` fail with "database files are incompatible" — run `npm run db:upgrade`. In dev, n8n (`n8nio/n8n:2.46.6`) also runs in Docker under the compose profile `n8n`, so `npm run db:up` stays Postgres-only.

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

This project is indexed by GitNexus as **cv-ai-scanner** (2765 symbols, 5961 relationships, 227 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
