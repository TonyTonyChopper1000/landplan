// Shared site kit: ground inside the parcel, roads, footpaths, kerbs, markings, lamps,
// compound wall, entrance gate and the external approach road.
import { difference, intersect, offsetRegion, union } from '@/engine/clip';
import { pointInRegion, type Pt, type Region } from '@/engine/geometry';
import type { RoadRun } from '@/engine/types';
import { box, Buckets, cyl, flatRegion, planarUV, slabRegion, strip, wallSeg } from './geom';
import { defaultRoadName, type SceneCtx } from './ctx';

const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const dir = (a: Pt, b: Pt): Pt => {
  const l = dist(a, b) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};
const perp = (d: Pt): Pt => ({ x: -d.y, y: d.x });

export const FOOTPATH = 1.6;

/** Road junctions: crossings between runs, extended by half a width so T-junctions count. */
export function junctions(runs: RoadRun[]): { p: Pt; w: number }[] {
  const out: { p: Pt; w: number }[] = [];
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const r = runs[i];
      const s = runs[j];
      const d1 = dir(r.a, r.b);
      const d2 = dir(s.a, s.b);
      const den = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(den) < 0.3) continue;
      const ra = add(r.a, d1, -s.width / 2 - 1);
      const sa = add(s.a, d2, -r.width / 2 - 1);
      const t = ((sa.x - ra.x) * d2.y - (sa.y - ra.y) * d2.x) / den;
      const u = ((sa.x - ra.x) * d1.y - (sa.y - ra.y) * d1.x) / den;
      if (t < 0 || t > dist(r.a, r.b) + s.width + 2 || u < 0 || u > dist(s.a, s.b) + r.width + 2) continue;
      out.push({ p: add(ra, d1, t), w: Math.max(r.width, s.width) });
    }
  return out;
}

/** Split [0, L] around blocked intervals. */
function freeSpans(L: number, blocked: [number, number][]): [number, number][] {
  const b = blocked.filter(([a, c]) => c > 0 && a < L).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let t = 0;
  for (const [a, c] of b) {
    if (a > t) out.push([t, a]);
    t = Math.max(t, c);
  }
  if (t < L) out.push([t, L]);
  return out.filter(([a, c]) => c - a > 0.5);
}

