// Robust polygon boolean ops and offsets via clipper-lib (integer millimetres internally).
import ClipperLib from 'clipper-lib';
import type { Poly, Pt, Region } from './geometry';
import { regionArea } from './geometry';

const S = 1000;

const toPath = (p: Poly): ClipperLib.Path => p.map((q) => ({ X: Math.round(q.x * S), Y: Math.round(q.y * S) }));
const toPaths = (r: Region): ClipperLib.Paths => r.map(toPath);
const fromPaths = (ps: ClipperLib.Paths): Region =>
  ps.filter((p) => p.length >= 3).map((p) => p.map((q) => ({ x: q.X / S, y: q.Y / S })));

function exec(type: ClipperLib.ClipType, subj: Region, clip: Region): Region {
  const c = new ClipperLib.Clipper();
  c.AddPaths(toPaths(subj), ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(toPaths(clip), ClipperLib.PolyType.ptClip, true);
  const out: ClipperLib.Paths = [];
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return fromPaths(out);
}

export const intersect = (a: Region, b: Region): Region =>
  a.length && b.length ? exec(ClipperLib.ClipType.ctIntersection, a, b) : [];
export const difference = (a: Region, b: Region): Region =>
  !a.length ? [] : !b.length ? a : exec(ClipperLib.ClipType.ctDifference, a, b);
export const union = (a: Region, b: Region = []): Region => exec(ClipperLib.ClipType.ctUnion, a, b);

/** Offset a closed region. Negative delta insets. Mitre joins keep road edges square. */
export function offsetRegion(r: Region, delta: number): Region {
  if (delta === 0) return r;
  const co = new ClipperLib.ClipperOffset(4, 0.25 * S);
  co.AddPaths(toPaths(r), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const out: ClipperLib.Paths = [];
  co.Execute(out, delta * S);
  return fromPaths(out);
}

/** Buffer an open polyline (or a point) by a radius on both sides. */
export function bufferLine(pts: Pt[], radius: number): Region {
  if (!pts.length || radius <= 0) return [];
  const co = new ClipperLib.ClipperOffset(2, 0.25 * S);
  const path = toPath(pts.length === 1 ? [pts[0], { x: pts[0].x + 0.001, y: pts[0].y }] : pts);
  co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  const out: ClipperLib.Paths = [];
  co.Execute(out, radius * S);
  return fromPaths(out);
}

export const circle = (c: Pt, r: number, n = 48): Poly =>
  Array.from({ length: n }, (_, i) => ({
    x: c.x + r * Math.cos((2 * Math.PI * i) / n),
    y: c.y + r * Math.sin((2 * Math.PI * i) / n),
  }));

export const touches = (a: Region, b: Region, tol = 0.05): boolean =>
  regionArea(intersect(offsetRegion(a, tol), b)) > 1e-4;
