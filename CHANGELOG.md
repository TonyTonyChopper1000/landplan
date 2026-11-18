# Changelog

## 3D Render mode and public viewer
- 3D tab: **Massing / Render** toggle. Massing is unchanged (default); **Generate render** builds a detailed,
  project-type-aware scene with a progress bar. Lazy-loaded; the main bundle does not grow.
- Shared scene kit: roads at true width with centre/edge lines, zebra crossings, stop lines, pink paver
  footpaths, kerbs (yellow-black at junctions and the gate), painted road names (editable), street lamps,
  avenue trees, compound wall with pillars, entrance arch with the name board, security cabin, external
  approach road with median and palms; named gardens with fountain, gazebo, kids' play, box cricket, mini
  football, open gym, pavilion, party lawn, jogging track; clubhouse with pool; overhead tank and
  transformer yard; lakes, nalas, green belts and HT towers for buffers. Instanced trees with wind sway.
- Plots: levelled pads with boundary stones and crisp edges, sample homes, "future homes" ghost massing.
  Villas: Hyderabad-contemporary villas from real setbacks and floors (6 palettes, 3 elevations, premium
  corner / east-facing). Farm: plantation rows with drip lines, wire fence on stone posts, plot gates,
  cottages, borewell, farm pond.
- Sales viewer: Morning / Noon / Golden / Night presets that follow the real sun (night = blue hour),
  date/time sliders and sun readout; Aerial / Arrival / Plan / Walk cameras; status colours and legend;
  plot numbers, dimensions and areas on the ground; Find a plot; Refine (status, budget, size, facing,
  frontage, corner); plot card with price and WhatsApp; Layers, Info (authority, survey nos., LP number,
  compliance summary), Share (link, deep link, iframe embed), Gallery, Download (PNG 1×/2×/4K, 28 s
  1080p WebM film, PDF brochure), all stamped. Quality presets Mobile / High / Ultra (path-traced).
- Surroundings: Google Photorealistic 3D Tiles when `VITE_GOOGLE_MAPS_KEY` is set and the parcel is
  georeferenced, else Esri satellite, else procedural fields.
- Public viewer at `/view/:projectId` (`?plot=51` deep links) and demos at `/view/demo-plots|villas|farm`.
- New optional project details: developer WhatsApp, LP number, brand colour.
- `scripts/render-shots.mjs` captures every view per project type.

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
