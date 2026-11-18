LandPlan Studio — Backend & Generation Engine Prompt
Put this file in the repo as docs/PROMPT_BACKEND.md, next to docs/PROMPT_UI.md (the UI prompt). Then tell Claude Code: "follow docs/PROMPT_BACKEND.md".

0. How you must work
ultrathink. Before writing code, think through the geometry pipeline, the data contracts and the job model. Write PLAN.md with the module list, interfaces and test plan, then build in the phases in §12.
Use test-driven development for every engine stage: write the tests first, then the code. Run pnpm test after every change and never leave the suite red.
Make the decisions yourself and record them in DECISIONS.md. Don't stop to ask.
Never deploy to AWS yourself. Write the infrastructure code and run cdk synth only. Deployment is my call.

1. Goal
Build the layout generation engine and the backend that serves it for LandPlan Studio. LandPlan Studio is a plotted-layout and feasibility tool for Telangana: HMDA, DTCP, and municipalities under GO Ms 105.
Given a parcel and planning parameters, the engine produces an accurate, rule-checked plotted layout:
roads, blocks, plots, open space, utilities and social infrastructure
area statement, compliance checks and financials
This supersedes one point in the UI prompt. The engine no longer lives inside the React app. It becomes a shared, isomorphic TypeScript package that runs in:
the browser (Web Worker), for instant previews;
Node on the backend, for heavy optimisation jobs and the API.

2. Non-negotiables
Determinism. The same inputs plus the same seed must give a byte-identical result. Use a seeded PRNG (sfc32 or mulberry32), never Math.random, and keep the seed in the output. Hash the inputs as SHA-256 of canonical JSON, and cache results by that hash.
v1 parity mode. Port the v1 algorithm (§4) as engine.v1. With v1 inputs it must reproduce v1's plots, areas and numbering exactly, verified by snapshot tests. The new engine (engine.v2) is the default. engine.v1 stays available for comparison.
Area conservation. On every run, this must hold within 0.01%: plots + roads + boundary road + open space + utilities + social infra + buffers + master-plan give-up + slivers = gross area If it doesn't hold, throw AreaBalanceError. Never return an unbalanced result.
Robust geometry. Do all boolean and offset operations in Clipper2 (clipper2-js or clipper2-wasm; fall back to clipper-lib) on integer millimetre coordinates. Use floats only at the edges: input and output.
Rules are data. Every check references a rule id from packages/rules. Seed it from the table in docs/PROMPT_UI.md §8. No legal numbers are hard-coded in engine logic.
Units. Metres inside the engine. Convert at the edges: sq yd, sq ft, acres, guntas (1 gunta = 121 sq yd = 101.17 m²; 1 acre = 4,840 sq yd = 4,046.856 m²).

3. Repository layout
Use a pnpm monorepo with Turborepo.
packages/
  schemas/   zod schemas for every input and output; export JSON Schema + OpenAPI types
  rules/     regulations seed (typed), authority profiles (HMDA, DTCP, MUNICIPAL, CUSTOM), rule resolver
  engine/    pure TS, zero I/O: geometry/, v1/, v2/ (stages), checks/, finance/, search/, index.ts
apps/
  web/       the React + Vite app from PROMPT_UI.md (imports @landplan/engine in a Web Worker)
  api/       Fastify + zod + OpenAPI (Swagger UI at /docs)
  worker/    job runner for optimise/benchmark jobs (BullMQ locally, SQS on AWS)
services/
  solver-py/ OPTIONAL FastAPI + OR-Tools CP-SAT, behind the SolverPort interface (§5.8)
infra/       AWS CDK (TypeScript)
benchmarks/  digitised approved layouts + harness
docker-compose.yml  postgres+postgis, redis, api, worker, solver-py, minio (S3 locally)
Tooling:
TypeScript strict, ESLint, Prettier.
Vitest + fast-check for tests.
tsup for builds.
pino for logs.

