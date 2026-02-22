# jdswap

A Next.js + TypeScript app for resume tailoring and export workflows.

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Add your values in `.env.local` (for example, `GEMINI_API_KEY`).

## Scripts

- `npm run dev` - start development server (uses `.next-dev`)
- `npm run build` - production build (uses `.next-prod`)
- `npm run start` - run production server from `.next-prod`
- `npm run lint` - run Next.js lint checks
- `npm run test:docx` - build and run DOCX export tests

## Git Workflow

1. Keep `main` stable and protected.
2. Create feature branches from `main`.
3. Open PRs for review instead of direct pushes to `main`.
4. Merge after checks pass.
