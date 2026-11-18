# LandPlan Studio — Feature Guide

This document lists every feature in the project as built, where to find it, and what was left out.
It covers the web app (from `docs/PROMPT_UI.md`) and the backend (from `docs/PROMPT_BACKEND.md`,
adapted for Vercel).

> Every screen, export and report carries the notice **"Yield study only — not a submission drawing."**

---

## 1. Layout engine

The engine is plain TypeScript in `src/engine` with no React or I/O. The same code runs in the browser
(main thread and a Web Worker) and on the server.

### 1.1 Two engine modes

| Mode | What it is | How to switch |
| --- | --- | --- |
| **v1 parity** (default in the app) | Exact port of the v1 algorithm: same plot count, areas and numbering for the same inputs. | Site panel → *v1 parity*; API `engine: "v1"` |
| **Rule-aware (v2)** | Fixes the v1 defects and adds rule-driven geometry (below). | *Apply GO 105 standards*, Site panel → *Rule-aware*; API default `engine: "v2"` |

### 1.2 v1 algorithm (parity mode)
- Five preset parcels (rectangle, triangle, trapezoid, L-shape, irregular), made counter-clockwise, scaled
  to the extent in acres and centred on the centroid.
- Boundary road inset, block grid rotated by θ, Sutherland–Hodgman clipping, blocks kept above
  2.5 × minimum plot (70 sq yd).
- Open space = blocks nearest the centroid until ≥ gross × open %.
- Plot widths from enabled sizes × weights, sorted and interleaved low/high; both rows of every block
  filled; 60 % keep rule; irregular below 96.5 %; first/last plot in a row is a corner.
- Optimizer: θ 0–85° step 5° × block length {1, 0.75, 1.25} × offsets {0, ⅓, ⅔} (486 layouts),
  maximum plotted area wins.
- Numbering in generation order; 8-way facing with north offset; price multiplier from facing
  premiums, corner +12 %, irregular −5 %; whole-plot mortgage by descending plot number.

### 1.3 Rule-aware additions (v1 defects fixed)
| v1 defect | What the engine does now |
| --- | --- |
| Roads = gross − blocks (lumped) | Separate lines: internal roads, junction splays, boundary road, master-plan give-up, buffers, unusable slivers. |
| Corner = end of row | Corner = plot that touches a road junction. |
| No junction splays | Splays cut per the road table (3 / 4.5 / 6 m by ROW) and subtracted from plots. |
| Open-space check passed by construction | Checked against **net** layout area after master-plan give-up, plus minimum pocket size and adjacency. |
| Spine road used DTCP rule under HMDA | Road rules come from the selected authority profile. |
| "60 % coverage" hard-coded | Coverage derived from setbacks per plot size. |
| Run of exactly 1000 m returned "unknown" | Inclusive band boundaries (≤ 600, ≤ 1000, > 1000 m). |
| Optimizer froze the UI | Runs in a Web Worker (Comlink) with progress and cancel; large sites go to the API. |
| Naive inset failed on spiky parcels | Clipper-based offsets and booleans (integer millimetres). |

Also in rule-aware mode:
- **Statutory buffers** from the rule library, deducted from the developable area: lake ≥ 10 ha → 30 m,
  lake < 10 ha → 9 m, nala > 10 m wide → 9 m, nala ≤ 10 m → 2 m, railway → 30 m,
  HT line → tower-base green belt + 3 m safety, heritage → 100 m exclusion (100–200 m flagged).
  Optionally counted toward open space (Rule 16(1)(e)(ii)); HT belts never count (HT-GREEN).
- **Master-plan road widening** cut as a strip along the approach edge (auto south-most edge or chosen).
- **Open-space split**: parks as whole road-bounded blocks; utilities carved from a park block's road
  end; social infrastructure carved from a plotted block's road end. Placement: central, distributed
  pockets, or along buffers.
- **Road hierarchy**: runs over 600 m are upgraded to 18 m and the layout regenerated.
- **Mixed depths** option: top row of each block at 1.25 × depth.
- **Optimal plot packing (DP)**: per row, whole-foot plot widths are chosen by dynamic programming to
  fill the frontage and match the target size mix; a remainder ≤ 2 % is absorbed by widening plots
  equally. On the 17-acre L preset this gives 239 plots / 62.3 % saleable vs 223 / 62.1 % for v1 cycling.
