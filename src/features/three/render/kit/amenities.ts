// Gardens, amenities, utilities, clubhouse and constraint buffers.
import * as THREE from 'three';
import { bufferLine, difference, intersect, offsetRegion } from '@/engine/clip';
import { ensureCCW, pointInRegion, regionArea, rotate, rotateRegion, type Pt, type Region } from '@/engine/geometry';
import { box, Buckets, cyl, flatRegion, normalise, planarUV, slabRegion, strip, wallSeg } from './geom';
import type { SceneCtx, TreeKind } from './ctx';

type Item = { key: string; w: number; d: number; label?: string; build: (c: Pt, a: number) => void };

function tilted(c: Pt, w: number, d: number, h: number, y0: number, yaw: number, pitch: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateZ(pitch);
  g.translate(0, y0, 0);
  g.rotateY(yaw);
  g.translate(c.x, 0, -c.y);
  return normalise(g);
}

function cone(c: Pt, r: number, h: number, y0: number, seg: number) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(c.x, y0 + h / 2, -c.y);
  return normalise(g);
}

const at = (c: Pt, a: number, u: number, v: number): Pt => ({ x: c.x + u * Math.cos(a) - v * Math.sin(a), y: c.y + u * Math.sin(a) + v * Math.cos(a) });

function nameFor(p: Pt, centre: Pt, size: number): string {
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  if (Math.hypot(dx, dy) < size * 0.14) return 'Central Park';
  const ang = (Math.atan2(dx, dy) * 180) / Math.PI;
  const dirs = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  return `${dirs[((Math.round(ang / 45) % 8) + 8) % 8]} Garden`;
}

