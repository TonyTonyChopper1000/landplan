# LandPlan Studio — build plan

## Engine port (src/engine, zero React)
- `geometry.ts` metres/ACRE/SQYD/FT, shoelace, centroid, v1 Sutherland–Hodgman `clipRect`, v1 `naiveInset`.
- `clip.ts` clipper-lib wrapper (boolean ops, offsets, line buffers) for rule-aware mode.
- `parcel.ts` presets → CCW → scale to acres → centre; bearings table ⇄ polygon.
- `layout.ts` `prepare(params)` (parcel, inset, buffers, developable) + `layoutWith(prep, grid)`:
  rotate −θ → bbox → block grid → clip → keep > 2.5·minPlot → open space → plots (cycling interleaved widths).
- `openspace.ts` v1 cumulative-nearest; rule-aware: parks vs **net** area, utility strip carved from a park
  block's road end, SI strip carved from a plotted block's road end, placement modes.
- `annotate.ts` / `mortgage.ts` numbering, facing (8-way, north offset), multipliers, whole-plot mortgage.
- `roads.ts` centreline × inset runs, inclusive bands (fixes 1000 m), splay per ROW.
- `areas.ts` v1 statement in parity; split lines (roads, splays, boundary, buffers, slivers) in rule-aware.
- `checks.ts`/`checks2.ts` every check cites rule ids; conflict groups; overrides; authority applicability.
- `finance.ts` monthly cash flow, IRR, NPV, peak funding, tornado. `optimize.ts` + `worker.ts` (Comlink).

## State model
Zustand `project` store: `params` (temporal via zundo for undo/redo), persisted to IndexedDB (idb-keyval),
mirrored to the URL hash (lz-string). Layout is derived (memoised, 120 ms debounced) — never stored.
`scenarios` store: named param snapshots. `ui` store: tab, selection, highlight, theme, units, drawers.

## Screen map
Shell (top bar, left rail panels, bottom dock with KPI ticker + land bar) →
Studio (plan + inspector) · 3D · Schedule · Feasibility · Financials · Regulations · Compare.
Drawers: optimizer, assistant, export, command palette.

## Phases
1 engine + parity · 2 shell/design system · 3 studio/optimizer · 4 feasibility/regulations ·
5 schedule/financials · 6 constraints/parcel editor/map · 7 3D · 8 scenarios/compare/exports/assistant/polish.
