import { describe, expect, it } from 'vitest';
import { cleanPolygon, fromLocal, intake, reconcile, SiteError, toUtm, traverse } from '../site';
import { ACRE, GUNTA, area } from '../geometry';

describe('site intake', () => {
  it('Bowditch-adjusts a traverse within 1:1000 and closes it', () => {
    const t = traverse([
      { bearing: 90, distance: 200 },
      { bearing: 0, distance: 150.05 },
      { bearing: 270, distance: 200 },
      { bearing: 180, distance: 150 },
    ]);
    expect(t.adjusted).toBe(true);
    expect(t.misclosure).toBeCloseTo(0.05, 6);
    expect(area(t.polygon)).toBeGreaterThan(29990);
  });
  it('rejects a traverse worse than 1:1000', () => {
    expect(() => traverse([{ bearing: 90, distance: 200 }, { bearing: 0, distance: 160 }, { bearing: 270, distance: 200 }, { bearing: 180, distance: 150 }])).toThrow(SiteError);
  });
  it('removes duplicate and collinear vertices and forces CCW', () => {
    const p = cleanPolygon([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 10.0001 },
      { x: 10, y: 10 },
      { x: 10, y: 5 },
      { x: 10, y: 0 },
    ]);
    expect(p).toHaveLength(4);
    expect(area(p)).toBeCloseTo(100, 3);
  });
  it('fixes a self-intersecting bow-tie by union', () => {
    const p = cleanPolygon([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
    expect(area(p)).toBeGreaterThan(0);
  });
  it('reconciles drawn vs record area in acres + guntas', () => {
    expect(GUNTA).toBeCloseTo(101.17, 2);
    const r = reconcile(7.4 * ACRE, 7, 16);
    expect(r.areaMismatchPct).toBeCloseTo(0, 6);
    expect(reconcile(8 * ACRE, 7, 0).warning).toMatch(/differs/);
  });
  it('projects WGS84 → UTM 44N and back', () => {
    const [u] = toUtm([[78.4867, 17.385]]);
    const back = fromLocal({ x: 0, y: 0 }, { local: 'EPSG:32644', origin: [u.x, u.y] });
    expect(back[0]).toBeCloseTo(78.4867, 7);
    expect(back[1]).toBeCloseTo(17.385, 7);
  });
  it('imports GeoJSON in WGS84 to local metres', () => {
    const r = intake({ kind: 'geojson', data: { type: 'Polygon', coordinates: [[[78.48, 17.38], [78.483, 17.38], [78.483, 17.383], [78.48, 17.383], [78.48, 17.38]]] } });
    expect(r.crs?.local).toBe('EPSG:32644');
    expect(r.acres).toBeGreaterThan(25);
    expect(r.acres).toBeLessThan(27);
  });
});