4. v1 algorithm (port exactly as engine.v1)
Constants: ACRE = 4046.8564224, SQYD = 0.83612736, FT = 0.3048.
Parcel: preset unit polygons. Make them counter-clockwise, scale to acres × ACRE, and centre on the centroid.
Boundary road: inset the parcel by periph.
Block grid:
Rotate the parcel by −θ and take its bbox.
A block is blockLen × 2·plotDepth. Vertical pitch is 2·plotDepth + roadY; horizontal pitch is blockLen + roadX. The grid origin is min − offset·pitch.
Clip each block to the parcel with Sutherland–Hodgman. Keep a block only if its area is more than 2.5 × minPlot (minPlot = 70 sq yd).
Open space: take blocks nearest the parcel centroid first, until open area ≥ gross × openPct.
Plot widths: width = sqyd × SQYD / depth. The width sequence is the enabled sizes, each repeated by its weight, sorted ascending, then interleaved lo/hi.
Plot rows: fill both rows of each non-open block. Bottom row fs = −1, top row fs = +1.
Keep a plot if area ≥ 60% of its full rectangle and ≥ minPlot.
A plot is irregular if area < 96.5% of full.
The first and last plot in each row are corner.
Optimiser: θ 0–85° in steps of 5° × blockLen {1, 0.75, 1.25} × offX, offY ∈ {0, ⅓, ⅔}. Keep the maximum plotted area.
Annotation:
Number plots in generation order.
Facing: 8-way from the rotated front normal, adjusted for the north offset.
Price multiplier: 1 + facing premium (N .06, NE .10, E .08, SE .02, S 0, SW −.02, W 0, NW .02) + corner .12 − irregular .05.
Mortgage: whole plots, taken by descending plot number, until area ≥ mortPct.

