LandPlan Studio — Frontend Build Prompt (React + Vite)
Paste this whole file into your coding agent (Claude Code or similar), or save it in the repo as PROMPT.md and say "follow PROMPT.md".

0. How you must work
ultrathink. Before writing code, think step by step through the engine port, the state model and the screen map. Write a short PLAN.md first, then build in the phases in §14.
Skills: If these skills are installed, load them before starting:
frontend-design: read it before writing any UI. It sets the bar for a distinctive, non-templated interface.
webapp-testing: use it (Playwright) to open the running app, take screenshots of every screen at 1440 px and 390 px, and fix what looks wrong before you call a phase done.
theme-factory (optional): use it to generate and test the token palette below.
Make the design decisions yourself. Don't stop to ask questions. Write any assumption into DECISIONS.md.
Use no lorem ipsum and no placeholder art. Every number on screen comes from the engine.

1. Product
LandPlan Studio is an automated plotted-layout and feasibility studio for residential plotted developments in Telangana, under HMDA, DTCP or a municipality (GO Ms 105 layout rules).
The user describes a land parcel and planning parameters. The app generates the full layout: roads, blocks, plots, open space, utilities and social infrastructure. It then checks the layout against cited regulations and produces the plot schedule, area statement and financials.
Users are land developers, architects and planners, and real-estate sales teams in Hyderabad.
It is a yield study tool, not a submission drawing. That disclaimer must appear on the plan, in exports and in reports.
v1 was a single HTML file (vanilla JS + SVG). You are rebuilding it as a production-grade React app and extending it.

2. Non-negotiables
Parity. Port the v1 engine to TypeScript. With the same inputs, the result must be identical in plot count, areas and numbering. Write Vitest parity tests for 5 parcel presets × 3 parameter sets, comparing against snapshot fixtures generated from the v1 algorithm in §3.
Determinism. The same inputs must always give the same layout, with no Math.random. If randomness is ever needed, use a seeded PRNG and keep the seed in the state.
New parameters are additive. Every new parameter in §5 has a neutral default that reproduces v1 behaviour. A one-click "Apply GO 105 standards" preset switches the rule-aware defaults on.
Honest compliance. A check without a citable source shows Not checked, never a green tick. Conflicting sources show Sources conflict.
Fully client-side. There is no backend in this phase. Persist projects to IndexedDB, and keep the current scenario in a shareable URL using compressed state in the hash.

3. Engine spec to port (preserve exactly)
Units are metres internally. ACRE = 4046.8564224 m², SQYD = 0.83612736 m², FT = 0.3048 m.
Parcel: a preset polygon (rect, tri, trap, L, irr; unit coordinates from v1) is made counter-clockwise, scaled to acres × ACRE and centred on its centroid.
Boundary road: inset the parcel by periph metres.
Grid: rotate the parcel by −θ and take its bbox. A block is blockLen × 2·plotDepth (two plot rows back to back). The vertical pitch is 2·plotDepth + roadY and the horizontal pitch is blockLen + roadX. The grid origin is min − offset × pitch. Clip each block to the parcel (Sutherland–Hodgman against an axis-aligned rectangle). Keep a block only if its area is more than 2.5 × minPlot, where minPlot = 70 sq yd.
Open space: sort blocks by the distance of their centre from the parcel centroid. Mark the closest ones as open until their cumulative area reaches at least gross × openPct.
Plot widths: width = sizeSqYd × SQYD / plotDepth. Build the sequence from the enabled sizes, repeating each size by its weight. Sort it ascending, then interleave low/high (lo, hi, lo+1, hi−1…).
Plots: in every non-open block, fill both rows (front side fs = −1 for the bottom row and +1 for the top row) along the block length using the cycling width sequence. Clip each plot to the block. Keep a plot if its area ≥ 60% of the full rectangle and ≥ minPlot. A plot is irregular if its area is < 96.5% of the full rectangle. The first and last plot in each row are corner.
Optimizer: θ from 0 to 85° in steps of 5°, × blockLen ∈ {base, 0.75·base, 1.25·base}, × offX and offY ∈ {0, ⅓, ⅔}. Keep the result with the maximum plotted area.
Annotation:
Plots are numbered in generation order.
Facing is the front-side normal rotated by θ and adjusted for the north offset, snapped to 8 directions.
Price multiplier = 1 + facingPremium + (corner ? 0.12 : 0) − (irregular ? 0.05 : 0). Default premiums: N .06, NE .10, E .08, SE .02, S 0, SW −.02, W 0, NW .02.
Mortgage: take plots in descending plot number and mark each one mortgaged until the cumulative area reaches at least mortPct of plotted area. Whole plots only.
Road runs: intersect the road centrelines with the inset parcel to get run lengths. The required right-of-way by length comes from the road table in §8.
4. v1 defects to fix
Fix these in rule-aware mode, keeping parity mode untouched:
Road area was gross − blockArea, which also counted discarded slivers and the boundary strip. Report roads, boundary road, unusable slivers and buffers as separate lines.
"Corner" was just the end of a row. In rule-aware mode, a corner is a plot that touches a road junction.
Junction splays were not cut. Cut splays per the road table and subtract them from the affected plots.
The open-space check passed by construction. Check it against net layout area after master-plan road give-up. Also check the minimum pocket size and the adjacency rules in §8.
The spine road used the DTCP rule even under HMDA. Rules must come from the selected authority profile.
The 3D label was hard-coded to "60% ground coverage". Derive coverage from setbacks.
A road run of exactly 1000 m returned "unknown". Fix the band boundaries.
The optimizer blocked the main thread. Move it to a Web Worker (Comlink) with progress and cancel.
The naive polygon inset failed on spiky parcels. Use a robust offset library (clipper-lib or Turf buffer).