export function buildAmenities(ctx: SceneCtx, B: Buckets) {
  const { layout, theta, origin } = ctx;
  const farm = ctx.type === 'farm';
  const villas = ctx.type === 'villas';
  const open = [...layout.open].sort((a, b) => b.area - a.area);
  const parks = open.filter((o) => o.use === 'park');
  const clubhouseHost = villas && ctx.details.clubhouse !== false ? (open.find((o) => o.use === 'social') ?? parks[0]) : undefined;
  const used = new Map<string, number>();
  const parkTrees: TreeKind[] = ['gulmohar', 'jacaranda', 'neem', 'gulmohar', 'rain', 'jacaranda'];

  for (const [oi, o] of open.entries()) {
    const c = regionCentroidSafe(o.region);
    const isClub = clubhouseHost === o;
    // Rotated frame: grid axes align with the plot grid.
    const rotR = rotateRegion(o.region, -theta, origin);
    const xs = rotR.flat().map((q) => q.x);
    const ys = rotR.flat().map((q) => q.y);
    const R = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const minDim = Math.min(R.x1 - R.x0, R.y1 - R.y0);

    if (o.use === 'util' && !isClub) {
      const g = flatRegion(o.region, 0.04);
      if (g) B.add(farm ? 'murrum' : 'kerbGrey', planarUV(g, 4));
      const items: Item[] = [
        { key: 'oht', w: 10, d: 10, label: 'OVERHEAD TANK', build: (p) => overheadTank(B, p) },
        { key: 'tx', w: 7, d: 6, label: 'TRANSFORMER', build: (p, a) => transformer(B, p, a) },
      ];
      if (farm) items.push({ key: 'bore', w: 5, d: 5, label: 'BOREWELL', build: (p, a) => pumpHouse(B, p, a) });
      place(ctx, B, rotR, R, items, 1.5);
      continue;
    }

    // Lawn with a hedge border and a perimeter walk.
    const lawnR = offsetRegion(o.region, -0.4);
    const lg = slabRegion(lawnR, 0, 0.12);
    if (lg) B.add('lawn', planarUV(lg, 24));
    const hedgeR = difference(lawnR, offsetRegion(lawnR, -0.8));
    const hg = slabRegion(hedgeR, 0.12, 0.85);
    if (hg && !farm) B.add('hedge', hg);
    if (minDim > 26 && !farm && !isClub) {
      const track = difference(offsetRegion(o.region, -2.6), offsetRegion(o.region, -4.4));
      const tg = slabRegion(track, 0.12, 0.16);
      if (tg) B.add('track', planarUV(tg, 3));
    }

    let name: string;
    if (isClub) name = 'Clubhouse';
    else if (o.use === 'social') name = farm ? 'Farm Commons' : 'Community Hall';
    else {
      name = nameFor(c, ctx.centre, ctx.size);
      const n = (used.get(name) ?? 0) + 1;
      used.set(name, n);
      if (n > 1) name = `${name} ${n}`;
    }
    const items: Item[] = [];
    const inner = offsetRegion(rotR, minDim > 26 && !farm ? -6 : -2.5);
    if (isClub) {
      items.push({ key: 'club', w: 30, d: 26, label: 'CLUBHOUSE', build: (p, a) => clubhouse(ctx, B, p, a) });
    } else if (o.use === 'social') {
      items.push({ key: 'hall', w: 14, d: 10, label: farm ? 'FARM COMMONS' : 'COMMUNITY HALL', build: (p, a) => hall(B, p, a) });
    }
    if (o.use === 'park' || isClub) {
      if (farm && oi === open.findIndex((x) => x.use === 'park')) items.push({ key: 'pond', w: Math.min(40, minDim * 0.6), d: Math.min(26, minDim * 0.45), label: 'FARM POND', build: (p, a) => pond(B, p, a, Math.min(40, minDim * 0.6), Math.min(26, minDim * 0.45)) });
      if (!farm && o.area > 2600 && !isClub) items.push({ key: 'cricket', w: 28, d: 15, label: 'BOX CRICKET', build: (p, a) => netted(B, p, a, 28, 15, false) });
      if (!farm && o.area > 4200 && !isClub) items.push({ key: 'football', w: 32, d: 19, label: 'MINI FOOTBALL', build: (p, a) => netted(B, p, a, 32, 19, true) });
      if (!isClub) items.push({ key: 'fountain', w: 8, d: 8, build: (p) => fountain(B, p) });
      items.push({ key: 'kids', w: 12, d: 10, label: 'KIDS PLAY', build: (p, a) => kidsPlay(B, p, a) });
      items.push({ key: 'gazebo', w: 8, d: 8, label: o.area > 1500 ? 'GAZEBO' : undefined, build: (p) => gazebo(B, p) });
      if (!farm && o.area > 1800) items.push({ key: 'gym', w: 10, d: 7, label: 'OPEN GYM', build: (p, a) => openGym(B, p, a) });
      if (!farm && o.area > 3000) items.push({ key: 'pavilion', w: 10, d: 7, label: 'PAVILION', build: (p, a) => pavilion(B, p, a) });
      if (!farm && o.area > 2200 && !isClub) items.push({ key: 'party', w: 22, d: 16, label: 'PARTY LAWN', build: (p, a) => partyLawn(ctx, B, p, a) });
    }
    const placed = place(ctx, B, inner, R, items, 2);
    const parkLabel = o.use === 'park' ? name.toUpperCase() : undefined;
    if (parkLabel && regionArea(o.region) > 500) ctx.labels.push({ text: parkLabel, p: c, h: 13, size: Math.min(4, Math.max(2.2, Math.sqrt(o.area) / 14)), kind: 'amenity' });
    ctx.gardens.push({ name, p: c, items: placed });

    // Trees: a ring just inside the hedge and a scatter on open lawn.
    const ringR = offsetRegion(o.region, -2.2);
    for (const ring of ringR) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        for (let t = 4; t < L - 2; t += farm ? 9 : 8) {
          const p = { x: a.x + ((b.x - a.x) * t) / L, y: a.y + ((b.y - a.y) * t) / L };
          if (ctx.occupied(p)) continue;
          ctx.trees.push({ p, kind: farm ? 'neem' : parkTrees[Math.floor(ctx.rng() * parkTrees.length)], s: 0.8 + ctx.rng() * 0.4 });
        }
      }
    }
    const scatterR = offsetRegion(o.region, -5);
    for (let k = 0; k < o.area / 260; k++) {
      const p = rotate({ x: R.x0 + ctx.rng() * (R.x1 - R.x0), y: R.y0 + ctx.rng() * (R.y1 - R.y0) }, theta, origin);
      if (!pointInRegion(p, scatterR) || ctx.occupied(p)) continue;
      ctx.trees.push({ p, kind: ctx.rng() > 0.7 ? 'palm' : parkTrees[Math.floor(ctx.rng() * parkTrees.length)], s: 0.8 + ctx.rng() * 0.5 });
    }
  }
  buildBuffers(ctx, B);
}