5. Engine v2: pipeline stages
Each stage is a pure function with typed input and output, its own tests, and timing in diagnostics.
5.1 Site intake (stages/site.ts)
Accepted inputs:
GeoJSON / KML polygon in WGS84
DXF polyline (local metres)
a bearings-and-distances table (closing-error check, Bowditch adjustment if the error is ≤ 1:1000, rejected otherwise)
a preset (v1 shapes)
Projection: project WGS84 to UTM 44N (EPSG:32644) with proj4. Store the transform so outputs can be returned in both local metres and WGS84.
Clean-up: fix self-intersections (Clipper union), remove duplicate and collinear vertices (< 1 mm), and force counter-clockwise orientation.
Area reconciliation: compare the drawn area with the record area (acres + guntas input). Return areaMismatchPct and a warning above a configurable tolerance (default 2%).
5.2 Net developable area (stages/constraints.ts)
Buffers from rules:
lake ≥ 10 ha → 30 m from FTL
lake < 10 ha / shikam → 9 m
nala > 10 m wide → 9 m
nala ≤ 10 m → 2 m
railway → 30 m
HT line → green belt equal to tower base width, plus a 3 m safety distance
heritage → 100 m exclusion, 200 m flag
Master-plan road widening: a strip along the approach edge to reach the required width, equal on both sides of the centreline.
Output: a net MultiPolygon plus a typed deductions[] list (kind, area, geometry, ruleId).
Buffers toward open space: buffers may count toward open space when the rule BF-OS is enabled. HT green belt never counts (HT-GREEN).
5.3 Zone decomposition (stages/zones.ts)
Candidate orientations: the directions of each boundary edge longer than 15 m, plus the minimum-area bounding rectangle angle (rotating calipers).
Splitting: recursively split along cut lines extended from reflex vertices. Pick the cut that maximises total rectangularity (area ÷ area of its minimum-area bounding rectangle).
Stopping: stop when every zone has rectangularity ≥ 0.85, or when a split would create a zone under a minimum size (default 0.4 acre). Merge zones that are too small into a neighbour.
Orientation: each zone takes its best orientation from the candidates, refined by ±4° in the search (§6).
5.4 Road network as a graph (stages/roads.ts)
Entry points: from the approach-road edge, user-given or auto-picked as the midpoint of the longest frontage on the approach road.
Build order:
A spine road along each zone's long axis, linked across zones and to the entry.
Frontage roads at pitch 2·plotDepth + roadWidth.
Cross roads at block length.
Graph model: nodes are junctions and edges are centreline segments.
Connectivity: BFS from the entry. Every block must be reachable. Remove dead stubs under 10 m.
Width loop:
Compute runs: maximal collinear chains of edges.
Look up the required right-of-way from the road-length table (RD-TABLE).
Widen any run that's too narrow.
Regenerate.
Repeat until stable, with a maximum of 5 iterations. Report the iteration count.
Road polygons: buffer each centreline by half its width (flat caps), then union them all.
Splays: at each junction, cut a triangular corner splay whose legs equal the table splay for the narrower road.
Cul-de-sacs: none by default. If enabled, use configurable length and turning-head limits, and mark them with rule status verify.
5.5 Blocks (stages/blocks.ts)
Blocks = net area minus road polygons, using Clipper difference.
Classify each block:
regular (rectangularity ≥ 0.9) or irregular
doubleLoaded (roads on two opposite sides) or singleLoaded
Record each block's frontage edges: the edges that touch a road polygon.
5.6 Plot packing (stages/plots.ts): the accuracy core
For each frontage edge of length L, solve a 1-D packing problem with dynamic programming (DP) over allowed widths:
Widths are snapped to whole feet, in mm.
Each width's value = price × area × expected premium.
Constraints: total width within [L − slack, L]; minimum plot width (PL-MIN).
Return the k best patterns (default k = 20). The mix solver (§5.8) uses them.
Absorbing the remainder: if L − sum ≤ stretchMax (default 2%), widen every plot in the row equally. Otherwise, the remainder becomes a leftover piece and goes to the open-space candidate pool.
Cutting: plot side lines run perpendicular to the frontage edge, not along grid axes.
Double-loaded blocks: the rear line is the block's medial line.
Single-loaded blocks: the rear line is the rear boundary, clipped to the maximum depth.
Cleanup: an end plot under the minimum area or width is merged into its neighbour if the result stays under 1.5× nominal. Otherwise it goes to the candidate pool.
Attributes:
corner = touches two road polygons, or a splay.
irregular = area < 96.5% of its nominal rectangle.
5.7 Open space, utilities and social infrastructure (stages/openspace.ts)
Candidate pool: leftover pieces, irregular plots, buffer-adjacent land, and whole blocks.
Selection: pick a subset that satisfies:
total open space ≥ the profile's % of net area, with the split from the chosen rule (OS-SPLIT-105 or OS-SPLIT-MUN)
every pocket ≥ OS-450
adjacency:
open space does not share an edge with any plot (OS-ADJ)
utilities touch a road and no plot (UT-ADJ)
social infrastructure does not touch open space or utilities (SI-ADJ)
Objective: minimise the plot value consumed. Solve it as a small ILP through SolverPort, with a greedy-and-repair fallback.
Fixing adjacency: if an adjacency rule can't be met, insert a 6 m pedestrian path or a road segment to separate the parcels. If that isn't possible, mark the check fail with the offending geometry ids.
5.8 Plot-mix solver (stages/mix.ts) and SolverPort
Pattern-selection ILP: for each frontage, choose exactly one of its k DP patterns.
Objective: maximise total value minus λ × the deviation from the target mix (in % by count or by area; the user chooses).
SolverPort interface: solveILP(model) → solution.
Default adapter: glpk.js (wasm), which works in the browser and Node.
Optional adapter: an HTTP call to services/solver-py (OR-Tools CP-SAT) for large sites. The API picks it when the variable count is above a threshold.
Time limit: each solve has a time limit. It returns the best feasible solution found, plus a gap value.
5.9 Annotation, mortgage and checks
Numbering: serpentine, block by block, ordered from the entry outward, like real layouts. A v1 numbering option is kept.
Plot attributes:
facing (8-way, adjusted for north offset)
dimensions in feet, rounded to 0.1 ft
area in m², sq yd and sq ft
price multiplier with editable premiums
Mortgage:
Whole plots only (MG-15 or MG-25, whichever the user chose).
Policies: highest-numbers | contiguous-block | lowest-value.
Report the plot ranges.
Checks engine: for each applicable rule, return a check: {ruleId, status: pass|fail|conflict|unknown|overridden, measured, required, featureIds[], message} featureIds are what the UI uses to highlight offending geometry.
5.10 Finance (finance/)
Costs: development cost (per sq yd gross + per m of road + per m² open space), land cost, approval fees, road impact fee.
Cash flow: monthly, combining sales velocity, price escalation, and the mortgage release month.
Outputs: IRR, NPV, peak funding need.
Sensitivity: a tornado over rate, cost, velocity and mortgage %.