- **Serpentine numbering** option: blocks ordered from the entry outward, bottom row left→right,
  top row right→left.
- **Mortgage policies**: highest numbers (v1), contiguous blocks, or lowest value; reported as plot ranges
  (e.g. "179–239").
- **Area conservation**: every run must balance (all lines = gross within 0.01 %) or the engine throws
  `AreaBalanceError` — an unbalanced result is never returned.
- **Determinism**: no `Math.random` in the engine; seeded PRNG (mulberry32) for search; inputs hashed
  with SHA-256 of canonical JSON.

### 1.4 Site intake (`src/engine/site.ts`)
- GeoJSON / KML polygons in WGS84 projected to UTM 44N (EPSG:32644) with proj4; results can be returned
  in local metres or WGS84.
- DXF polylines (local metres).
- Bearings-and-distances traverse: closing-error check, **Bowditch adjustment** when ≤ 1:1000, rejected
  otherwise.
- Clean-up: self-intersections fixed by union, duplicate/collinear vertices (< 1 mm) removed, forced CCW.
- **Area reconciliation** against the record area (acres + guntas; 1 gunta = 121 sq yd = 101.17 m²) with a
  warning above 2 %.

### 1.5 v2 search (`src/engine/search.ts`)
- Seeds from the full 486-layout grid, then seeded multi-start **Nelder–Mead** over angle, offsets and
  block length, across open-space placements.
- Score = plot value − road cost − α·irregular area − β·mix deviation − γ·open-space value (weights configurable).
- **Hard constraints**: a fail on an in-force rule rejects the candidate; conflict/verify rules only warn.
- Returns the **top 5 diverse layouts** (≥ 10 % plot-set difference) and a **Pareto set**
  (yield, margin, warnings); progress events; cancellation via `AbortSignal`; time and candidate budgets.
- 17 acres: ~1,500 candidates in about 2 s.

### 1.6 Checks (`src/engine/checks*.ts`)
Every check cites rule ids. Statuses: Pass, Fail, Action needed, Sources conflict, Overridden,
Not applicable, Not checked. A check without a citable source never shows a tick.

Computed checks: public-purpose reservation ≥ 10 % of net, open-space split, SI ≤ 2.5 % (HMDA MP 2031),
minimum pocket, OS/UT/SI adjacency, road ROW by run length, junction splays, frontage/spine width per
authority, approach road (with widening + road-impact-fee note), minimum plot 50 m² / 6 m, mortgage share,
works window, lake/nala/HT/railway buffers, water-body NOC trigger, heritage zones, EIA (≥ 50 ha),
extra facilities (≥ 50 acres), ground coverage from setbacks.

Failing checks carry **one-click fixes** (e.g. "Cut junction splays", "Widen spine to 18 m") and the ids
of the offending geometry for highlighting.

### 1.7 Finance (`src/engine/finance.ts`)
Plot prices (rate × size × multiplier, or a manual override), development cost (per sq yd gross,
per metre of road, per m² of open space), land cost, approval fees, road impact fee; monthly cash flow
with sales velocity, price escalation and mortgage release; revenue, profit, margin, **IRR**, **NPV**,
**peak funding need**, sell-out month; **tornado** sensitivity on rate, cost, velocity and mortgage %.

---

## 2. Rules library (`src/rules`)

- **30 seed rules** researched 17 Nov 2026, each typed with id, category, authorities, GO reference,
  value, summary, source URL, source type (Official / GO copy / Secondary), status
  (in force / conflict / verify), last-verified date and the checks that use it.
- **Authority profiles**: HMDA, DTCP, Municipality (GO 105), Custom.
- **Conflict groups** with a per-project choice and audit note: mortgage MG-15 vs MG-25, open-space
  split OS-SPLIT-105 vs OS-SPLIT-MUN, HMDA frontage 12.2 m vs 9 m (LRS).
- **Overrides** per rule (custom value + mandatory reason) mark the dependent checks "Overridden".
- **Manual document checklist**: land-use conformity, agricultural conversion, jurisdiction, master-plan
  give-up deed, open-space gift deed + compound wall, title/EC/patta, services drawings, licensed
  technical person signature, BuildNow submission, SI permitted uses.

---

## 3. Web app

