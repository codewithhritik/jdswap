# JDSwap — Project Instructions

## Overview
Resume tailoring web app. Takes pasted resume text + job description, uses Google Gemini to rewrite bullets with JD keywords, outputs a 1-page PDF.

## Tech Stack
- Next.js 14+ (App Router, TypeScript, `src/` directory)
- Tailwind CSS (dark theme)
- Google Gemini 2.5 Flash via `@google/genai`
- `@react-pdf/renderer` for server-side PDF generation
- Zod for schema validation

## Skills
- **Always** reference the Vercel React Best Practices skill at `.claude/skills/vercel-react-best-practices` when writing or modifying any React/Next.js code
- Follow the skill's rules for: eliminating waterfalls, bundle optimization, server-side performance, re-render optimization, and rendering performance

## Conventions
- Server Components by default; only add `"use client"` when the component needs browser APIs, event handlers, or hooks
- TypeScript strict mode — no `any` types
- Zod for all runtime validation (API inputs, Gemini responses)
- Imports use `@/` path alias (maps to `src/`)

## Project Structure
```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components (client components where needed)
└── lib/              # Business logic, Gemini client, PDF rendering, schemas
    └── pdf/          # @react-pdf/renderer components and styles
```

## Commands
- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Production build (run to verify before committing)
- `npm run lint` — ESLint

## Environment
- `GEMINI_API_KEY` in `.env.local` — required for Gemini API calls

## Key Libraries
| Library | Purpose | Docs |
|---------|---------|------|
| `@google/genai` | Gemini API client with structured JSON output | google/genai npm |
| `@react-pdf/renderer` | Server-side PDF generation with JSX | react-pdf.org |
| `zod` | Schema validation for Gemini responses | zod.dev |
| `zod-to-json-schema` | Convert Zod schemas to JSON Schema for Gemini | npm |
