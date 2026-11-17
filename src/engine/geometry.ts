// Pure geometry helpers. Metres, y = north. No React imports anywhere in src/engine.

export type Pt = { x: number; y: number };
export type Poly = Pt[];
/** A region is a set of rings. Outer rings are CCW (positive area), holes are CW (negative). */
export type Region = Poly[];
export type Rect = { x0: number; y0: number; x1: number; y1: number };

export const ACRE = 4046.8564224;
export const SQYD = 0.83612736;
export const FT = 0.3048;
export const GUNTA = ACRE / 40;
export const HECTARE = 10000;

export function signedArea(p: Poly): number {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i];
    const r = p[(i + 1) % n];
    a += q.x * r.y - r.x * q.y;
  }
  return a / 2;
}

export const area = (p: Poly): number => Math.abs(signedArea(p));

export function regionArea(r: Region): number {
  let a = 0;
  for (const ring of r) a += signedArea(ring);
  return Math.abs(a);
}

export function centroid(p: Poly): Pt {
  const a = signedArea(p);
  if (Math.abs(a) < 1e-12) {
    const s = p.reduce((acc, q) => ({ x: acc.x + q.x, y: acc.y + q.y }), { x: 0, y: 0 });
    return { x: s.x / Math.max(1, p.length), y: s.y / Math.max(1, p.length) };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i];
    const r = p[(i + 1) % n];
    const f = q.x * r.y - r.x * q.y;
    cx += (q.x + r.x) * f;
    cy += (q.y + r.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function regionCentroid(r: Region): Pt {
  let ax = 0;
  let ay = 0;
  let at = 0;
  for (const ring of r) {
    const a = signedArea(ring);
    if (Math.abs(a) < 1e-12) continue;
    const c = centroid(ring);
    ax += c.x * a;
    ay += c.y * a;
    at += a;
  }
  return at === 0 ? { x: 0, y: 0 } : { x: ax / at, y: ay / at };
}

export const ensureCCW = (p: Poly): Poly => (signedArea(p) < 0 ? [...p].reverse() : p);

export function rotate(p: Pt, rad: number, o: Pt = { x: 0, y: 0 }): Pt {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
}

export const rotatePoly = (p: Poly, rad: number, o?: Pt): Poly => p.map((q) => rotate(q, rad, o));
export const rotateRegion = (r: Region, rad: number, o?: Pt): Region => r.map((p) => rotatePoly(p, rad, o));

export function bbox(points: Pt[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of points) {
    if (q.x < x0) x0 = q.x;
    if (q.y < y0) y0 = q.y;
    if (q.x > x1) x1 = q.x;
    if (q.y > y1) y1 = q.y;
  }
  return { x0, y0, x1, y1 };
}

export const rectPoly = (r: Rect): Poly => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
];

export const rectArea = (r: Rect): number => (r.x1 - r.x0) * (r.y1 - r.y0);

/**
 * v1 clip: Sutherland–Hodgman of a subject polygon against an axis-aligned rectangle.
 * Kept verbatim in behaviour for parity mode.
 */
export function clipRect(subject: Poly, r: Rect): Poly {
  type Inside = (p: Pt) => boolean;
  type Cut = (a: Pt, b: Pt) => Pt;
  const edges: [Inside, Cut][] = [
    [(p) => p.x >= r.x0, (a, b) => ({ x: r.x0, y: a.y + ((b.y - a.y) * (r.x0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= r.x1, (a, b) => ({ x: r.x1, y: a.y + ((b.y - a.y) * (r.x1 - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= r.y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y0 - a.y)) / (b.y - a.y), y: r.y0 })],
    [(p) => p.y <= r.y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y1 - a.y)) / (b.y - a.y), y: r.y1 })],
  ];
  let out = subject;
  for (const [inside, cut] of edges) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = inside(cur);
      const pi = inside(prev);
      if (ci) {
        if (!pi) out.push(cut(prev, cur));
        out.push(cur);
      } else if (pi) {
        out.push(cut(prev, cur));
      }
    }
  }
  return out;
}

/** v1 naive inset: offset each edge inward and intersect consecutive offset lines. Fails on spiky parcels. */
export function naiveInset(p: Poly, d: number): Poly {
  if (d <= 0) return p;
  const n = p.length;
  const lines: { p: Pt; d: Pt }[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const nrm = { x: -dir.y, y: dir.x }; // inward for CCW
    lines.push({ p: { x: a.x + nrm.x * d, y: a.y + nrm.y * d }, d: dir });
  }
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i + n - 1) % n];
    const l2 = lines[i];
    const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
    if (Math.abs(den) < 1e-9) {
      out.push(l2.p);
      continue;
    }
    const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
    out.push({ x: l1.p.x + l1.d.x * t, y: l1.p.y + l1.d.y * t });
  }
  return out;
}

export function pointInPoly(pt: Pt, p: Poly): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i];
    const b = p[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Even-odd test across all rings: holes are excluded. */
export function pointInRegion(pt: Pt, r: Region): boolean {
  let inside = false;
  for (const ring of r) if (pointInPoly(pt, ring)) inside = !inside;
  return inside;
}

/** Intersections of the horizontal line y = c with a region, returned as sorted x-intervals inside. */
export function horizontalRuns(r: Region, c: number): [number, number][] {
  const xs: number[] = [];
  for (const ring of r) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (a.y > c !== b.y > c) xs.push(a.x + ((c - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
  }
  xs.sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) runs.push([xs[i], xs[i + 1]]);
  return runs;
}

export function verticalRuns(r: Region, c: number): [number, number][] {
  const swapped = r.map((ring) => ring.map((q) => ({ x: q.y, y: q.x })));
  return horizontalRuns(swapped, c);
}

export function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Minimum distance between two polygon boundaries (0 when they touch or overlap). */
export function polyDistance(a: Poly, b: Poly): number {
  const ba = bbox(a);
  const bb = bbox(b);
  const gap = Math.max(ba.x0 - bb.x1, bb.x0 - ba.x1, ba.y0 - bb.y1, bb.y0 - ba.y1, 0);
  if (gap > 1) return gap;
  if (a.some((q) => pointInPoly(q, b)) || b.some((q) => pointInPoly(q, a))) return 0;
  let m = Infinity;
  for (const p of a) for (let i = 0; i < b.length; i++) m = Math.min(m, segDist(p, b[i], b[(i + 1) % b.length]));
  for (const p of b) for (let i = 0; i < a.length; i++) m = Math.min(m, segDist(p, a[i], a[(i + 1) % a.length]));
  return m;
}

export function polylineLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

export function regionToPath(r: Region, flipY = true): string {
  return r
    .map(
      (ring) =>
        ring.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${(flipY ? -q.y : q.y).toFixed(2)}`).join('') + 'Z',
    )
    .join('');
}

export const polyToPath = (p: Poly, flipY = true): string => regionToPath([p], flipY);