6. Scoring and search (search/)
Hard constraints: any fail on a rule whose status is in-force rejects the candidate. Rules with status conflict or verify produce warnings only.
Score: score = Σ plot value − road construction cost − α·irregular area − β·mix deviation − γ·open-space value consumed Weights come from the request, with sensible defaults.
Search space:
continuous: per-zone angle, grid offsets, block length, entry position along the edge
discrete: spine axis per zone, open-space placement, mortgage policy
Method:
Seeded multi-start.
Nelder–Mead on the continuous parameters.
Simulated annealing on the discrete choices.
Output: return the top 5 diverse layouts. Diversity = pairwise plot-set difference of at least 10%. Also return a Pareto set on (yield, margin, warning count).
Budget: a time limit (ms) and a candidate cap. Report progress events {evaluated, bestScore, eta}. Support cooperative cancellation through an AbortSignal.

7. Output contract: LayoutResult (zod, versioned)
{ engineVersion, mode:'v1'|'v2', seed, inputHash, units:'m',
  crs:{local:'EPSG:32644', origin:[x,y]},
  features: GeoJSON FeatureCollection   // kind: parcel|road|splay|block|plot|open|utility|si|buffer|mpRoad|sliver
                                        // plot props: no,nominalSqyd,areaM2,sqyd,dimsFt,facing,corner,irregular,mortgaged,price
  areaStatement:[{kind,areaM2,pct}], roadRuns:[{id,lengthM,widthM,requiredM,splayM,ok}],
  checks:[…], kpis:{plots,saleablePct,avgPlotSqyd,revenue,sellableNow,mortgagedValue,devCost,marginPct,irr,npv},
  finance:{cashflow:[…], tornado:[…]}, diagnostics:{stageTimingsMs, widthIterations, solverGap, warnings[]} }
Every response can be returned in local metres or reprojected to WGS84 (?crs=wgs84).