5. Parameters
Keep all v1 parameters, plus the new ones below. New parameters ship with neutral defaults.
Group
Parameter
Default
Site
Parcel source: preset / draw polygon / bearings-and-distances table / import GeoJSON, KML, DXF
preset L

Extent (acres), north offset (°)
17, 0

Authority profile: HMDA / DTCP / Municipality (GO 105) / Custom
HMDA

Existing approach road width (m), master-plan road width (m), road-affected strip (m²)
18, 18, 0
Constraints (drawn on canvas)
Lake FTL polygon + lake area (ha) → buffer auto 30 m / 9 m
none

Nala line + width (m) → buffer auto 9 m / 2 m
none

HT line (voltage, tower base width) → green belt + 3 m safety
none

Railway edge → 30 m buffer
none

Heritage point → 100 m / 200 m rings
none

Count buffer toward open space (Rule 16(1)(e)(ii))
off
Plot mix
Plot depth (ft), sizes on/off + weight (120–400 sq yd), block length (m)
60, v1 mix, 150

Min plot area (m²), min plot width (m)
58.5 (=70 sq yd), 0

Allow mixed depths per block
off
Roads
Frontage, spine, boundary road widths (m)
12.2, 12.2, 0

Cut junction splays per table
off

Road hierarchy: auto-upgrade runs >600 m to 18 m
off
Open space
Total %, split: park %, utilities %, social infra %
10 / 10 / 0 / 0

Placement: central / distributed pockets / along buffer
central

Min pocket size (m²)
450
Built form (3D)
Floors (G+1…G+3), floor height (m), setbacks by plot size (from §8)
G+1, 3.6, on
Commercials
Base rate (₹/sq yd), dev cost (₹/sq yd gross), land cost (₹/acre)
32000, 6500, 0

Approval fees (₹/m²), road impact fee toggle
0, off

Mortgage %, release after (months)
25, 36

Sales velocity (plots/month), price escalation (%/yr), discount rate (%)
10, 6, 12

Editable facing/corner/irregular premiums
v1 values