### 3.0 Pages and project flow
| Route | Page |
| --- | --- |
| `/` | **Landing page**: full-screen hero with live engine layouts drawing themselves behind the headline, scan-line and cursor-coordinate effects, live stats from the engine, GO-reference marquee, how-it-works, project types, cited-compliance showcase, feature grid and call to action. |
| `/projects` | **Projects list**: cards with type, location, plots, saleable %, revenue and check status; delete; shows whether projects sync to Neon or stay in this browser. |
| `/projects/new` | **New-project wizard**: 1) type, 2) site details (name, location, village, survey nos., authority, acres + guntas, approach roads, parcel shape), 3) rates and rules (base rate, development cost, land cost, rule-aware toggle, type-specific options), 4) **Generate** — searches 486 grid layouts in a Web Worker with a live best-so-far plan preview, then saves the project and opens its dashboard. `?type=plots|villas|farm` preselects a type. |
| `/projects/:id` | **Project workspace** opening on the **Overview dashboard**, plus Studio, 3D, Schedule, Feasibility, Financials, Regulations and Compare. Autosaves (Neon when available). |
| `/studio` | Scratch studio without a project (also where old share links open). |

**Project types** (each sets its own defaults and its own Overview details):
| Type | Defaults | Overview shows |
| --- | --- | --- |
| Residential plots | 150–400 sq yd mix, 60 ft depth, 12.2 m roads, GO 105 rules | Sellable-now vs mortgaged value, price band, corner plots, plot mix, facing, mortgaged plot ranges |
| Gated villa community | 240–500 sq yd villas, 70 ft depth, 18 m spine, G+1/G+2, optional clubhouse parcel (1 % SI), higher east/corner premiums | Villa count, total and average built-up (sq ft), clubhouse area, premium villas, link to 3D |
| Farm plots | 10–40 gunta plots, 220 ft depth, 9/12 m farm roads, distributed green, per-acre pricing, plantation | Plots by gunta band, price per acre, farm-road length, green cover, saleable acres/guntas, sell-out |

The **Overview dashboard** (all types) also has KPI tickers, a plan preview, a land-use donut, the
compliance ring with open issues, finance summary and project details.

**Storage**: when the API reports a Postgres database (Neon), projects and scenarios are created, loaded
and autosaved through `/v1/projects`; otherwise they are kept in this browser (IndexedDB). The top bar shows
which ("Neon cloud" / "this browser") and the save state.

### 3.1 Shell
- **Top bar**: editable project name, authority badge, scenario switcher (save, duplicate, rename,
  delete), **compliance ring** (verified / failing / conflict / not-checked; shakes once on a new failure),
  Generate, Optimize, GO 105, Export, share link, ⌘K, assistant, undo/redo, theme toggle.
- **Left rail** with collapsible parameter panels: Site, Constraints, Plot mix, Roads, Open space,
  Built form, Commercials. Sliders + number inputs update the layout live (debounced 120 ms).
- **Bottom dock**: KPI ticker (gross, plots, saleable %, roads %, open %, average plot, sellable now ₹Cr,
  mortgaged ₹Cr, margin %) with rolling numbers, and an animated land-distribution bar.
- **Themes**: "Survey Command" dark (default) and "Paper" light. Geist / Geist Mono typefaces.
- **Responsive**: three columns ≥ 1280 px; inspector becomes a drawer at 768–1279 px; below 768 px the
  parameters become a bottom sheet and KPIs become swipeable cards.

### 3.2 Parameters
| Panel | Parameters |
| --- | --- |
| Site | Engine mode, GO 105 preset, live area (acres / m² / guntas), parcel source (preset / draw / bearings table / import GeoJSON-KML-DXF), map tracing, extent, north offset, authority, approach road and master-plan widths, approach edge, road-affected strip, record area (acres + guntas) with reconciliation, survey nos., revision |
| Constraints | Draw lake, nala, HT line, railway edge, heritage point; per-constraint lake area, nala width, voltage, tower base; count buffers toward open space |
| Plot mix | Depth, block length, sizes on/off + weights (with width at depth), minimum area and width, mixed depths, width packing (v1 cycle / DP), numbering (generation / serpentine) |
| Roads | Frontage, spine, boundary widths; junction splays; road hierarchy; road table reference |
| Open space | Total, park, utilities, social infra %, placement, minimum pocket |
| Built form | Floors (G+1…G+3), floor height, setbacks |
| Commercials | Base rate, dev cost, road cost, open-space cost, land cost, approval fees, road impact fee, mortgage %, mortgage policy, release month, velocity, escalation, discount, facing/corner/irregular premiums |