8. API (apps/api, Fastify, /v1)
Method | Path | Purpose
POST | /parcels/import | GeoJSON, KML, DXF or bearings CSV → cleaned parcel + reconciliation
POST | /layouts/generate | Synchronous, one layout. Budget ≤ 3 s; returns 413 → use /optimize if the site is too big
POST | /layouts/optimize | 202 + jobId; queued search
GET | /jobs/:id | status, progress
GET | /jobs/:id/events | Server-Sent Events progress stream
GET | /jobs/:id/result | top-5 LayoutResult[] + Pareto set
DELETE | /jobs/:id | cancel
GET | /rules, /rules/profiles/:authority | rule library + profiles (versioned, ETag)
CRUD | /projects, /projects/:id/scenarios | persistence
POST | /exports | `{scenarioId, format: pdf
POST | /benchmarks/run | run the engine on the benchmark set → metrics
Validation: validate every body with the shared zod schemas. Return errors as RFC 7807 problem+json.
Auth: an API-key/JWT middleware stub (Cognito later), plus a per-key rate limit.
Caching: cache by inputHash: Redis locally, DynamoDB or Postgres on AWS.

9. Data (Postgres + PostGIS, Drizzle ORM)
Tables:
projects
scenarios (inputs JSONB, chosen rule conflicts, overrides with reason)
runs (inputHash, seed, engineVersion, status, timings)
layouts (result JSONB + PostGIS geometry columns for plots, roads, open space)
rule_sets (versioned seed, lastVerified)
benchmarks
Storage: export files go to S3 (MinIO locally).
Migrations: checked into the repo, with a seed script for the rules.

10. Cloud (AWS, region ap-south-2 Hyderabad)
Write it in CDK. Run synth only; never deploy.
Sync API: API Gateway (HTTP) → Lambda (Node 20, the api app through a Fastify adapter) for /generate, rules, CRUD and imports.
Optimise jobs: API → SQS → ECS Fargate worker (autoscaling on queue depth, Spot allowed). Progress goes to Redis (ElastiCache) for SSE, and results to RDS + S3.
Optional solver: solver-py as a separate Fargate service on a private ALB.
Database: RDS Postgres with PostGIS.
Exports: an S3 bucket with lifecycle rules.
Monitoring: CloudWatch logs and alarms (job failure rate, p95 latency, queue age).
Secrets: Secrets Manager. No credentials in code.
Local development: docker compose up runs everything locally with identical behaviour.

11. Testing and accuracy
Unit tests: every stage, every geometry helper. Include edge cases: collinear points, slivers, holes, concave and spiky parcels.
Property tests (fast-check), on random valid polygons from 1 to 100 acres:
area conservation
every plot reachable from the entry
no plot under PL-MIN
no overlaps between features (pairwise intersection area < 1 cm²)
determinism: same input + seed → same hash
Parity tests: v1 snapshot fixtures (5 presets × 3 parameter sets).
Golden tests: 10 hand-checked layouts with expected plot counts and area splits.
Benchmark harness:
The benchmarks/ folder holds digitised approved HMDA layouts as GeoJSON boundaries, with the approval letter's plotted/roads/park/social-infra areas. Seed it with one: plotted 214,855 m², roads 92,809 m², park 26,202 m², social infra 8,758 m² on a 346,865 m² net site (HMDA draft LP 000091/LO/Plg/HMDA/2020).
Report the error per land-use share and the plot-count error. CI fails if the mean share error gets worse by more than 1 percentage point.
Performance budgets (CI benchmark):
Run | Budget
generate on 17 acres (Node) | < 300 ms
optimize on 17 acres | < 10 s
optimize on 100 acres | < 60 s on a 2-vCPU worker
Browser worker preview, 17 acres | < 1.5 s

12. Build phases
Each phase ends green, with a short CHANGELOG entry.
Monorepo skeleton: schemas, rules package (seed from the UI prompt §8), engine.v1 port + parity tests.
Geometry core: Clipper2 mm wrapper, projection, site intake + reconciliation, constraints and buffers, area-conservation assertion.
Zones + road graph + width loop + splays + blocks.
Plot packing: k-best DP, perpendicular cuts, remainder absorption; then annotation + mortgage + checks.
Open-space ILP + mix ILP through SolverPort (glpk.js); greedy fallback.
Search: multi-start, Nelder–Mead, annealing, diversity, progress and cancel. Finance module.
API + persistence + jobs + SSE: local docker-compose. Wire apps/web to call the engine in a worker and /optimize for big sites.
Exports (PDF, DXF, XLSX, GeoJSON), benchmark harness, performance CI.
AWS CDK stacks (synth only), plus the optional solver-py service with an OR-Tools CP-SAT adapter.
13. Out of scope
Payments and CRM.
Live scraping of government sites. Rules are versioned seed data with a manual update path.
ML ranking. Leave a Ranker interface stub for later.

