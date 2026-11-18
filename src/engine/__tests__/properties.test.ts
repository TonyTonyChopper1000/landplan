import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyGo105, defaultParams } from '../defaults';
import { generate } from '../layout';
import { intersect } from '../clip';
import { ACRE, bbox, regionArea, type Pt } from '../geometry';
import { canonicalJson, inputHash } from '../hash';
import type { Params } from '../types';

/** Random star-shaped (hence simple) polygon scaled to an area between 1 and 100 acres. */
const polygonArb = fc
  .record({
    n: fc.integer({ min: 4, max: 10 }),
    radii: fc.array(fc.double({ min: 0.55, max: 1, noNaN: true }), { minLength: 10, maxLength: 10 }),
    acres: fc.double({ min: 1, max: 100, noNaN: true }),
    rot: fc.double({ min: 0, max: Math.PI, noNaN: true }),
  })
  .map(({ n, radii, acres, rot }) => {
    const pts: Pt[] = Array.from({ length: n }, (_, i) => {
      const a = rot + (2 * Math.PI * i) / n;
      return { x: Math.cos(a) * radii[i], y: Math.sin(a) * radii[i] };
    });
    let A = 0;
    for (let i = 0; i < n; i++) A += pts[i].x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * pts[i].y;
    const k = Math.sqrt((acres * ACRE) / Math.abs(A / 2));
    return pts.map((q) => ({ x: q.x * k, y: q.y * k }));
  });

const withPoly = (base: Params, poly: Pt[]): Params => ({ ...base, site: { ...base.site, source: 'drawn', polygon: poly } });

describe('property tests (1–100 acre random parcels)', () => {
  it('area statement always balances (both engines)', () => {
    fc.assert(
      fc.property(polygonArb, fc.boolean(), (poly, rules) => {
        const p = withPoly(rules ? applyGo105(defaultParams()) : defaultParams(), poly);
        const l = generate(p); // throws AreaBalanceError if unbalanced
        const sum = l.areaLines.reduce((s, x) => s + x.m2, 0);
        expect(Math.abs(sum - l.gross) / l.gross).toBeLessThan(1e-4);
      }),
      { numRuns: 40, seed: 42 },
    );
  });
  it('no plot under PL-MIN in rule-aware mode', () => {
    fc.assert(
      fc.property(polygonArb, (poly) => {
        const l = generate(withPoly(applyGo105(defaultParams()), poly));
        for (const pl of l.plots) {
          expect(pl.area).toBeGreaterThanOrEqual(50 - 1e-6);
          expect(pl.width).toBeGreaterThanOrEqual(6 - 1e-6);
        }
      }),
      { numRuns: 25, seed: 7 },
    );
  });
  it('plots never overlap each other or open space (< 1 cm²)', () => {
    fc.assert(
      fc.property(polygonArb, (poly) => {
        const l = generate(withPoly(applyGo105(defaultParams()), poly));
        const feats = [...l.plots.map((p) => p.region), ...l.open.map((o) => o.region)];
        const boxes = feats.map((r) => bbox(r.flat()));
        for (let i = 0; i < feats.length; i++)
          for (let j = i + 1; j < feats.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) continue;
            expect(regionArea(intersect(feats[i], feats[j]))).toBeLessThan(1e-4);
          }
      }),
      { numRuns: 10, seed: 11 },
    );
  });
  it('determinism: same input gives the same hash and the same layout', async () => {
    const p = applyGo105(defaultParams());
    const a = generate(p);
    const b = generate(JSON.parse(JSON.stringify(p)));
    expect(await inputHash(a.plots.map((x) => [x.no, x.area]))).toBe(await inputHash(b.plots.map((x) => [x.no, x.area])));
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});