export function buildSite(ctx: SceneCtx, B: Buckets) {
  const { layout } = ctx;
  const farm = ctx.type === 'farm';
  const parcel: Region = [layout.parcel];
  const wallIn = offsetRegion(parcel, -0.35);
  const blocks = union(layout.blocks.flatMap((b) => b.region));
  const runs = layout.roadRuns;
  const junc = junctions(runs);

  // Road surface: whole parcel minus blocks (internal roads + peripheral road + approach strip).
  const roadSurf = difference(wallIn, blocks);
  const rg = flatRegion(roadSurf, 0.02);
  if (rg) B.add(farm ? 'murrum' : 'asphalt', planarUV(rg, farm ? 6 : 4));
  // Under-wall strip.
  const wallStrip = flatRegion(difference(parcel, wallIn), 0.015);
  if (wallStrip) B.add('kerbGrey', wallStrip);

  if (!farm) {
    // Footpaths: a raised paver ring around every block, inside the road, kept off the wall.
    const ringOuter = intersect(offsetRegion(blocks, FOOTPATH), wallIn);
    const path = difference(ringOuter, blocks);
    const pg = slabRegion(path, 0, 0.15);
    if (pg) B.add('paver', planarUV(pg, 2.5));
    // Kerbs along the road-side edge of the footpath ring.
    const wallIn2 = offsetRegion(wallIn, -0.4);
    const gateZone = (p: Pt) => dist(p, ctx.gate.p) < 30 || junc.some((j) => dist(p, j.p) < j.w / 2 + 6);
    for (const ring of ringOuter)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const L = dist(a, b);
        if (L < 0.3) continue;
        const m = add(a, dir(a, b), L / 2);
        if (!pointInRegion(m, wallIn2) && !pointInRegion(add(m, perp(dir(a, b)), 0.6), wallIn)) continue;
        const d = dir(a, b);
        const n = Math.ceil(L);
        for (let k = 0; k < n; k++) {
          const p0 = add(a, d, (k * L) / n);
          const p1 = add(a, d, ((k + 1) * L) / n);
          const yb = gateZone(p0);
          B.add(yb ? (k % 2 ? 'accent0' : 'markingYellow') : 'kerbGrey', wallSeg(p0, p1, 0.22, 0.2, 0));
        }
      }
  }

  // Markings, zebras, lamps and road names along each run.
  runs.forEach((r, ri) => {
    const d = dir(r.a, r.b);
    const n = perp(d);
    const L = dist(r.a, r.b);
    const cw = r.width / 2 - (farm ? 0.5 : FOOTPATH);
    const blocked: [number, number][] = [];
    const mine = junc.filter((j) => {
      const rel = sub(j.p, r.a);
      return Math.abs(rel.x * n.x + rel.y * n.y) < 1;
    });
    for (const j of mine) {
      const rel = sub(j.p, r.a);
      const t = rel.x * d.x + rel.y * d.y;
      blocked.push([t - j.w / 2 - 4.5, t + j.w / 2 + 4.5]);
      if (!farm)
        for (const s of [-1, 1]) {
          // Zebra crossing just outside the junction box.
          const zc = t + s * (j.w / 2 + 2.2);
          if (zc < 1 || zc > L - 1) continue;
          for (let o = -cw + 0.45; o <= cw - 0.45; o += 1.0) {
            const c = add(add(r.a, d, zc), n, o);
            B.add('zebra', strip(add(c, d, -1.3), add(c, d, 1.3), 0.5, 0.045));
          }
          // Stop line.
          const sl = add(r.a, d, zc + s * 1.8);
          B.add('marking', strip(add(sl, n, -cw + 0.3), add(sl, n, cw - 0.3), 0.3, 0.045));
        }
    }
    blocked.push([-10, 2], [L - 2, L + 10]);
    const spans = freeSpans(L, blocked);
    if (!farm)
      for (const [t0, t1] of spans) {
        for (let t = t0 + 1; t + 3 <= t1; t += 6) B.add('marking', strip(add(r.a, d, t), add(r.a, d, t + 3), 0.14, 0.04));
        for (const s of [-1, 1]) B.add('marking', strip(add(add(r.a, d, t0), n, s * (cw - 0.35)), add(add(r.a, d, t1), n, s * (cw - 0.35)), 0.12, 0.04));
      }
    // Road name painted in the right-hand lane of the longest free span.
    const longest = spans.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a), [0, 0] as [number, number]);
    if (longest[1] - longest[0] > 18) {
      const p = add(add(r.a, d, (longest[0] + longest[1]) / 2), n, -cw / 2);
      const angle = Math.atan2(d.y, d.x);
      ctx.roadLabels.push({ id: r.id, text: ctx.roadNames[r.id] ?? defaultRoadName(r, ri), p, angle, size: Math.min(2.2, cw * 0.45) });
    }
    // Street lamps every ~30 m, alternating sides, on the footpath.
    const step = farm ? 45 : 30;
    let side = 1;
    for (let t = 8; t < L - 4; t += step) {
      if (mine.some((j) => Math.abs(sub(j.p, r.a).x * d.x + sub(j.p, r.a).y * d.y - t) < j.w / 2 + 2)) continue;
      const base = add(add(r.a, d, t), n, side * (r.width / 2 - 0.6));
      ctx.lamps.push({ p: base, h: farm ? 6 : 7.5, arm: 1.4, angle: Math.atan2(-n.y * side, -n.x * side) });
      // Avenue tree between lamps on the opposite footpath.
      const tt = t + step / 2;
      if (!farm && tt < L - 6 && !mine.some((j) => Math.abs(sub(j.p, r.a).x * d.x + sub(j.p, r.a).y * d.y - tt) < j.w / 2 + 4)) {
        const kind = r.width >= 15 || r.axis === 'spine' ? 'palm' : ri % 2 ? 'jacaranda' : 'gulmohar';
        ctx.trees.push({ p: add(add(r.a, d, tt), n, -side * (r.width / 2 - 0.8)), kind, s: kind === 'palm' ? 0.8 : 0.55 + ctx.rng() * 0.15 });
      }
      side = -side;
    }
  });

  buildWall(ctx, B);
  buildEntrance(ctx, B);
  buildApproachRoad(ctx, B);
}

