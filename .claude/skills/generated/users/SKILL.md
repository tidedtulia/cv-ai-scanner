---
name: users
description: "Skill for the Users area of cv-ai-scanner. 15 symbols across 3 files."
---

# Users

15 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `packages/`
- Understanding how create, create, create work
- Modifying users-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/backend/src/app/modules/users/users.service.ts` | create, findAll, findOne, update, remove |
| `packages/backend/src/app/modules/users/users.repository.ts` | create, findAll, findById, update, delete |
| `packages/backend/src/app/modules/users/users.controller.ts` | create, findAll, findOne, update, remove |

## Entry Points

Start here when exploring this area:

- **`create`** (Method) — `packages/backend/src/app/modules/users/users.service.ts:8`
- **`create`** (Method) — `packages/backend/src/app/modules/users/users.repository.ts:8`
- **`create`** (Method) — `packages/backend/src/app/modules/users/users.controller.ts:9`
- **`findAll`** (Method) — `packages/backend/src/app/modules/users/users.service.ts:12`
- **`findAll`** (Method) — `packages/backend/src/app/modules/users/users.repository.ts:16`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `create` | Method | `packages/backend/src/app/modules/users/users.service.ts` | 8 |
| `create` | Method | `packages/backend/src/app/modules/users/users.repository.ts` | 8 |
| `create` | Method | `packages/backend/src/app/modules/users/users.controller.ts` | 9 |
| `findAll` | Method | `packages/backend/src/app/modules/users/users.service.ts` | 12 |
| `findAll` | Method | `packages/backend/src/app/modules/users/users.repository.ts` | 16 |
| `findAll` | Method | `packages/backend/src/app/modules/users/users.controller.ts` | 14 |
| `findOne` | Method | `packages/backend/src/app/modules/users/users.service.ts` | 16 |
| `findById` | Method | `packages/backend/src/app/modules/users/users.repository.ts` | 12 |
| `findOne` | Method | `packages/backend/src/app/modules/users/users.controller.ts` | 19 |
| `update` | Method | `packages/backend/src/app/modules/users/users.service.ts` | 20 |
| `update` | Method | `packages/backend/src/app/modules/users/users.repository.ts` | 20 |
| `update` | Method | `packages/backend/src/app/modules/users/users.controller.ts` | 24 |
| `remove` | Method | `packages/backend/src/app/modules/users/users.service.ts` | 24 |
| `delete` | Method | `packages/backend/src/app/modules/users/users.repository.ts` | 27 |
| `remove` | Method | `packages/backend/src/app/modules/users/users.controller.ts` | 29 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Create → Create` | intra_community | 3 |
| `Update → Update` | intra_community | 3 |
| `Remove → Delete` | intra_community | 3 |
| `FindAll → FindAll` | intra_community | 3 |
| `FindOne → FindById` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "create"})` — see callers and callees
2. `gitnexus_query({query: "users"})` — find related execution flows
3. Read key files listed above for implementation details
