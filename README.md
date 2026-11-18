# LandPlan Studio

Automated plotted-layout and feasibility studio for residential plotted developments in Telangana
(HMDA, DTCP and municipalities under GO Ms 105). Describe a parcel and planning parameters; the app
generates roads, blocks, plots, open space, utilities and social infrastructure, checks the layout
against cited regulations, and produces the plot schedule, area statement and financials.

> **Yield study only — not a submission drawing.** Rules change by GO; verify every rule against the
> current text before relying on it.

- **Feature guide:** [docs/FEATURES.md](docs/FEATURES.md)
- **API reference:** [docs/API.md](docs/API.md) (live Swagger UI at `/v1/docs` once deployed)
- **Design decisions and assumptions:** [DECISIONS.md](DECISIONS.md)
- **Original build prompts:** [docs/PROMPT_UI.md](docs/PROMPT_UI.md), [docs/PROMPT_BACKEND.md](docs/PROMPT_BACKEND.md)

## Quick start

Requires Node 20 or newer.

```bash
npm ci
```

```bash
npm run dev:api
```

```bash
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/v1/*` to the API on port 8787. The app also
works without the API: everything except server-side optimization of large sites runs in the browser.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server for the web app |
| `npm run dev:api` | Local API server on :8787 (`/v1/docs` for Swagger UI) |
| `npm test` | Vitest: engine parity, rules, site intake, packing, property tests, search, API (52 tests) |
| `npm run e2e` | Playwright acceptance run against `vite preview` (start `npx vite preview --port 4173` first) |
| `npm run screenshots` | Screenshots of every tab at 1440 px and 390 px |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project build (app, server, tooling) |
| `npm run build` | Type-check and build the web app into `dist/` |
| `npm run build:vercel` | `build` + bundle the API into `.vercel/output` (Vercel Build Output API) |
| `npm run db:migrate` | Apply SQL migrations and seed the rule library (`DATABASE_URL` required; add `-- --postgis` for geometry tables) |

## Deploying to Vercel

The repository is set up for Vercel's Build Output API: `vercel.json` runs `npm run build:vercel`,
which writes the static app and one Node.js function (serving every `/v1/*` route) to `.vercel/output`.

1. Push the repository to GitHub (already done for this branch).
2. In Vercel, **Add New → Project** and import `landplan`. Leave the framework preset as *Other*;
   `vercel.json` supplies the install and build commands.
3. Optional but recommended: add a Postgres database (for example **Neon** from the Vercel Marketplace)
   so projects, scenarios, optimize jobs and the layout cache persist. Vercel sets `DATABASE_URL`.
   Then run the migrations once from your machine:

   ```bash
   DATABASE_URL="postgres://…" npm run db:migrate
   ```

4. Set environment variables (Project → Settings → Environment Variables) as needed:

   | Variable | Purpose | Default |
   | --- | --- | --- |
   | `DATABASE_URL` | Postgres connection string. Without it the API uses per-instance memory. | unset |
   | `API_KEYS` | Comma-separated keys accepted in the `x-api-key` header. Unset = open API. | unset |
   | `RATE_LIMIT_PER_MIN` | Requests per minute per key/IP (per instance). | `120` |
   | `CORS_ORIGIN` | `access-control-allow-origin` value. | `*` |
   | `SYNC_MAX_ACRES` | Largest site `/v1/layouts/generate` accepts before returning 413. | `150` |
   | `VITE_API_BASE` | Build-time: API origin for the web app if hosted elsewhere. | same origin |
   | `VITE_API_KEY` | Build-time: key the web app sends (only if `API_KEYS` is set). | unset |

5. Deploy. Check `https://<your-app>.vercel.app/v1/health` (it reports `storage: "postgres"` when the
   database is connected) and `https://<your-app>.vercel.app/v1/docs`.

Notes: the function's `maxDuration` is 60 s. Large optimizations should use
`POST /v1/layouts/optimize?stream=1` (streams progress) or, with a database, the async 202 job flow.

## Project structure

```
src/
  engine/     pure TypeScript layout engine (browser worker + server): geometry, v1 port, rule-aware
              stages, site intake, DP packing, checks, finance, v2 search, LayoutResult contract
  rules/      regulation seed data (30 rules) and authority profiles
  schemas/    zod schemas for API inputs/outputs (exported to OpenAPI)
  server/     framework-free API handler, Node/Vercel adapters, storage (memory/Postgres), jobs, exports
  state/      Zustand stores (project + undo, scenarios, UI, derived, optimizer, persistence)
  features/   UI: shell, panels, studio, three, schedule, feasibility, financials, regulations,
              compare, reports, assistant
db/migrations SQL migrations (001 core, 002 optional PostGIS)
benchmarks/   approved-layout benchmark records
scripts/      Vercel build, dev API, migrations, Playwright scripts
```