function buildWall(ctx: SceneCtx, B: Buckets) {
  const farm = ctx.type === 'farm';
  const ring = offsetRegion([ctx.layout.parcel], -0.2)[0] ?? ctx.layout.parcel;
  const gw = ctx.gate.width / 2 + 1.6;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const L = dist(a, b);
    const d = dir(a, b);
    // Gate gap on the approach edge.
    const rel = sub(ctx.gate.p, a);
    const tg = rel.x * d.x + rel.y * d.y;
    const off = Math.abs(rel.x * -d.y + rel.y * d.x);
    const spans = off < 1.5 ? freeSpans(L, [[tg - gw, tg + gw]]) : [[0, L] as [number, number]];
    for (const [t0, t1] of spans) {
      const p0 = add(a, d, t0);
      const p1 = add(a, d, t1);
      if (farm) {
        // Chain-link on granite posts.
        const n = Math.max(1, Math.round((t1 - t0) / 3));
        for (let k = 0; k <= n; k++) B.add('stone', box(add(p0, d, ((t1 - t0) * k) / n), 0.22, 0.22, 1.7, 0, Math.atan2(d.y, d.x)));
        for (const h of [0.45, 0.95, 1.45]) B.add('farmFence', wallSeg(p0, p1, 0.03, 0.03, h));
        continue;
      }
      B.add('wall', wallSeg(p0, p1, 0.23, 1.85, 0));
      B.add('cap', wallSeg(p0, p1, 0.32, 0.08, 1.85));
      const n = Math.max(1, Math.round((t1 - t0) / 3));
      for (let k = 0; k <= n; k++) {
        const c = add(p0, d, ((t1 - t0) * k) / n);
        B.add('pillar', box(c, 0.42, 0.42, 2.1, 0, Math.atan2(d.y, d.x)));
        B.add('cap', box(c, 0.52, 0.52, 0.1, 2.1, Math.atan2(d.y, d.x)));
      }
    }
  }
}

function buildEntrance(ctx: SceneCtx, B: Buckets) {
  const { gate } = ctx;
  const t = gate.tangent;
  const inw = gate.inward;
  const ang = Math.atan2(t.y, t.x);
  const half = gate.width / 2 + 0.9;
  const farm = ctx.type === 'farm';
  const H = farm ? 4.2 : 6.6;
  for (const s of [-1, 1]) {
    const c = add(gate.p, t, s * half);
    B.add('stone', planarUV(box(c, 1.5, 1.5, H, 0, ang), 1.2, 'x'));
    B.add('cap', box(c, 1.8, 1.8, 0.25, H, ang));
    B.add('lampHead', box(add(c, inw, -0.8), 0.5, 0.12, 0.5, H - 1.4, ang));
    ctx.lamps.push({ p: add(c, inw, -1.2), h: H + 0.6, arm: 0, angle: 0 });
  }
  // Arch beam with the project name board on the outer face.
  const beamC = gate.p;
  B.add('accent0', box(beamC, gate.width + 3.4, 1.1, 1.5, H - 1.7, ang));
  B.add('sign', box(add(beamC, inw, -0.6), gate.width - 0.6, 0.1, 1.1, H - 1.5, ang));
  ctx.labels.push({ text: ctx.name.toUpperCase(), p: add(beamC, inw, -0.72), h: H - 0.95, size: Math.min(0.85, (gate.width - 1) / Math.max(6, ctx.name.length) * 1.6), kind: 'gate' });
  ctx.labels.push({ text: 'ENTRY', p: add(gate.p, inw, -14), h: 9, size: 3.2, kind: 'entry' });
  if (!farm) {
    // Security cabin and boom barrier.
    const cab = add(add(gate.p, inw, 5), t, half + 3.2);
    B.add('white', box(cab, 3.2, 3.2, 2.8, 0.15, ang));
    B.add('glass', box(add(cab, inw, -1.62), 2.2, 0.06, 1.1, 1.2, ang));
    B.add('accent0', box(cab, 4.2, 4.2, 0.22, 2.95, ang));
    B.add('kerb', box(add(add(gate.p, inw, 3), t, gate.width / 4), gate.width / 2 - 0.3, 0.12, 0.12, 1.0, ang));
    B.add('accent0', box(add(add(gate.p, inw, 3), t, gate.width / 2 - 0.1), 0.3, 0.3, 1.1, 0, ang));
    // Planters either side of the gate.
    for (const s of [-1, 1]) {
      const c = add(add(gate.p, inw, -1.6), t, s * (half + 3.5));
      B.add('stone', box(c, 4, 1.2, 0.6, 0, ang));
      B.add('flowers', box(c, 3.6, 0.9, 0.25, 0.6, ang));
    }
  }
}