6. Extensions to build
Draw and edit the parcel. Drag vertices, add or delete vertices, snap to grid, and show live area in acres, m² and guntas. Include a bearings-and-distances table editor and a Map underlay (MapLibre + satellite tiles) so users can trace a real site.
Constraint layers. Draw a lake, nala, HT line, railway or heritage point on the canvas. Buffers are generated automatically by the rules, shown as a soft hatched glow and deducted from the developable area.
Rule-aware generator. Splays, road hierarchy, an open-space split into park, utilities and social-infrastructure parcels, and the adjacency rules (open space can't abut plots; utilities must abut a road; social infrastructure can't abut open space or utilities).
Optimizer view. The worker streams results. Show a live heatmap of angle × block length → yield that fills in as the search runs, and a Pareto chart of yield vs. margin vs. failing checks. Clicking any point loads that layout.
Scenarios. Save, duplicate and rename scenarios. Compare two side by side with a draggable swipe divider on the plan, and show KPI deltas.
Plot inventory. Each plot has a status (Available / Held / Booked / Sold / Mortgaged) and a price override. Bulk-select by lasso on the plan.
Financials. Monthly cash flow (sales vs. development spend vs. mortgage release), IRR, NPV, peak funding need, and a sensitivity tornado chart for rate, cost, velocity and mortgage %.
3D massing. Use react-three-fiber. Show villas extruded per plot with setbacks, roads, trees on open space, a sun-path slider (date + time) with real shadows for Hyderabad (17.385°N), an orbit camera and a one-click fly-through.
Reports and exports.
A drawing-sheet mode with an architectural title block (project, survey nos., authority, scale, north arrow, date, revision, "Yield study only" stamp).
Export to PDF report, SVG, DXF (plan), XLSX/CSV (schedule) and GeoJSON (geometry).
AI assistant panel (UI only in this phase). A right-hand chat drawer with a typed interface askAssistant(context) → Promise<Answer>, mocked for now. It explains why a check fails and suggests one-click fixes (for example "Widen spine to 18 m"). The UI must be ready for a real backend later.
Power-user features:
⌘K command palette (cmdk)
Undo/redo (zundo)
Keyboard shortcuts: G regenerate, O optimize, 1–6 switch tabs, [ ] rotate grid
Autosave
Shareable link
Language. English by default. Structure all strings for i18n (Telugu later).

7. Information architecture
App shell
Top bar: project name (editable) · authority badge · scenario switcher · compliance ring (verified / failing / conflict / not-checked) · Generate · Optimize · Export · ⌘K · theme toggle.
Left rail: icon navigation for the parameter panels: Site, Constraints, Plot mix, Roads, Open space, Built form, Commercials. Panels are collapsible accordions with sliders and number inputs that update the layout live (debounced at 120 ms).
Bottom dock:
A KPI ticker: gross ac, plots, saleable %, roads %, open %, avg plot, sellable now ₹Cr, mortgaged ₹Cr, margin %.
A land-distribution bar: a stacked horizontal bar of plots / roads / open space / utilities / social infra / buffers / slivers that animates on every change.
Main routes (tabs)
Studio: the plan canvas plus a contextual Inspector on the right.
Hover a plot to see a tooltip: no., size, dims, facing, price.
Click a plot to show its full card in the Inspector.
Click a failing check to highlight the offending geometry on the plan with a pulsing outline.
3D: the massing view described in §6.
Schedule: TanStack Table with sticky header, virtual rows, column filters, group-by size or facing, inline price edit and export.
Feasibility:
The compliance tally.
Geometry checks (computed).
Document checks (manual checklist with evidence upload placeholders and status).
Road runs table, area statement, plot mix.
Financials: KPIs, cash-flow chart, tornado chart, assumptions.
Regulations: the rule library. See §8.
Compare: two scenarios side by side.
Responsive behaviour:
≥1280 px: three columns.
768–1279 px: the Inspector becomes a drawer.
<768 px: parameters become a bottom sheet, the canvas goes full-width, and the KPIs become swipeable cards.