function regionCentroidSafe(r: Region): Pt {
  let ax = 0;
  let ay = 0;
  let at = 0;
  for (const ring of r) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      const f = p.x * q.y - q.x * p.y;
      a += f;
      cx += (p.x + q.x) * f;
      cy += (p.y + q.y) * f;
    }
    if (Math.abs(a) < 1e-9) continue;
    ax += cx / 3;
    ay += cy / 3;
    at += a;
  }
  return at ? { x: ax / at, y: ay / at } : r[0]?.[0] ?? { x: 0, y: 0 };
}

/** Greedy placement on a 1.5 m grid in the rotated frame, biggest first. */
function place(ctx: SceneCtx, B: Buckets, inner: Region, R: { x0: number; x1: number; y0: number; y1: number }, items: Item[], gap: number): string[] {
  const out: string[] = [];
  const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const sorted = [...items].sort((a, b) => b.w * b.d - a.w * a.d);
  const cx = (R.x0 + R.x1) / 2;
  const cy = (R.y0 + R.y1) / 2;
  for (const it of sorted) {
    let best: { x: number; y: number; rotd: boolean; s: number } | null = null;
    for (const rotd of [false, true]) {
      const w = rotd ? it.d : it.w;
      const d = rotd ? it.w : it.d;
      for (let x = R.x0 + w / 2; x <= R.x1 - w / 2; x += 1.5)
        for (let y = R.y0 + d / 2; y <= R.y1 - d / 2; y += 1.5) {
          const r = { x0: x - w / 2, x1: x + w / 2, y0: y - d / 2, y1: y + d / 2 };
          const corners = [
            { x: r.x0, y: r.y0 },
            { x: r.x1, y: r.y0 },
            { x: r.x0, y: r.y1 },
            { x: r.x1, y: r.y1 },
            { x, y },
          ];
          if (!corners.every((p) => pointInRegion(p, inner))) continue;
          if (taken.some((t) => r.x0 < t.x1 + gap && r.x1 > t.x0 - gap && r.y0 < t.y1 + gap && r.y1 > t.y0 - gap)) continue;
          // Fountain and gazebo prefer the middle, big courts the ends.
          const dc = Math.hypot(x - cx, y - cy);
          const s = it.key === 'fountain' || it.key === 'club' ? dc : -dc * 0.2 + (rotd ? 0.5 : 0);
          if (!best || s < best.s) best = { x, y, rotd, s };
        }
    }
    if (!best) continue;
    const w = best.rotd ? it.d : it.w;
    const d = best.rotd ? it.w : it.d;
    taken.push({ x0: best.x - w / 2, x1: best.x + w / 2, y0: best.y - d / 2, y1: best.y + d / 2 });
    const p = ctx.rot({ x: best.x, y: best.y });
    const a = ctx.theta + (best.rotd ? Math.PI / 2 : 0);
    it.build(p, a);
    const rr = Math.max(w, d) / 2;
    ctx.blockers.push({ p, r: rr });
    if (it.label) ctx.labels.push({ text: it.label, p, h: it.key === 'oht' ? 22 : it.key === 'club' ? 16 : 7.5, size: it.key === 'club' ? 3.2 : 1.9, kind: 'amenity' });
    out.push(it.label ?? it.key);
    void B;
  }
  return out;
}

function fountain(B: Buckets, c: Pt) {
  B.add('stone', cyl(c, 3.4, 3.4, 0.55, 0, 32));
  B.add('water', cyl(c, 3.05, 3.05, 0.05, 0.5, 32));
  B.add('white', cyl(c, 0.5, 0.35, 1.3, 0.5, 16));
  B.add('white', cyl(c, 1.3, 1.5, 0.22, 1.7, 24));
  B.add('water', cyl(c, 1.2, 1.2, 0.04, 1.92, 24));
  B.add('white', cyl(c, 0.12, 0.2, 0.9, 1.9, 8));
  B.add('railGlass', cone(c, 0.9, 1.4, 2.2, 12));
}

