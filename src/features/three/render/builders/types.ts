// One builder per project type. Each adds geometry to the shared buckets and returns the
// plot pads (for tint, picking and filters) plus optional extra groups.
import * as THREE from 'three';
import { offsetRegion } from '@/engine/clip';
import { pointInRegion, type Pt } from '@/engine/geometry';
import { mulberry32 } from '@/engine/prng';
import type { Plot } from '@/engine/types';
import { box, Buckets, flatRegion, normalise, planarUV, strip, wallSeg } from '../kit/geom';
import type { SceneCtx, TreeKind } from '../kit/ctx';
import type { Mats } from '../kit/materials';
import { buildPads, type Pads } from './pads';
import { buildVilla, plotFrame } from './villa';

export type TypeBuild = { pads: Pads; ghosts?: THREE.Group; padColour: THREE.Color };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function verges(ctx: SceneCtx, B: Buckets, mat: string) {
  for (const b of ctx.layout.blocks) {
    if (b.use !== 'plots') continue;
    const g = flatRegion(b.region, 0.05);
    if (g) B.add(mat, planarUV(g, mat === 'lawn' ? 24 : 6));
  }
}

function edges(B: Buckets, plots: Plot[], y: number, w = 0.12) {
  for (const p of plots)
    for (const ring of offsetRegion(p.region, -0.12))
      for (let i = 0; i < ring.length; i++) B.add('padEdge', strip(ring[i], ring[(i + 1) % ring.length], w, y));
}

