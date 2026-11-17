import { ACRE, area, centroid, ensureCCW, type Poly, type Pt } from './geometry';
import type { Params, PresetId } from './types';

/** v1 unit-coordinate presets (see DECISIONS.md). */
export const PRESETS: Record<PresetId, [number, number][]> = {
  rect: [
    [0, 0],
    [1.6, 0],
    [1.6, 1],
    [0, 1],
  ],
  tri: [
    [0, 0],
    [1.5, 0],
    [0.55, 1.25],
  ],
  trap: [
    [0, 0],
    [1.7, 0],
    [1.3, 1],
    [0.3, 1],
  ],
  L: [
    [0, 0],
    [1.6, 0],
    [1.6, 0.62],
    [0.82, 0.62],
    [0.82, 1.35],
    [0, 1.35],
  ],
  irr: [
    [0, 0.12],
    [0.92, 0],
    [1.55, 0.38],
    [1.42, 1.02],
    [0.78, 1.28],
    [0.08, 0.94],
  ],
};

export const PRESET_LABELS: Record<PresetId, string> = {
  rect: 'Rectangle',
  tri: 'Triangle',
  trap: 'Trapezoid',
  L: 'L-shape',
  irr: 'Irregular',
};

export function centre(p: Poly): Poly {
  const c = centroid(p);
  return p.map((q) => ({ x: q.x - c.x, y: q.y - c.y }));
}

/** Preset polygon made CCW, scaled to acres × ACRE and centred on its centroid. */
export function presetParcel(id: PresetId, acres: number): Poly {
  const unit = ensureCCW(PRESETS[id].map(([x, y]) => ({ x, y })));
  const s = Math.sqrt((acres * ACRE) / area(unit));
  return centre(unit.map((q) => ({ x: q.x * s, y: q.y * s })));
}

/** Bearings are whole-circle degrees clockwise from north. */
export function polygonFromBearings(rows: { bearing: number; distance: number }[]): Poly {
  const pts: Pt[] = [{ x: 0, y: 0 }];
  for (const r of rows.slice(0, -1)) {
    const prev = pts[pts.length - 1];
    const b = (r.bearing * Math.PI) / 180;
    pts.push({ x: prev.x + r.distance * Math.sin(b), y: prev.y + r.distance * Math.cos(b) });
  }
  return pts;
}

/** Closing error of a traverse, metres. */
export function traverseMisclose(rows: { bearing: number; distance: number }[]): number {
  let x = 0;
  let y = 0;
  for (const r of rows) {
    const b = (r.bearing * Math.PI) / 180;
    x += r.distance * Math.sin(b);
    y += r.distance * Math.cos(b);
  }
  return Math.hypot(x, y);
}

export function bearingsFromPolygon(p: Poly): { bearing: number; distance: number }[] {
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let brg = (Math.atan2(dx, dy) * 180) / Math.PI;
    if (brg < 0) brg += 360;
    return { bearing: Math.round(brg * 100) / 100, distance: Math.round(Math.hypot(dx, dy) * 100) / 100 };
  });
}

export function parcelFor(params: Params): Poly {
  const s = params.site;
  if (s.source !== 'preset' && s.polygon && s.polygon.length >= 3) return ensureCCW(s.polygon);
  return presetParcel(s.preset, s.acres);
}
