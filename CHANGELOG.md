# Changelog

## Pages, project types and Neon sync
- Landing page, projects list, new-project wizard with Generate (live preview), project Overview dashboard.
- Project types: residential plots, gated villa community, farm plots — each with its own defaults and details.
- Projects and scenarios sync to Postgres/Neon through the API (browser storage fallback); automatic schema creation.
- Node 22 runtime for the Vercel function.

## Backend for Vercel + engine v2 stages
- API `/v1` (generate, optimize jobs + SSE, parcels import, rules, projects/scenarios, exports, benchmarks, OpenAPI).
- Postgres storage via `DATABASE_URL`, migrations and rules seed; in-memory fallback.
- Site intake (WGS84 → UTM 44N, DXF, Bowditch traverse, clean-up, reconciliation), area-balance guarantee,
  geometric master-plan give-up, DP plot packing, serpentine numbering, mortgage policies, v2 search.
- Large sites optimize on the server from the web app.

## Frontend fixes
- Undo no-op steps, schedule render loop, mobile overflow; optimizer 5 s → 1.4 s; lazy-loaded heavy tabs.

## Phase 1–8 (frontend)
- Engine port with parity tests, rules library, shell and design system, Studio, Feasibility,
  Regulations, Schedule, Financials, constraints and parcel editor, 3D massing, Compare, exports, assistant.