### 3.3 Tabs
1. **Studio** — plan canvas with pan/zoom and inertia, 10 m drafting grid, crosshair with live X/Y,
   north arrow, scale bar, legend, disclaimer stamp; plot colour bands by size; mortgaged plots with an
   animated hatch; corner inner hairline; buffers with a soft cyan hatch; plot numbers fade in with zoom;
   hover tooltip (number, size, dimensions, facing, price) with dimension arrows; click to inspect;
   lasso multi-select (L or Shift-drag) with bulk status; parcel vertex editor (drag, add, Alt-delete,
   1 m snap); constraint drawing tools; satellite map tracing (MapLibre + Esri imagery); generate animation
   (roads draw, blocks fade, plots ripple outward); canvas renderer above 600 plots; designed empty state
   with the three most effective one-click fixes.
   **Inspector**: plot card (status Available / Held / Booked / Sold / Mortgaged, price override),
   bulk actions, layout summary with ±5° rotate and area statement.
   **Optimizer drawer**: live θ × block-length heatmap that fills as results stream, best-cell pulse,
   Pareto chart (yield vs margin, coloured by failing checks); click any cell or point to load it; cancel.
2. **3D** — massing with react-three-fiber: villas extruded per plot with setbacks, roads, trees on parks,
   real shadows from a **sun-path** slider (date + time, Hyderabad 17.385°N), orbit camera, one-click
   fly-through, coverage label derived from setbacks.
   **Render mode** (toggle at the top of the 3D tab; code in `src/features/three/render/`, lazy-loaded):
   a detailed scene built per project type from the exact engine geometry —
   - *Shared kit*: true-width roads with markings, zebras, kerbs, paver footpaths and painted road names;
     lamps; compound wall and entrance arch; external approach road; named gardens with amenities chosen by
     size; clubhouse; utilities; buffers drawn as water, green belts and HT towers; instanced trees with sway.
   - *Plots*: levelled pads, boundary stones, sample homes, "future homes" ghost massing.
     *Villas*: contemporary villas from setbacks and floors (flat roof + parapet, stair headroom, tanks,
     chajjas, framed glazing, balconies, porch, stone cladding, compound wall and gate).
     *Farm*: plantation rows, drip lines, fenced plots with gates, cottages, borewell, farm pond.
   - *Viewer*: light presets following the real sun (blue-hour night with lit streets and windows), four
     cameras (Aerial, Arrival drive, Plan, Walk with WASD / joystick), status colours, ground labels, Find a
     plot, Refine filters, plot card with price and share link, Layers / Info / Share / Gallery / Download.
   - *Rendering*: fitted soft shadows, sky + Lightformer environment, N8AO, bloom, AgX tone mapping, SMAA,
     vignette; Mobile / High / Ultra (progressive path tracing when idle; disabled without WebGL 2 /
     float targets). Mobile is picked automatically on phones and low-end GPUs.
   - *Surroundings*: Google Photorealistic 3D Tiles (key from `VITE_GOOGLE_MAPS_KEY`, georeferenced parcels
     only, attributions always shown), else Esri imagery fading into haze, else procedural fields.
   - *Exports*: PNG 1×/2×/4K, 28 s 1080p WebM film, PDF brochure; stamped "Yield study only — not a
     submission drawing" or the LP number.
   **Public viewer** `/view/:projectId` (`?plot=N` deep link, iframe embed) opens straight into Render mode
   without editing UI; demos at `/view/demo-plots`, `/view/demo-villas`, `/view/demo-farm`.
3. **Schedule** — virtualised TanStack table with sticky header, sort, filters (size, facing, status),
   group by size or facing with totals, inline price override, XLSX/CSV export.
4. **Feasibility** — compliance tally, computed checks with cited rules, actual vs required, notes,
   "Verify source" badges, one-click fixes and **Show on plan** highlighting (pulsing outline); manual
   document checklist with status, notes and evidence file names; area statement; road-runs table;
   plot mix by size and facing.
