# JDSwap — Project Context

## Overview
JDSwap is a Next.js app that tailors resumes to job descriptions using Gemini and produces stable, one-page export artifacts.
The app maintains canonical pagination/layout behavior across DOCX and PDF outputs and shows exact artifact previews in the UI.

## Current Tech Stack
- Next.js 14 (App Router, TypeScript, `src/` layout)
- Tailwind CSS
- Gemini via `@google/genai`
- DOCX preview via `docx-preview`
- PDF generation/parsing support via `pdf-lib`, `pdfjs-dist`, `react-pdf`
- Zod for schema validation

## Core Runtime Flow
1. Parse/tailor resume content using Gemini (`src/lib/gemini.ts`).
2. Build canonical export model/pipeline (`src/lib/export-model.ts`, `src/lib/export-pipeline.ts`).
3. Apply canonical pagination constraints (`src/lib/canonical-pagination.ts`).
4. Render export artifacts:
   - DOCX path: `src/lib/docx-export.ts`
   - PDF path: `src/lib/pdf-renderer.ts`, `src/lib/pdf-export-pipeline.ts`
5. Surface exact preview artifacts in UI (`src/components/ExportPreview.tsx`, `src/components/DocxArtifactPreview.tsx`, `src/components/PdfExactPreview.tsx`).

## Key Directories
```
src/
├── app/                 # App Router pages + API routes
├── components/          # UI components (workspace, previews, loading states)
└── lib/                 # Tailoring, schema, export model/pipeline, renderers

tests/                   # Node test suites for export model/pipeline/renderers/UI-source checks
```

## Important Files
- `src/lib/gemini.ts` — tailoring/parsing orchestration and progress events
- `src/lib/schema.ts` — Zod schemas and shared types
- `src/lib/canonical-pagination.ts` — canonical pagination logic
- `src/lib/docx-export.ts` — DOCX generation path
- `src/lib/pdf-renderer.ts` — PDF rendering logic
- `src/lib/use-export-preview.ts` — preview artifact fetch/state hook

## Scripts
- `npm run dev` — dev server (`.next-dev`)
- `npm run build` — production build (`.next-prod`)
- `npm run start` — run built app from `.next-prod`
- `npm run lint` — lint checks
- `npm run test:docx` — build + DOCX export tests
- `npm run test:pdf` — build + PDF export tests
- `npm run test:export-model` — export model contract tests
- `npm run test:pdf-pipeline` — PDF renderer + pipeline tests

## Environment
- Required: `GEMINI_API_KEY` in `.env.local`
- Optional: `LOG_LEVEL` for logging verbosity

## Engineering Notes
- Keep export behavior canonical and deterministic across formats.
- Prefer shared constants/tokens in export-model layer over format-specific drift.
- Validate external/model inputs with Zod before downstream processing.
- Keep API routes thin; put business logic in `src/lib/*`.