8. Regulations tab + seed data
The rules live in src/rules/regulations.ts as typed data. Every check in the engine references rules by id. Nothing is hard-coded in the components.
type Rule = {
  id: string; title: string; category: 'Open space'|'Roads'|'Plots'|'Mortgage'|'Buffers'|'Utilities & SI'|'NOCs'|'Process'|'Built form';
  authorities: ('HMDA'|'DTCP'|'MUNICIPAL')[]; reference: string; // GO / rule no.
  value: unknown; summary: string;
  sourceUrl: string; sourceType: 'official'|'go-copy'|'secondary';
  status: 'in-force'|'conflict'|'verify'; conflictsWith?: string[];
  lastVerified: '2026-11-17'; usedBy: string[]; // check ids
};
Regulations tab UI
A searchable, filterable card grid with filters for category, authority, status and source type.
Each card shows:
the rule title, value chip, and GO reference in mono
a source-confidence badge: Official / GO copy / Secondary
"last verified" date
"used by N checks" chips that link to the Feasibility tab
a source link
A Conflicts lane at the top that shows conflicting rules side by side with a "pick which to apply" control. The choice is stored per project with a note, as an audit trail.
An Override control on each rule (custom value + reason) that marks the check "Overridden" in Feasibility.
A banner: "Rules change by GO. Verify each rule against the current text before relying on it."
Seed rules
Researched 17 Nov 2026. Encode every row below.
id
Rule
Value
Ref
Source
Status
OS-10
Public-purpose reservation
≥10% of layout area
GO 105 (2021)
https://tgbpass.telangana.gov.in/html/docs/FAQ_Layout.docx.pdf
in-force
OS-SPLIT-105
Open-space split
9% green/parks + 1% utilities
GO 105 FAQ Q9
same as above
conflict ↔ OS-SPLIT-MUN
OS-SPLIT-MUN
Open-space split (municipal layout rules text)
7.5% parks + 1% social infra + 1% utilities
TS Municipal Layout Rules
https://www.scribd.com/document/628855812/Layout-Rules-telangana
conflict
OS-SI-MP2031
Social infra inside 10% (HMDA MP 2031)
up to 2.5%
HMDA Master Plan 2031
https://www.grihashakti.com/knowledge-centre/hmda-master-plan-hyderabad.aspx
verify (secondary)
OS-ADJ
Open space must not abut individual plots
boolean
GO 105 FAQ Q10
tgbpass FAQ
in-force
UT-ADJ
Utility area must not touch plots; must abut a road
boolean
GO 105 FAQ Q11
tgbpass FAQ
in-force
SI-ADJ
Social infra must not abut open space or utilities
boolean
GO 105 FAQ Q12
tgbpass FAQ
in-force
SI-USE
Permitted SI uses (saleable for these only)
pharmacy, clinic, school, play school, crèche, dispensary, convenience shops
GO 105 FAQ Q13–14
tgbpass FAQ
in-force
OS-450
Minimum open-space pocket
450 m²
HMDA guidance (v1)
https://www.hmda.gov.in/wp-content/uploads/2020/07/LRS1.pdf
verify
RD-TABLE
Road width by run length
≤600 m: ROW 12 m, splay 3 m, carriageway 6 m · 600–1000 m: 18 m, 4.5 m, 11 m · >1000 m: 24 m, 6 m, per IRC
GO 105 Rule 5(3) Table I
https://www.scribd.com/document/628855812/Layout-Rules-telangana
in-force
RD-APPROACH
Approach road
existing ≥9 m; required 18 m; widen equally both sides + road impact fee 100% of DC (50% if existing 15 m vs MP 18 m)
GO 105 FAQ Q1–7
tgbpass FAQ
in-force
PL-MIN
Minimum plot
50 m² area, 6 m width
GO 105 FAQ Q15–16
tgbpass FAQ
in-force
MG-15
Mortgage
15% of plotted area, registered deed, whole plots only, before tentative layout release
GO 105 FAQ Q17–19
tgbpass FAQ
conflict ↔ MG-25
MG-25
HMDA procedure
mortgage 25%, sell 75% after approval
HMDA FAQs
https://www.hmda.gov.in/faqs/
conflict
MG-WORKS
Development works window before release
3 years
GO 276 (2010), cited in HMDA LP letters
https://www.scribd.com/document/567802534/Number-class
verify
BF-LAKE-L
Lake/tank/kunta ≥10 ha
30 m from FTL (incl. walking/cycling track)
GO 168 (2012)
https://www.deccanchronicle.com/southern-states/telangana/hydraa-demolitions-all-you-want-to-know-about-ftl-buffer-zone-1819329
in-force
BF-LAKE-S
Lake/kunta <10 ha, shikam
9 m from FTL
GO 168
https://www.scribd.com/doc/238258500/GOMsNo168
in-force
BF-NALA-W
Canal/vagu/nala/drain >10 m wide
9 m from boundary
GO 168
same as above
in-force
BF-NALA-N
Nala ≤10 m wide
2 m from boundary
GO 168 (secondary summary)
https://1acre.in/lakes
verify
BF-OS
Buffer may count toward open space; lake/river buffer may carry a ≥12 m road
boolean
Rule 16(1)(e)(ii), FAQ Q22
tgbpass FAQ
in-force
BF-RAIL
Railway buffer
30 m (may include road)
FAQ Q23
tgbpass FAQ
in-force
NOC-WATER
Irrigation + Revenue NOC trigger
within 200 m of lake/river, 50 m of nala
GO 168 / FAQ Q21
tgbpass FAQ
in-force
HT-SAFE
Electrical clearances
HT 3 m, LT 1.5 m; tower line: green belt = tower base width + ≥10 m road each side
Rule 3(c)(i), FAQ Q30
tgbpass FAQ
in-force
HT-GREEN
HT green belt is in addition to the 10% open space
boolean
GO amendment Rule 3(c)(ii)
https://www.scribd.com/document/625576139/GO-s
in-force
HER-ASI
Protected monument
0–100 m prohibited; 100–200 m needs NMA permission
AMASR Act / FAQ Q28
tgbpass FAQ
in-force
EC-50HA
State EIA environmental clearance
layouts ≥50 ha
FAQ Q27
tgbpass FAQ
in-force
FAC-50AC
Extra education/health/commercial facilities
layouts ≥50 acres (Appendix C)
FAQ Q20
tgbpass FAQ
verify
SB-FRONT
Front setback for massing preview
<200 m²: 1.5 m · 200–300 m²: 2 m · ≥300 m²: 3 m
GO 168 Table III
https://infralens.in/dcr/setbacks/warangal
verify (secondary)
PR-BUILDNOW
Filing route
BuildNow replaced TG-bPASS on 15 Dec 2025 for GHMC/HMDA/DTCP/municipalities
—
https://1acre.in/research/buildnow-telangana-building-permission-online
in-force
RD-HMDA-122
HMDA frontage road (v1 rule)
12.2 m design minimum; 9 m is an LRS regularisation standard
HMDA guidance vs LRS
https://www.hmda.gov.in/wp-content/uploads/2020/07/LRS1.pdf
conflict
Keep the v1 document checks as manual checklist rules:
land-use conformity
agricultural conversion
jurisdiction
master-plan road give-up
open-space gift deed + compound wall
title/EC/patta
services drawings
licensed technical person signature
BuildNow submission