5. **Financials** — KPI cards, monthly cash-flow chart with mortgage-release marker, NPV tornado,
   assumptions; data-table fallbacks for both charts.
6. **Regulations** — rules-change banner, conflicts lane with "pick which to apply" and audit note,
   searchable card grid with category / authority / status / source filters, value chips, GO reference,
   source badge, last-verified date, "used by N checks", source link, per-rule override; "Update rules"
   (stubbed — rules ship as versioned seed data).
7. **Compare** — two scenarios side by side with a draggable (and keyboard) **swipe divider** and KPI deltas.

### 3.4 Power-user features
⌘K command palette; undo/redo (one step per slider drag); shortcuts G (generate), O (optimize),
1–7 (tabs), [ ] (rotate grid), L (lasso), V (select), Esc; **autosave** to IndexedDB; **shareable link**
(compressed state in the URL hash); units toggle (m² / sq yd / acres-guntas); Indian number formatting
(₹1,23,45,678; lakh / crore); all strings in `src/i18n/en.json` ready for Telugu.

### 3.5 Exports
PDF report (A3 drawing sheet with title block — project, survey nos., authority, scale, north arrow, date,
revision, "Yield study only" stamp — then area statement, checks, financials and schedule), SVG plan,
DXF plan (layered), XLSX schedule + area statement, CSV schedule, GeoJSON (WGS84).

### 3.6 Assistant (UI with mock backend)
Right-hand drawer with a typed `askAssistant(context) → Promise<Answer>` interface. The mock explains
failing or conflicting checks with their cited rules and offers the checks' one-click fixes. Ready to
swap for a real backend.

### 3.7 Accessibility and performance
Keyboard-reachable controls, signal-orange focus rings, ARIA roles on tabs, sliders, switches, menus and
the plan; the schedule is the plan's list alternative; charts have data tables; reduced-motion respected.
Regenerating 17 acres takes ~10 ms; the in-browser optimizer finishes in ~1.4 s; 3D, map, charts,
schedule, compare and export code are lazy-loaded.

---

## 4. Backend API (`/v1`)

Framework-free handler in `src/server`, deployed as one Vercel Node.js function. Full reference:
[docs/API.md](API.md); live OpenAPI at `/v1/openapi.json` and Swagger UI at `/v1/docs`.

- `POST /parcels/import` — GeoJSON, KML, DXF, bearings rows or bearings CSV → cleaned parcel,
  traverse closure, area reconciliation.
- `POST /layouts/generate` — one layout, synchronous, cached by input hash (`x-cache: hit|miss`),
  `?crs=wgs84`, optional grid optimization; 413 above `SYNC_MAX_ACRES`.
- `POST /layouts/optimize` — v2 search; `?stream=1` streams Server-Sent Events; otherwise a 202 job
  (inline result without a database).
- `GET /jobs/:id`, `/jobs/:id/events` (SSE), `/jobs/:id/result`; `DELETE /jobs/:id` cancels.
- `GET /rules` (ETag / 304), `GET /rules/profiles/:authority`.
- Projects and scenarios CRUD (`/projects`, `/projects/:id/scenarios/:sid`).
- `POST /exports` — SVG, DXF, GeoJSON, CSV from params or a saved scenario.
- `POST /benchmarks/run` — runs the benchmark set and reports land-use share errors.
- **Output contract** `LayoutResult`: engine version, mode, seed, input hash, CRS, GeoJSON features
  (parcel, road, splay, block, plot, open, utility, si, buffer, mpRoad) with plot properties
  (number, nominal sq yd, m², sq yd, sq ft, dimensions in feet, facing, corner, irregular, mortgaged,
  price), area statement, road runs, checks with feature ids, KPIs (incl. mortgaged plot ranges),
  cash flow, tornado, diagnostics (stage timings, warnings).
- zod validation with **RFC 7807** problem+json errors; API-key middleware stub (`API_KEYS`);
  per-key rate limit; CORS.
- **Projects for the web app**: `POST /projects` takes `type`, `details`, `summary` and an optional first
  scenario (validated before anything is written); `PATCH` updates name, details, summary and active scenario;
  `PUT /projects/:id/scenarios/:sid` upserts; `GET /projects/:id?include=params` returns full scenarios.