export function buildPlots(ctx: SceneCtx, B: Buckets, mats: Mats): TypeBuild {
  const L = ctx.layout;
  const p = L.params;
  verges(ctx, B, 'lawn');
  const pads = buildPads(L.plots, mats.pad, 0.05, 0.3, 0.12);
  edges(B, L.plots, 0.305);
  // Boundary stones at every plot corner: white, red-capped.
  const seen = new Set<string>();
  for (const pl of L.plots)
    for (const ring of pl.region)
      for (const q of ring) {
        const k = `${Math.round(q.x * 2)},${Math.round(q.y * 2)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        B.add('boundaryStone', box(q, 0.2, 0.2, 0.45, 0.25, ctx.theta));
        B.add('accent2', box(q, 0.21, 0.21, 0.08, 0.7, ctx.theta));
      }
  // 2–4 sample homes near the entrance, and translucent G+1 "future homes" on every plot.
  const regular = L.plots.filter((q) => !q.irregular);
  const near = [...regular].sort((a, b) => dist(a.centroid, ctx.gate.p) - dist(b.centroid, ctx.gate.p));
  const n = Math.min(near.length, Math.max(2, Math.min(4, Math.round(regular.length / 60))));
  const samples = new Set(near.slice(0, n * 3).filter((_, i) => i % 3 === 0).map((q) => q.no));
  const rng = mulberry32(11);
  for (const q of regular)
    if (samples.has(q.no)) buildVilla(ctx, B, q, { floors: Math.max(1, p.built.floors), floorHeight: p.built.floorHeight, setbacks: p.built.setbacks, premium: true, hero: false, rng }, 0.3);
  const GB = new Buckets();
  for (const q of regular) if (!samples.has(q.no)) buildVilla(ctx, GB, q, { floors: 1, floorHeight: p.built.floorHeight, setbacks: p.built.setbacks, premium: false, hero: false, rng, ghost: true }, 0.3);
  const ghosts = GB.build(mats, { cast: () => false, receive: () => false });
  ghosts.name = 'ghosts';
  return { pads, ghosts, padColour: new THREE.Color('#cdb79a') };
}

export function buildVillas(ctx: SceneCtx, B: Buckets, mats: Mats): TypeBuild {
  const L = ctx.layout;
  const p = L.params;
  const floors = Math.max(1, ctx.details.floors ?? p.built.floors);
  verges(ctx, B, 'lawn');
  const pads = buildPads(L.plots, mats.pad, 0.05, 0.12, 0.05);
  const rng = mulberry32(23);
  const regular = L.plots.filter((q) => !q.irregular);
  const hero = [...regular].sort((a, b) => dist(a.centroid, ctx.gate.p) - dist(b.centroid, ctx.gate.p))[1];
  for (const q of regular) {
    const premium = q.corner || q.facing === 'E' || q.facing === 'NE';
    buildVilla(ctx, B, q, { floors, floorHeight: p.built.floorHeight, setbacks: p.built.setbacks, premium, hero: q === hero, rng });
  }
  // Irregular plots: landscaped pads, no house.
  for (const q of L.plots.filter((x) => x.irregular)) {
    const g = flatRegion(offsetRegion(q.region, -0.3), 0.13);
    if (g) B.add('lawn', planarUV(g, 24));
  }
  return { pads, padColour: new THREE.Color('#9db07a') };
}

function plantation(name: string | undefined): TreeKind[] {
  const s = (name ?? '').toLowerCase();
  const out: TreeKind[] = [];
  if (s.includes('mango')) out.push('mango');
  if (s.includes('sander')) out.push('sanders');
  if (s.includes('coconut')) out.push('coconut');
  if (s.includes('teak')) out.push('teak');
  return out.length ? out : ['mango', 'teak', 'coconut'];
}
const SPACING: Record<string, number> = { mango: 8, sanders: 5, coconut: 7.5, teak: 5 };

export function buildFarm(ctx: SceneCtx, B: Buckets, mats: Mats): TypeBuild {
  const L = ctx.layout;
  verges(ctx, B, 'murrum');
  const pads = buildPads(L.plots, mats.pad, 0.04, 0.14, 0.15);
  const kinds = plantation(ctx.details.plantation);
  const rng = mulberry32(31);
  const total = L.plots.reduce((s, q) => s + q.area, 0);
  // Keep tree count bounded (~5k) on big farms by widening spacing.
  const scale = Math.max(1, Math.sqrt(total / 64 / 5000));
  const cottages = new Set(L.plots.filter((_, i) => i % 7 === 3).map((q) => q.no));
  for (const [i, q] of L.plots.entries()) {
    const { P, W, D, a } = plotFrame(ctx, q);
    const kind = kinds[i % kinds.length];
    const sp = SPACING[kind] * scale;
    const inner = offsetRegion(q.region, -2);
    // Plantation rows with drip lines.
    for (let v = 5; v < D - 2; v += sp) {
      const row: Pt[] = [];
      for (let u = -W / 2 + sp / 2 + 1; u < W / 2 - 1; u += sp) {
        const p = P(u, v);
        if (!pointInRegion(p, inner)) continue;
        if (cottages.has(q.no) && u < -W / 2 + 14 && v < 16) continue;
        row.push(p);
        ctx.trees.push({ p, kind, s: 0.75 + rng() * 0.3 });
      }
      if (row.length > 1) B.add('drip', strip(row[0], row[row.length - 1], 0.05, 0.16));
    }
    // Wire fence on granite posts with a gate on the road side.
    const corners = [P(-W / 2 + 0.2, 0.2), P(W / 2 - 0.2, 0.2), P(W / 2 - 0.2, D - 0.2), P(-W / 2 + 0.2, D - 0.2)];
    for (let k = 0; k < 4; k++) {
      const s0 = corners[k];
      const s1 = corners[(k + 1) % 4];
      const len = dist(s0, s1);
      const spans: [number, number][] = k === 0 ? [[0, len / 2 - 1.8], [len / 2 + 1.8, len]] : [[0, len]];
      for (const [t0, t1] of spans) {
        const p0 = { x: s0.x + ((s1.x - s0.x) * t0) / len, y: s0.y + ((s1.y - s0.y) * t0) / len };
        const p1 = { x: s0.x + ((s1.x - s0.x) * t1) / len, y: s0.y + ((s1.y - s0.y) * t1) / len };
        const nn = Math.max(1, Math.round((t1 - t0) / 3.5));
        for (let m = 0; m <= nn; m++) B.add('stone', box({ x: p0.x + ((p1.x - p0.x) * m) / nn, y: p0.y + ((p1.y - p0.y) * m) / nn }, 0.16, 0.16, 1.4, 0, a));
        for (const h of [0.5, 0.95, 1.35]) B.add('farmFence', wallSeg(p0, p1, 0.025, 0.025, h));
      }
    }
    B.add('darkMetal', box(P(0, 0.2), 3.4, 0.06, 1.3, 0.1, a));
    for (const s of [-1, 1]) B.add('stone', box(P(s * 1.9, 0.2), 0.35, 0.35, 1.7, 0, a));
    if (cottages.has(q.no)) farmhouse(B, P, a);
  }
  return { pads, padColour: new THREE.Color('#a9875e') };
}

function farmhouse(B: Buckets, P: (u: number, v: number) => Pt, a: number) {
  const W = 8;
  const c = P(-W / 2 - 1, 9);
  const at = (u: number, v: number) => {
    const q = P(-W / 2 - 1 + u, 9 + v);
    return q;
  };
  B.add('stone', box(c, 9, 7, 0.45, 0.05, a));
  B.add('plaster1', box(at(0, 0.6), 8, 5.2, 3, 0.5, a));
  B.add('glass', box(at(-1.8, -2.02), 1.4, 0.05, 1.2, 1.4, a));
  B.add('wood', box(at(1.2, -2.02), 1.1, 0.06, 2.2, 0.5, a));
  // Verandah with timber posts.
  B.add('wood', box(at(0, -2.6), 9, 1.8, 0.12, 3.1, a));
  for (const u of [-4.2, 0, 4.2]) B.add('wood', box(at(u, -3.3), 0.18, 0.18, 2.6, 0.5, a));
  // Hipped clay-tile roof.
  const roof = new THREE.ConeGeometry(6.4, 2.4, 4);
  roof.rotateY(Math.PI / 4);
  roof.scale(1, 1, 0.78);
  roof.translate(0, 3.5 + 1.2, 0);
  roof.rotateY(a);
  roof.translate(at(0, 0.3).x, 0, -at(0, 0.3).y);
  B.add('tile', normalise(roof));
  B.add('tank', box(at(3.2, 3.2), 1.0, 1.0, 1.2, 0.5, a));
}