9. Visual design: "Survey Command"
Concept: a night-time survey drawing room that has become a mission-control console. The look combines precise drafting linework, glowing blueprint cyan and a single hot "signal" orange for action. It should feel like an instrument, not a dashboard template.
Tokens
Evolved from v1. Define them as CSS variables + Tailwind v4 theme, with dark as the default and a light "Paper" theme.
--asphalt #0F1114  --asphalt-2 #161A1F  --asphalt-3 #1F242B  --line #2A3038
--lane #F2F0EA  --lane-dim #9BA1AA  --signal #FF6B1A  --blueprint #3FC1D9
--sign-green #2F8F5B  --brake #D6453F  --conflict #3FC1D9  --unk #4A515C
plot bands: ≤200 #C9A227 · 201–300 #3FC1D9 · 301–450 #8C6FD6 · 450+ #FF6B1A · irregular #5A6270
Paper theme: background #F4F1EA (drafting paper), ink #1B1E22, linework #2D6E7E
Type
UI: Geist.
Numbers, coordinates and GO references: Geist Mono with tabular numerals.
Section headers: small caps with letter-spacing, in the style of a title block.
Don't use Inter.
Texture and detail
A faint 10 m engineering grid behind the canvas that scales with zoom.
Dimension lines with arrowheads on hover.
Crosshair cursor with live X/Y in metres.
A survey-style north arrow and scale bar.
Hairline 1 px borders, 4 px radii, no drop-shadow soup. Use glows only for the blueprint and signal accents.
Plan rendering
Use SVG for up to about 600 plots and switch to Canvas/WebGL above that.
Pan/zoom with inertia.
Plot numbers fade in by zoom level.
Mortgaged plots get an animated diagonal hatch.
Corner plots get an inner hairline.
Buffers get a soft cyan hatch.
Selection gets a signal-orange outline.
Motion
Use Motion (framer-motion), purposeful and under 400 ms.
Generate: roads draw in as strokes, then blocks fade up, then plots cascade in a staggered ripple from the centre outward.
Optimize: the heatmap cells light up as results stream in. The best cell pulses, and the plan morphs to the winner.
Number tickers roll when KPIs change. The land-distribution bar segments slide.
Compliance ring: the segments sweep around. A newly failing check shakes once.
Respect prefers-reduced-motion everywhere.
Empty, loading and error states
These are designed screens, not spinners. For example, the "No plots fit" screen suggests the three parameter changes most likely to help, as one-click buttons.
Skeletons follow the drafting grid.