- **Storage**: in-memory by default; **Postgres** when `DATABASE_URL` (or `POSTGRES_URL`) is set. Tables are
  created automatically on first connection, so a fresh Neon database needs no manual migration (projects, scenarios with
  rule choices and overrides, runs/jobs, layout cache, versioned rule sets, benchmarks). Migrations in
  `db/migrations`, seeding via `npm run db:migrate`; optional PostGIS geometry tables.
- **Benchmark harness** seeded with HMDA draft LP 000091/LO/Plg/HMDA/2020 (plotted 214,855 m², roads
  92,809 m², park 26,202 m², social infra 8,758 m² on 346,865 m²). The digitised boundary is not yet
  available, so the harness uses an equal-area rectangle and reports itself as approximate
  (current mean share error ≈ 4 percentage points).

---

## 5. Testing

| Suite | Count | Covers |
| --- | --- | --- |
| Parity (`parity.test.ts`) | 15 | 5 presets × 3 parameter sets vs an independent v1 reference implementation |
| Rules (`rules.test.ts`) | 13 | Road bands, seed data, determinism, GO 105 preset, lake buffers, conflicts, overrides, finance, performance |
| Site intake | 7 | Bowditch, rejection, clean-up, bow-tie fix, reconciliation, UTM round trip, GeoJSON import |
| Packing | 3 | Whole-foot widths, minimum width, fill/leftover, determinism |
| Properties (fast-check) | 4 | Area conservation on random 1–100 acre parcels (both engines), no plot under PL-MIN, no overlaps, determinism |
| Search | 3 | Seed determinism, ≥ v1 grid quality, diversity/Pareto, AbortSignal |
| API | 7 | Health, rules ETag, generate + cache, RFC 7807, 413, optimize jobs, CRUD, exports, API keys, benchmark |
| Playwright acceptance (`npm run e2e`) | 22 checks | Every item of the UI prompt's acceptance checklist |

---

## 6. What was not built, and why

| Item from the prompts | Status | Reason / alternative |
| --- | --- | --- |
| AWS CDK stacks, Lambda/API Gateway, SQS + Fargate worker, ElastiCache, RDS, S3 | Not built | You chose Vercel. The API runs as a Vercel function; Postgres via `DATABASE_URL` (e.g. Neon). |
| docker-compose (postgres, redis, minio, worker, solver-py) | Not built | Not needed for Vercel; `npm run dev:api` + any local Postgres covers local development. |
| BullMQ / SQS job queue | Replaced | Jobs run in the request (stream or inline) or continue after the 202 via Vercel `waitUntil` with Postgres-backed status. |
| pnpm + Turborepo monorepo, Fastify, Drizzle ORM | Replaced | Single npm package with `src/engine` shared by browser and server; a small framework-free router; `postgres` with plain SQL migrations. |
| Zone decomposition (reflex-vertex cuts, rotating calipers) | Not built | The grid-based generator with searched orientation is used for every parcel. |
| Road network as a graph (BFS reachability, iterative width loop, cul-de-sacs) | Partly | Road runs, ROW table checks, splays and a one-pass hierarchy upgrade exist; no graph model or reachability proof. |
| Perpendicular plot cuts on non-grid frontages, medial rear lines | Not built | Plots are cut on the rotated grid. |
| k-best DP patterns + plot-mix ILP, open-space ILP (glpk.js), SolverPort, solver-py (OR-Tools) | Partly | One best DP pattern per row with mix targeting; greedy open-space allocation. |
| Simulated annealing on discrete choices | Partly | Discrete open-space placement is swept exhaustively instead. |
| Golden tests (10 hand-checked layouts), CI performance gate | Not built | No hand-checked layouts were available; benchmark harness has one approximate entry. |
| Real AI assistant, live rule fetching, payments/CRM | Out of scope | As specified in the prompts. |
| Original v1 HTML file | Not available | Parity fixtures come from an independent re-implementation of the written v1 spec; see DECISIONS.md. |
| Render mode on real devices (4 s interactive on mid-range Android, ≥ 30 fps with 300 plots) | Not measured | Screenshots were taken with software WebGL; device performance has not been profiled. Google 3D Tiles and Esri imagery could not be reached from the build environment. |
| Lighthouse ≥ 90 | Not measured | Heavy modules are code-split; the score has not been run. |
