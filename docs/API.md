# LandPlan Studio API (`/v1`)

Base URL: `https://<your-app>.vercel.app/v1` (local: `http://localhost:8787/v1`).
Interactive docs: `/v1/docs` · OpenAPI 3.1: `/v1/openapi.json`.

- **Auth**: when `API_KEYS` is set, send `x-api-key: <key>` (or `Authorization: Bearer <key>`).
  `/health`, `/docs` and `/openapi.json` are always open.
- **Errors**: RFC 7807 `application/problem+json` with `type`, `title`, `status`, `detail` and, for
  validation, `errors[]` (`path`, `message`).
- **Params**: every `params` field is optional; the server deep-merges it onto the engine defaults
  (`engine: "v2"` starts from the GO 105 standards preset). See the `Params` schema in OpenAPI.
- **Units**: metres internally; `?crs=wgs84` reprojects output geometry to WGS84 via UTM 44N.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Status, engine and rules versions, storage mode (`memory` / `postgres`) |
| POST | `/parcels/import` | GeoJSON / KML / DXF / bearings → cleaned parcel + reconciliation |
| POST | `/layouts/generate` | One layout, synchronous (cached by input hash; 413 if too large) |
| POST | `/layouts/optimize` | Search for the best layouts (202 job, or SSE with `?stream=1`) |
| GET | `/jobs/:id` | Job status and progress |
| GET | `/jobs/:id/events` | Server-Sent Events progress stream |
| GET | `/jobs/:id/result` | Top-5 `LayoutResult[]` + Pareto set |
| DELETE | `/jobs/:id` | Cancel |
| GET | `/rules` | Rule library (ETag / `If-None-Match` → 304) |
| GET | `/rules/profiles/:authority` | HMDA, DTCP, MUNICIPAL, CUSTOM |
| GET, POST | `/projects` | List / create projects |
| GET, PATCH, DELETE | `/projects/:id` | Read (with scenario list) / rename / delete |
| GET, POST | `/projects/:id/scenarios` | List / create scenarios |
| GET, PUT, DELETE | `/projects/:id/scenarios/:sid` | Read / update / delete a scenario |
| POST | `/exports` | `svg`, `dxf`, `geojson`, `csv` from `params` or `scenarioId` |
| POST | `/benchmarks/run` | Run the benchmark set → share errors |

## Examples

Generate a 17-acre GO 105 layout with the best grid, in WGS84:

```bash
curl -s -X POST "$BASE/layouts/generate?crs=wgs84" -H 'content-type: application/json' -d '{"params":{"site":{"acres":17,"preset":"L"}},"optimizeGrid":true}'
```

Optimize with streamed progress:

```bash
curl -N -X POST "$BASE/layouts/optimize?stream=1" -H 'content-type: application/json' -d '{"params":{"site":{"acres":40}},"budgetMs":15000,"seed":7}'
```

Import a bearings traverse with record area 7 ac 16 gn:

```bash
curl -s -X POST "$BASE/parcels/import" -H 'content-type: application/json' -d '{"kind":"bearings","rows":[{"bearing":90,"distance":200},{"bearing":0,"distance":150.05},{"bearing":270,"distance":200},{"bearing":180,"distance":150}],"recordAcres":7,"recordGuntas":16}'
```

Export a DXF for a saved scenario:

```bash
curl -s -X POST "$BASE/exports" -H 'content-type: application/json' -d '{"format":"dxf","scenarioId":"scn_…"}' -o plan.dxf
```

## Optimize job flow

- `?stream=1`: the response is `text/event-stream` with events `job`, `progress`
  (`{evaluated, bestScore, etaMs}`), `done`/`cancelled`/`failed`, then `result`.
- Without a database: `202` with the finished `result` inline (serverless instances don't share memory).
- With `DATABASE_URL`: `202 {jobId, links}` immediately; the search continues via Vercel `waitUntil`;
  poll `/jobs/:id`, stream `/jobs/:id/events`, then fetch `/jobs/:id/result`.

## LayoutResult (summary)

```
{ engineVersion, mode: 'v1'|'v2', seed, inputHash, units: 'm',
  crs: { local: 'EPSG:32644', origin: [E, N], output: 'local'|'wgs84' },
  features: FeatureCollection   // kind: parcel|road|splay|block|plot|open|utility|si|buffer|mpRoad
  areaStatement: [{ kind, label, areaM2, pct }],
  roadRuns: [{ id, axis, lengthM, widthM, requiredM, splayM, ok }],
  checks: [{ id, ruleId, ruleIds, status, measured, required, featureIds, message }],
  kpis: { plots, saleablePct, avgPlotSqyd, revenue, sellableNow, mortgagedValue, devCost, marginPct,
          irr, npv, mortgagedAreaM2, mortgagedRanges },
  finance: { cashflow, tornado, npvBase, peakFunding },
  diagnostics: { stageTimingsMs, widthIterations, solverGap, warnings },
  params }
```
