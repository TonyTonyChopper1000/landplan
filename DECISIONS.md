# Decisions and assumptions

The v1 HTML file was not available in the repository, so the engine was ported from the written spec (§3).

## Parity
- **Fixtures**: generated from `src/engine/__tests__/v1reference.ts`, an independent single-function
  re-implementation of §3 that shares no code with `src/engine`. The parity suite (5 presets × 3 parameter
  sets) checks that the production engine and the reference agree exactly on grid choice, plot count,
  areas (1e-6 m²), widths, corner/irregular flags, numbering and mortgage flags. If the original v1 file
  turns up, regenerate fixtures from it by deleting `fixtures/` and adapting `v1reference.ts`.
- **Preset unit coordinates** (`parcel.ts`) are reconstructions; replace them with the v1 values if known.
- **v1 plot mix**: 150×2, 167×1, 200×3, 240×2, 267×1, 300×2, 400×1 (120 sq yd present but off).
- **Width cycle** continues across rows and blocks (one global cursor) in generation order.
- **Open-space distance** uses the centroid of the clipped block.
- Road bands are inclusive (≤600, ≤1000) in both modes; this is a reporting fix, it never changes geometry.

## Rule-aware mode
- Turned on by "Apply GO 105 standards" or the Site → Engine switch. Drawing any constraint also uses the
  robust (clipper) geometry path because buffers create holes; v1 open-space/corner logic still applies in parity.
- **Open-space split**: parks are whole blocks (road-bounded, so OS-ADJ holds); the utility strip is carved
  from the road end of the last park block (abuts road + park, never plots); SI is carved from the road end
  of the most central plotted block (abuts plots, which is allowed; never park/utilities).
- **Corner** (rule-aware): a row-end plot whose end faces a spine road that exists inside the inset parcel.
- **Splays**: a right-isosceles triangle with legs from RD-TABLE by the wider road ROW (12 → 3 m, 18 → 4.5 m,
  24 → 6 m), cut at every block corner where a road junction exists.
- **Road hierarchy**: if any frontage (or spine) run > 600 m, that whole road family is regenerated at 18 m.
- **Master-plan give-up**: half the (MP − existing) approach shortfall × length of the south-most parcel edge,
  plus the declared road-affected strip. Deducted from net layout area for the open-space test; not cut geometrically.
- **Massing setbacks**: front from SB-FRONT; rear 1 / 1.5 / 2 m and sides 0 / 1 / 1.5 m by the same size bands are
  assumptions (flagged "verify").
- **Buffers**: HT green belt = tower base / 2 + 3 m safety each side of the line; heritage 100 m disc excluded,
  100–200 m raises a warning. HT belts never count toward open space (HT-GREEN).
- **Approach road** between 9 m and 18 m passes with a widening + road-impact-fee note (100% of DC, 50% if
  existing ≥15 m vs MP 18 m).

## Finance
- Land cost and fees at month 0; development cost spread over min(24, release months).
- Non-mortgaged plots sell from month 1 at the velocity; mortgaged plots join the queue after release.
- Price escalation compounds monthly from the annual rate. NPV uses the monthly equivalent of the discount rate.

## Stack deviations
- **XLSX**: the npm `xlsx` (SheetJS) build has unpatched advisories and the SheetJS CDN is blocked here, so
  `write-excel-file` is used for XLSX export.
- shadcn/ui CLI was not used (no network registry); accessible primitives are Radix Slider plus hand-built,
  token-styled components in `src/components/ui`.
- Remaining `npm audit` items are dev-only tooling (vite/vitest/typescript-eslint transitive ranges).