10. Tech stack
Core: Vite + React 19 + TypeScript (strict). Tailwind CSS v4 + shadcn/ui (Radix) for accessible primitives, restyled to the tokens above.
State: Zustand (+ zundo for undo/redo, + persist to IndexedDB via idb-keyval). Use a selector discipline so a slider never re-renders the whole tree.
Engine: pure TS in src/engine/ with zero React imports. The optimizer runs in src/engine/worker.ts via Comlink.
Geometry: clipper-lib or @turf/turf for offsets and buffers. Keep the v1 Sutherland–Hodgman clip for parity mode.
3D: @react-three/fiber + @react-three/drei, lazy-loaded.
Map: maplibre-gl, lazy-loaded.
Charts: visx or Recharts, themed.
Tables and commands: TanStack Table + react-virtual, and cmdk.
Export: jsPDF + svg2pdf.js, SheetJS, a minimal DXF writer, GeoJSON.
Testing: Vitest (engine parity + rules), Playwright (smoke + screenshots).
Folder layout
src/
  engine/   (geometry.ts, parcel.ts, layout.ts, optimize.ts, mortgage.ts, annotate.ts, roads.ts, checks.ts, finance.ts, worker.ts)
  rules/    (regulations.ts, profiles.ts)
  state/    (project.ts, scenarios.ts, ui.ts)
  features/ (studio, three, schedule, feasibility, financials, regulations, compare, reports, assistant)
  components/ui, styles/tokens.css, i18n/en.json

11. Performance, accessibility and quality
Performance:
Regenerating 17 acres takes under 50 ms on the main thread.
The full optimizer finishes in under 2 s in the worker, with progress and cancel.
Plan pan/zoom holds 60 fps with 500 plots.
Lighthouse performance score ≥90.
3D and map are code-split.
Accessibility:
WCAG 2.1 AA contrast in both themes.
Every control is keyboard-reachable.
Visible focus rings in signal orange.
The plan has an accessible list alternative (the schedule).
Charts have data-table fallbacks.
Number formatting: Indian style everywhere (₹1,23,45,678; lakh and crore). Show area in m², sq yd and acres/guntas, with a units toggle.
Code quality: no any, ESLint + Prettier, and components under about 250 lines.

12. Acceptance checklist
[ ] Parity tests pass: v1 inputs → identical plots, areas and numbering.
[ ] "Apply GO 105 standards" turns on splays, 9/1 split, 50 m²/6 m minimum and 15% mortgage, and the Feasibility tab updates.
[ ] Drawing a lake ≥10 ha creates a 30 m buffer, the plots inside disappear and the area statement shows a buffer line.
[ ] The Regulations tab lists all seed rules. The conflicts lane shows MG-15 vs MG-25, OS-SPLIT-105 vs OS-SPLIT-MUN and RD-HMDA-122. Choosing one changes the checks.
[ ] Clicking a failing check highlights the geometry on the plan.
[ ] The optimizer heatmap streams, and cancel works.
[ ] Compare with the swipe divider works between two scenarios.
[ ] PDF drawing sheet, XLSX schedule, DXF and GeoJSON all export.
[ ] Undo/redo, ⌘K, the shareable URL and autosave all work.
[ ] Playwright screenshots at 1440 px and 390 px look polished. Fix anything that looks templated or misaligned.

13. Out of scope for this phase
Backend and auth.
A real AI assistant (mock only).
Live fetching of rules from government sites. The rules ship as versioned seed data, with an "Update rules" button stubbed for later.
Payment and CRM.

14. Build phases
Ship each phase with screenshots before moving to the next.
Engine port + parity tests. Rules data + profiles.
Shell + design system: tokens, top bar, rail, dock, theme toggle, ⌘K.
Studio: plan canvas, live parameters, Inspector, generate animation, worker optimizer + heatmap.
Feasibility + Regulations tab.
Schedule + Financials.
Constraints drawing + parcel editor + map underlay.
3D massing with sun path.
Scenarios/Compare, exports, assistant drawer (mock), polish pass using the frontend-design skill review.