function gazebo(B: Buckets, c: Pt) {
  B.add('white', cyl(c, 3.4, 3.4, 0.45, 0, 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    B.add('wood', cyl({ x: c.x + Math.cos(a) * 2.9, y: c.y + Math.sin(a) * 2.9 }, 0.13, 0.13, 2.7, 0.45, 8));
  }
  B.add('accent0', cyl(c, 3.5, 3.5, 0.25, 3.15, 8));
  B.add('tile', cone(c, 3.9, 1.8, 3.4, 8));
  B.add('cap', cyl(c, 0.1, 0.02, 0.8, 5.2, 6));
  B.add('wood', cyl(c, 1.1, 1.1, 0.06, 0.95, 16));
}

function kidsPlay(B: Buckets, c: Pt, a: number) {
  const g = box(c, 12, 10, 0.08, 0.12, a);
  B.add('rubber', g);
  // Tower + slide
  const t = at(c, a, -3, 1.5);
  for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add('steel', box(at(t, a, u * 1, v * 1), 0.12, 0.12, 3.2, 0.2, a));
  B.add('flowersY', box(t, 2.3, 2.3, 0.15, 1.6, a));
  B.add('accent2', cone(t, 1.7, 1.2, 3.4, 4));
  B.add('pool', tilted(at(t, a, 2.6, 0), 3.6, 0.9, 0.1, 0.95, a, -0.42));
  // Swing frame
  const s = at(c, a, 2.6, -2);
  for (const u of [-2, 2]) for (const v of [-0.7, 0.7]) B.add('accent2', tilted(at(s, a, u, v), 0.12, 0.12, 2.8, 1.4, a + Math.PI / 2, v > 0 ? 0.25 : -0.25));
  B.add('accent2', box(s, 4.2, 0.12, 0.12, 2.6, a));
  for (const u of [-1, 1]) {
    B.add('steel', box(at(s, a, u, 0), 0.03, 0.03, 1.9, 0.7, a));
    B.add('flowers', box(at(s, a, u, 0), 0.6, 0.25, 0.06, 0.65, a));
  }
  // See-saw and spring riders
  B.add('flowersY', tilted(at(c, a, 2.5, 3), 3.4, 0.3, 0.08, 0.6, a, 0.15));
  B.add('accent0', box(at(c, a, 2.5, 3), 0.3, 0.3, 0.45, 0.12, a));
  for (const u of [-4.5, -1]) B.add('pool', cyl(at(c, a, u, -3.4), 0.35, 0.3, 0.7, 0.12, 10));
}

function netted(B: Buckets, c: Pt, a: number, w: number, d: number, football: boolean) {
  B.add('turf', planarUV(box(c, w, d, 0.06, 0.12, a), 4));
  const H = 5;
  const corners = [at(c, a, -w / 2, -d / 2), at(c, a, w / 2, -d / 2), at(c, a, w / 2, d / 2), at(c, a, -w / 2, d / 2)];
  for (let i = 0; i < 4; i++) {
    const p = corners[i];
    const q = corners[(i + 1) % 4];
    B.add('net', wallSeg(p, q, 0.02, H, 0.15));
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    for (let t = 0; t <= L + 0.01; t += L / Math.max(1, Math.round(L / 4))) B.add('steel', cyl({ x: p.x + ((q.x - p.x) * t) / L, y: p.y + ((q.y - p.y) * t) / L }, 0.06, 0.06, H, 0.1, 6));
    B.add('steel', wallSeg(p, q, 0.06, 0.06, H + 0.1));
  }
  // Pitch markings
  if (football) {
    B.add('marking', strip(at(c, a, 0, -d / 2 + 0.5), at(c, a, 0, d / 2 - 0.5), 0.12, 0.19));
    for (const s of [-1, 1]) B.add('white', box(at(c, a, s * (w / 2 - 0.7), 0), 0.8, 4, 2, 0.18, a));
  } else {
    B.add('paver', box(c, 18, 2.6, 0.04, 0.18, a));
    for (const s of [-1, 1]) for (const v of [-0.12, 0, 0.12]) B.add('wood', cyl(at(c, a, s * 8.5, v), 0.025, 0.025, 0.72, 0.2, 6));
  }
}

function openGym(B: Buckets, c: Pt, a: number) {
  B.add('rubber', box(c, 10, 7, 0.06, 0.12, a));
  for (let i = 0; i < 4; i++) {
    const p = at(c, a, -3.6 + i * 2.4, (i % 2 ? 1 : -1) * 1.2);
    B.add('flowersY', box(p, 0.12, 0.12, 1.6, 0.18, a));
    B.add('flowersY', box(at(p, a, 0.5, 0), 1.0, 0.1, 0.1, 1.6, a));
    B.add('darkMetal', box(at(p, a, 0.6, 0), 0.5, 0.6, 0.08, 0.6, a));
  }
  B.add('darkMetal', box(at(c, a, 0, 2.6), 4, 0.1, 0.1, 2.3, a));
  for (const s of [-2, 2]) B.add('darkMetal', box(at(c, a, s, 2.6), 0.1, 0.1, 2.3, 0.12, a));
}

function pavilion(B: Buckets, c: Pt, a: number) {
  B.add('stone', box(c, 10, 7, 0.4, 0.1, a));
  for (const u of [-4.5, 0, 4.5]) for (const v of [-3, 3]) B.add('white', box(at(c, a, u, v), 0.3, 0.3, 3.0, 0.5, a));
  B.add('white', box(c, 11, 8, 0.3, 3.5, a));
  B.add('accent1', box(c, 11.2, 8.2, 0.08, 3.8, a));
  for (const u of [-3, 0, 3]) B.add('wood', box(at(c, a, u, 0), 2.2, 0.5, 0.45, 0.5, a));
}

function partyLawn(ctx: SceneCtx, B: Buckets, c: Pt, a: number) {
  B.add('lawn', planarUV(box(c, 22, 16, 0.03, 0.12, a), 24));
  B.add('wood', box(at(c, a, 0, 7), 8, 3, 0.6, 0.12, a));
  B.add('canopy', box(at(c, a, 0, 7), 8.4, 3.4, 0.08, 3.6, a));
  for (const u of [-4, 4]) B.add('darkMetal', box(at(c, a, u, 7 + 1.5), 0.12, 0.12, 3.5, 0.12, a));
  // String-light posts around the lawn.
  for (const [u, v] of [[-11, -8], [11, -8], [-11, 8], [11, 8], [0, -8], [-11, 0], [11, 0]]) {
    const p = at(c, a, u, v);
    B.add('darkMetal', cyl(p, 0.06, 0.06, 4, 0, 6));
    ctx.lamps.push({ p, h: 4, arm: 0, angle: 0 });
  }
  for (const [u0, v0, u1, v1] of [[-11, -8, 11, -8], [11, -8, 11, 8], [11, 8, -11, 8], [-11, 8, -11, -8]]) B.add('lampHead', wallSeg(at(c, a, u0, v0), at(c, a, u1, v1), 0.04, 0.04, 3.85));
}

function hall(B: Buckets, c: Pt, a: number) {
  B.add('white', box(c, 14, 10, 4.2, 0.3, a));
  B.add('glass', box(at(c, a, 0, -5.02), 10, 0.06, 2.6, 0.9, a));
  B.add('accent0', box(c, 15, 11, 0.35, 4.5, a));
  B.add('stone', box(c, 14.4, 10.4, 0.3, 0, a));
}

function clubhouse(ctx: SceneCtx, B: Buckets, c: Pt, a: number) {
  // Building at the back, pool and deck in front.
  const bc = at(c, a, 0, 7);
  B.add('stone', box(bc, 26, 12, 0.5, 0, a));
  B.add('glass', box(bc, 24, 10, 3.6, 0.5, a));
  for (const u of [-12, -6, 0, 6, 12]) B.add('white', box(at(bc, a, u, -5), 0.35, 0.35, 3.6, 0.5, a));
  B.add('white', box(bc, 26.5, 12.5, 0.4, 4.1, a));
  B.add('plaster1', box(at(bc, a, 2, 0.5), 20, 10, 3.4, 4.5, a));
  B.add('glass', box(at(bc, a, 2, -4.52), 14, 0.06, 2.2, 5.1, a));
  B.add('accent1', box(at(bc, a, -6.5, -4.6), 2.4, 0.3, 3.6, 4.5, a));
  B.add('white', box(at(bc, a, 2, 0.5), 21, 11, 0.35, 7.9, a));
  for (const s of [-1, 1]) B.add('white', box(at(bc, a, 2 + s * 10.4, 0.5), 0.2, 11, 1.0, 8.25, a));
  B.add('white', box(at(bc, a, 2, 6), 21, 0.2, 1.0, 8.25, a));
  B.add('railGlass', box(at(bc, a, 2, -5), 21, 0.04, 1.0, 8.25, a));
  B.add('accent0', box(at(bc, a, -11, 0), 4, 12.5, 0.3, 4.1, a));
  // Deck + pool
  const pc = at(c, a, 0, -6);
  B.add('wood', box(pc, 26, 12, 0.3, 0, a));
  B.add('white', box(pc, 17, 7.6, 0.06, 0.3, a));
  B.add('pool', box(pc, 16, 6.6, 0.05, 0.33, a));
  ctx.lamps.push({ p: pc, h: 0.6, arm: 0, angle: 0 });
  // Cabanas and loungers
  for (const s of [-1, 1]) {
    const cb = at(pc, a, s * 11.4, 2);
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add('wood', box(at(cb, a, u, v), 0.1, 0.1, 2.5, 0.3, a));
    B.add('canopy', box(cb, 2.4, 2.4, 0.08, 2.8, a));
    B.add('white', box(cb, 1.8, 1.4, 0.35, 0.3, a));
  }
  for (let u = -6; u <= 6; u += 3) B.add('white', tilted(at(pc, a, u, -4.7), 0.7, 1.9, 0.12, 0.6, a + Math.PI / 2, 0.15));
  ctx.lamps.push({ p: at(bc, a, -12, -7), h: 4, arm: 0, angle: 0 }, { p: at(bc, a, 12, -7), h: 4, arm: 0, angle: 0 });
}

function overheadTank(B: Buckets, c: Pt) {
  const H = 14;
  for (const [u, v] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) B.add('concrete', box({ x: c.x + u, y: c.y + v }, 0.6, 0.6, H, 0, 0));
  for (const h of [4.5, 9.5]) B.add('concrete', box(c, 5.4, 5.4, 0.35, h, 0));
  B.add('concrete', cyl(c, 4.0, 4.4, 4.2, H, 24));
  B.add('concrete', cone(c, 4.4, 1.4, H + 4.2, 24));
  B.add('steel', box({ x: c.x + 2.7, y: c.y }, 0.1, 0.6, H + 4, 0, 0));
}

function transformer(B: Buckets, c: Pt, a: number) {
  B.add('concrete', box(c, 6.5, 5.5, 0.3, 0, a));
  B.add('steel', box(c, 2.4, 1.6, 2.0, 0.3, a));
  for (let u = -1; u <= 1; u += 0.4) B.add('darkMetal', box(at(c, a, u, 0.95), 0.06, 0.25, 1.6, 0.4, a));
  for (const s of [-0.6, 0, 0.6]) B.add('white', cyl(at(c, a, s, -0.3), 0.08, 0.08, 0.7, 2.3, 8));
  const corners = [at(c, a, -3.2, -2.7), at(c, a, 3.2, -2.7), at(c, a, 3.2, 2.7), at(c, a, -3.2, 2.7)];
  for (let i = 0; i < 4; i++) B.add('net', wallSeg(corners[i], corners[(i + 1) % 4], 0.02, 2.2, 0.3));
  for (const p of corners) B.add('fence', cyl(p, 0.05, 0.05, 2.4, 0.3, 6));
}

function pumpHouse(B: Buckets, c: Pt, a: number) {
  B.add('white', box(c, 3, 2.6, 2.4, 0, a));
  B.add('tile', box(c, 3.5, 3.1, 0.25, 2.4, a));
  B.add('steel', cyl(at(c, a, 2.4, 0), 0.15, 0.15, 0.8, 0, 8));
  B.add('drip', box(at(c, a, 1.9, 0), 1.0, 0.1, 0.1, 0.5, a));
}

function pond(B: Buckets, c: Pt, a: number, w: number, d: number) {
  B.add('murrum', planarUV(box(c, w, d, 0.45, 0, a), 6));
  B.add('water', box(c, w - 3, d - 3, 0.04, 0.42, a));
  B.add('stone', box(at(c, a, 0, -d / 2 + 0.8), 3, 1.6, 0.5, 0.2, a));
}

/** Water bodies, green belts and HT towers for the constraint buffers. */
function buildBuffers(ctx: SceneCtx, B: Buckets) {
  const L = ctx.layout;
  for (const c of L.params.constraints) {
    const buf = L.buffers.find((b) => b.id === c.id);
    let water: Region = [];
    if (c.kind === 'lake' && c.pts.length >= 3) water = [ensureCCW(c.pts)];
    if (c.kind === 'nala' && c.pts.length >= 2) water = bufferLine(c.pts, Math.max(2, (c.widthM ?? 6) / 2));
    if (water.length) {
      const wg = flatRegion(water, 0.05);
      if (wg) B.add('water', planarUV(wg, 30));
      const bank = difference(offsetRegion(water, 2), water);
      const bg = flatRegion(bank, 0.04);
      if (bg) B.add('murrum', planarUV(bg, 6));
    }
    if (buf) {
      const belt = difference(buf.region, offsetRegion(water, 2));
      const gg = flatRegion(belt, 0.03);
      if (gg) B.add('lawn', planarUV(gg, 24));
      // Trees on the green belt (not under HT lines).
      const xs = belt.flat().map((q) => q.x);
      const ys = belt.flat().map((q) => q.y);
      if (xs.length && c.kind !== 'ht')
        for (let k = 0; k < buf.area / 180; k++) {
          const p = { x: Math.min(...xs) + ctx.rng() * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + ctx.rng() * (Math.max(...ys) - Math.min(...ys)) };
          if (pointInRegion(p, belt)) ctx.trees.push({ p, kind: ctx.rng() > 0.5 ? 'neem' : 'rain', s: 0.8 + ctx.rng() * 0.5 });
        }
      ctx.labels.push({ text: buf.label.toUpperCase().slice(0, 28), p: regionCentroidSafe(intersect(buf.region, buf.region)), h: 6, size: 1.8, kind: 'amenity' });
    }
    if (c.kind === 'ht' && c.pts.length >= 2) {
      const towers: Pt[] = [];
      for (let i = 0; i < c.pts.length - 1; i++) {
        const a = c.pts[i];
        const b = c.pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.round(len / 120));
        for (let k = 0; k <= n; k++) if (k < n || i === c.pts.length - 2) towers.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
      }
      const ang = Math.atan2(c.pts[1].y - c.pts[0].y, c.pts[1].x - c.pts[0].x);
      for (const t of towers) htTower(B, t, ang);
      for (let i = 0; i < towers.length - 1; i++)
        for (const s of [-4, 0, 4]) {
          const o = { x: -Math.sin(ang) * s, y: Math.cos(ang) * s };
          B.add('darkMetal', wallSeg({ x: towers[i].x + o.x, y: towers[i].y + o.y }, { x: towers[i + 1].x + o.x, y: towers[i + 1].y + o.y }, 0.05, 0.05, 24));
        }
    }
    if (c.kind === 'heritage' && c.pts.length) {
      B.add('stone', box(c.pts[0], 6, 6, 1.2, 0, 0));
      B.add('stone', cone(c.pts[0], 2.5, 5, 1.2, 4));
    }
  }
}

function htTower(B: Buckets, c: Pt, a: number) {
  const H = 30;
  for (const [u, v] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B.add('steel', tilted(at(c, a, u * 0.62, v * 0.62), 0.25, 0.25, H * 0.8, H * 0.4, a, u * v > 0 ? 0.06 : -0.06));
  B.add('steel', box(c, 1.4, 1.4, H - 6, 6, a));
  for (const h of [18, 24]) B.add('steel', box(c, 0.3, 10, 0.3, h, a + Math.PI / 2));
  B.add('steel', cone(c, 0.9, 4, H - 1, 4));
}
