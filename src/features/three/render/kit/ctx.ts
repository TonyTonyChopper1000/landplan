// Everything a builder needs to know about the site, computed once.
import { centroid, rotate, type Pt } from '@/engine/geometry';
import { approachEdgeIndex } from '@/engine/layout';
import { mulberry32 } from '@/engine/prng';
import type { Layout, RoadRun } from '@/engine/types';
import type { ProjectDetails, ProjectType } from '@/features/projects/types';

export type TreeKind = 'palm' | 'gulmohar' | 'jacaranda' | 'neem' | 'rain' | 'mango' | 'coconut' | 'teak' | 'sanders';
export type TreeSpot = { p: Pt; kind: TreeKind; s: number };
export type Lamp = { p: Pt; h: number; arm: number; angle: number };
export type Label = { text: string; p: Pt; h: number; size: number; kind: 'amenity' | 'entry' | 'gate' };
export type RoadLabel = { text: string; p: Pt; angle: number; size: number; id: string };
export type Garden = { name: string; p: Pt; items: string[] };

export type SceneCtx = {
  layout: Layout;
  type: ProjectType;
  name: string;
  details: Partial<ProjectDetails>;
  theta: number;
  origin: Pt;
  rot: (p: Pt) => Pt;
  size: number;
  centre: Pt;
  gate: { p: Pt; inward: Pt; tangent: Pt; width: number; edgeLen: number; edgeMid: Pt };
  approachWidth: number;
  rng: () => number;
  trees: TreeSpot[];
  lamps: Lamp[];
  labels: Label[];
  roadLabels: RoadLabel[];
  gardens: Garden[];
  arrival: Pt[];
  roadNames: Record<string, string>;
  blockers: { p: Pt; r: number }[];
  occupied: (p: Pt) => boolean;
};

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};

export function defaultRoadName(r: RoadRun, i: number): string {
  return r.axis === 'spine' && r.width >= 15 ? `${Math.round(r.width)} m Spine Road` : `${Math.round(r.width)} m Road ${i + 1}`;
}

export function makeCtx(layout: Layout, type: ProjectType, name: string, details: Partial<ProjectDetails>, roadNames: Record<string, string> = {}): SceneCtx {
  const origin = centroid(layout.parcel);
  const theta = (layout.theta * Math.PI) / 180;
  const b = layout.bounds;
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const parcel = layout.parcel;
  const ei = approachEdgeIndex(parcel, layout.params);
  const ea = parcel[ei];
  const eb = parcel[(ei + 1) % parcel.length];
  const tangent = norm(sub(eb, ea));
  // CCW parcel: interior is to the left of a→b.
  const inward = { x: -tangent.y, y: tangent.x };
  const edgeMid = { x: (ea.x + eb.x) / 2, y: (ea.y + eb.y) / 2 };
  const edgeLen = len(sub(eb, ea));
  // Gate where an internal road meets the approach edge: the run end nearest the edge and roughly perpendicular to it.
  let best: { p: Pt; w: number; d: number } | null = null;
  for (const r of layout.roadRuns) {
    const dir = norm(sub(r.b, r.a));
    if (Math.abs(dir.x * tangent.x + dir.y * tangent.y) > 0.6) continue;
    for (const e of [r.a, r.b]) {
      const rel = sub(e, ea);
      const t = rel.x * tangent.x + rel.y * tangent.y;
      if (t < r.width || t > edgeLen - r.width) continue;
      const d = rel.x * inward.x + rel.y * inward.y;
      const score = d + Math.abs(t - edgeLen / 2) * 0.05;
      if (d >= -1 && (!best || score < best.d)) best = { p: { x: ea.x + tangent.x * t, y: ea.y + tangent.y * t }, w: r.width, d: score };
    }
  }
  const gateP = best?.p ?? edgeMid;
  const blockers: { p: Pt; r: number }[] = [];
  const seedStr = `${name}|${layout.plots.length}|${layout.theta}`;
  let seed = 7;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return {
    layout,
    type,
    name,
    details,
    theta,
    origin,
    rot: (p: Pt) => rotate(p, theta, origin),
    size,
    centre: origin,
    gate: { p: gateP, inward, tangent, width: Math.max(9, best?.w ?? layout.frontage), edgeLen, edgeMid },
    approachWidth: Math.max(9, layout.params.site.approachExisting || 12),
    rng: mulberry32(seed),
    trees: [],
    lamps: [],
    labels: [],
    roadLabels: [],
    gardens: [],
    arrival: [],
    roadNames,
    blockers,
    occupied: (p: Pt) => blockers.some((b) => Math.hypot(p.x - b.p.x, p.y - b.p.y) < b.r + 1.2),
  };
}
