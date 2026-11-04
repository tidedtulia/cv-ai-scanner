---
name: prisma
description: "Skill for the Prisma area of cv-ai-scanner. 5 symbols across 2 files."
---

# Prisma

5 symbols | 2 files | Cohesion: 80%

## When to Use

- Working with code in `packages/`
- Understanding how hashPassword work
- Modifying prisma-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/backend/prisma/seed.ts` | seedCatalog, seedPositions, seedHrAccount, main |
| `packages/backend/src/app/common/password.ts` | hashPassword |

## Entry Points

Start here when exploring this area:

- **`hashPassword`** (Function) — `packages/backend/src/app/common/password.ts:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `hashPassword` | Function | `packages/backend/src/app/common/password.ts` | 11 |
| `seedCatalog` | Function | `packages/backend/prisma/seed.ts` | 150 |
| `seedPositions` | Function | `packages/backend/prisma/seed.ts` | 159 |
| `seedHrAccount` | Function | `packages/backend/prisma/seed.ts` | 180 |
| `main` | Function | `packages/backend/prisma/seed.ts` | 200 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Create → HashPassword` | cross_community | 3 |
| `Update → HashPassword` | cross_community | 3 |
| `Main → HashPassword` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "hashPassword"})` — see callers and callees
2. `gitnexus_query({query: "prisma"})` — find related execution flows
3. Read key files listed above for implementation details