function buildApproachRoad(ctx: SceneCtx, B: Buckets) {
  const { gate } = ctx;
  const t = gate.tangent;
  const out = { x: -gate.inward.x, y: -gate.inward.y };
  const w = ctx.approachWidth;
  const verge = 2.5;
  const c0 = add(gate.edgeMid, out, verge + w / 2);
  const reach = Math.max(gate.edgeLen / 2 + 220, ctx.size * 1.2);
  const A = add(c0, t, -reach);
  const Bp = add(c0, t, reach);
  const farm = ctx.type === 'farm';
  B.add('asphalt', planarUV(strip(A, Bp, w, 0.01), 4));
  // Paver footpath between road and wall, and on the far side.
  B.add('paver', planarUV(strip(add(A, out, -w / 2 - verge / 2), add(Bp, out, -w / 2 - verge / 2), verge, 0.06), 2.5));
  B.add('paver', planarUV(strip(add(A, out, w / 2 + 1.5), add(Bp, out, w / 2 + 1.5), 3, 0.06), 2.5));
  for (const s of [-1, 1]) B.add('kerbGrey', strip(add(A, out, s * (w / 2 + 0.1)), add(Bp, out, s * (w / 2 + 0.1)), 0.25, 0.12));
  // Apron from the road into the gate.
  const gp = gate.p;
  B.add(farm ? 'murrum' : 'asphalt', planarUV(strip(add(gp, out, -0.5), add(gp, out, verge + 0.5), gate.width + 2, 0.025), 4));
  const L = 2 * reach;
  const gT = sub(gp, A).x * t.x + sub(gp, A).y * t.y;
  if (w >= 18) {
    // Median with hedge, broken at the gate.
    for (const [a, b] of freeSpans(L, [[gT - gate.width, gT + gate.width]])) {
      const p0 = add(A, t, a);
      const p1 = add(A, t, b);
      B.add('kerbGrey', wallSeg(p0, p1, 1.4, 0.25, 0));
      B.add('hedge', wallSeg(p0, p1, 1.0, 0.7, 0.25));
    }
  }
  const lanes = w >= 18 ? [-w / 4, w / 4] : [0];
  for (const o of lanes) for (let s = 0; s + 3 < L; s += 8) B.add(w >= 18 ? 'marking' : 'markingYellow', strip(add(add(A, t, s), out, o), add(add(A, t, s + 3), out, o), 0.15, 0.03));
  for (const s of [-1, 1]) B.add('marking', strip(add(A, out, s * (w / 2 - 0.5)), add(Bp, out, s * (w / 2 - 0.5)), 0.14, 0.03));
  // Zebra across the main road at the gate.
  if (!farm)
    for (let o = -w / 2 + 0.8; o <= w / 2 - 0.8; o += 1.0) {
      const c = add(add(gp, out, verge + w / 2 + o), t, gate.width / 2 + 3.5);
      B.add('zebra', strip(add(c, out, -0.25), add(c, out, 0.25), 3, 0.035));
    }
  // Avenue palms both sides, lamps on the near side.
  for (let s = 10; s < L; s += 14) {
    const p = add(A, t, s);
    if (Math.abs(s - gT) < gate.width + 6) continue;
    ctx.trees.push({ p: add(p, out, -w / 2 - verge / 2), kind: 'palm', s: 0.9 + ctx.rng() * 0.25 });
    ctx.trees.push({ p: add(p, out, w / 2 + 3.6), kind: s % 28 < 14 ? 'palm' : 'rain', s: 0.85 + ctx.rng() * 0.3 });
    if (w >= 18 && s % 28 < 14) ctx.trees.push({ p, kind: 'palm', s: 0.75 });
  }
  // Arrival drive: along the main road, turn in at the gate, up the entry road.
  const lane = add(gp, out, verge + w * 0.72);
  ctx.arrival = [add(lane, t, -150), add(lane, t, -60), add(lane, t, -16), add(gp, out, verge + 1), add(gp, gate.inward, 12)];
  void cyl;
}
