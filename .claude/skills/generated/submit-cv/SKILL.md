---
name: submit-cv
description: "Skill for the Submit-cv area of cv-ai-scanner. 9 symbols across 5 files."
---

# Submit-cv

9 symbols | 5 files | Cohesion: 100%

## When to Use

- Working with code in `packages/`
- Understanding how SubmitCvForm, clearError, PositionSelect work
- Modifying submit-cv-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx` | SubmitCvForm, clearError, validate, handleSubmit |
| `packages/frontend/src/components/submit-cv/CvUploadField.tsx` | CvUploadField, isAcceptedCvFile |
| `packages/frontend/src/components/submit-cv/PositionSelect.tsx` | PositionSelect |
| `packages/frontend/src/components/submit-cv/PositionRequirements.tsx` | PositionRequirements |
| `packages/frontend/src/app/submit-cv/page.tsx` | SubmitCvPage |

## Entry Points

Start here when exploring this area:

- **`SubmitCvForm`** (Function) — `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx:18`
- **`clearError`** (Function) — `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx:28`
- **`PositionSelect`** (Function) — `packages/frontend/src/components/submit-cv/PositionSelect.tsx:10`
- **`PositionRequirements`** (Function) — `packages/frontend/src/components/submit-cv/PositionRequirements.tsx:6`
- **`CvUploadField`** (Function) — `packages/frontend/src/components/submit-cv/CvUploadField.tsx:18`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `SubmitCvForm` | Function | `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx` | 18 |
| `clearError` | Function | `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx` | 28 |
| `PositionSelect` | Function | `packages/frontend/src/components/submit-cv/PositionSelect.tsx` | 10 |
| `PositionRequirements` | Function | `packages/frontend/src/components/submit-cv/PositionRequirements.tsx` | 6 |
| `CvUploadField` | Function | `packages/frontend/src/components/submit-cv/CvUploadField.tsx` | 18 |
| `SubmitCvPage` | Function | `packages/frontend/src/app/submit-cv/page.tsx` | 7 |
| `validate` | Function | `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx` | 32 |
| `handleSubmit` | Function | `packages/frontend/src/components/submit-cv/SubmitCvForm.tsx` | 51 |
| `isAcceptedCvFile` | Function | `packages/frontend/src/components/submit-cv/CvUploadField.tsx` | 8 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SubmitCvPage → ClearError` | intra_community | 3 |
| `SubmitCvPage → PositionSelect` | intra_community | 3 |
| `SubmitCvPage → PositionRequirements` | intra_community | 3 |
| `SubmitCvPage → CvUploadField` | intra_community | 3 |
| `HandleSubmit → IsAcceptedCvFile` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "SubmitCvForm"})` — see callers and callees
2. `gitnexus_query({query: "submit-cv"})` — find related execution flows
3. Read key files listed above for implementation details
