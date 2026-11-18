// Procedural Hyderabad-contemporary villa built from the plot's real setbacks and floors.
// Flat roof + parapet, stair headroom, rooftop tank, chajjas, projecting frames, plinth,
// framed recessed glazing, balconies with glass/MS railings, car porch, stone cladding,
// compound wall and gate. Palettes and elevations come from a seeded PRNG.
import type { Pt } from '@/engine/geometry';
import { footprint } from '@/engine/massing';
import type { Plot } from '@/engine/types';
import { box, Buckets, cyl, planarUV, wallSeg } from '../kit/geom';
import type { SceneCtx } from '../kit/ctx';

export type VillaOpts = { floors: number; floorHeight: number; setbacks: boolean; premium: boolean; hero: boolean; rng: () => number; ghost?: boolean };

const PALETTES = [
  { plaster: 'plaster0', accent: 'accent0', trim: 'white' },
  { plaster: 'plaster1', accent: 'accent1', trim: 'white' },
  { plaster: 'plaster2', accent: 'accent0', trim: 'accent1' },
  { plaster: 'plaster3', accent: 'accent2', trim: 'white' },
  { plaster: 'plaster0', accent: 'accent1', trim: 'accent0' },
  { plaster: 'plaster2', accent: 'accent2', trim: 'white' },
];

/** Local frame: u across the frontage (centred), v from the road edge into the plot. */
export function plotFrame(ctx: SceneCtx, p: Plot) {
  const r = p.rect;
  const cx = (r.x0 + r.x1) / 2;
  const P = (u: number, v: number): Pt => ctx.rot({ x: cx + u, y: p.row === -1 ? r.y0 + v : r.y1 - v });
  return { P, W: r.x1 - r.x0, D: r.y1 - r.y0, a: ctx.theta };
}

export function buildVilla(ctx: SceneCtx, B: Buckets, p: Plot, o: VillaOpts, base = 0.12) {
  const { P, W, D, a } = plotFrame(ctx, p);
  const f = footprint(p, o.setbacks);
  const side = Math.max(o.setbacks ? 1 : 0.6, f.sb.side);
  const front = Math.max(3, f.sb.front);
  const rear = Math.max(1, f.sb.rear);
  const fw = Math.max(4, W - 2 * side);
  const fd = Math.max(5, D - front - rear);
  const v0 = front;
  const vm = front + fd / 2;
  const fh = o.floorHeight;
  const pl = 0.45;
  const g0 = base + pl;
  const F = o.floors + 1;
  const pal = PALETTES[Math.floor(o.rng() * PALETTES.length)];
  const elev = o.premium ? (o.rng() > 0.5 ? 'frame' : 'cantilever') : (['frame', 'cantilever', 'fins'] as const)[Math.floor(o.rng() * 3)];
  const porchLeft = o.rng() > 0.5 ? 1 : -1;
  const bx = (m: string, u: number, v: number, w: number, d: number, h: number, y0: number) => B.add(m, box(P(u, v), w, d, h, y0, a));
  const lit = () => (o.rng() > 0.3 ? 'glass' : 'glassDark');

  if (o.ghost) {
    bx('ghost', 0, vm, fw, fd, F * fh, base);
    return;
  }

  // Plinth with a stone band.
  B.add('stone', planarUV(box(P(0, vm), fw + 0.3, fd + 0.3, pl, base, a), 1.2, 'x'));
  // Floors
  for (let i = 0; i < F; i++) {
    const y = g0 + i * fh;
    const upper = i > 0;
    let fv0 = v0;
    let fdd = fd;
    const cu = 0;
    const cw = fw;
    if (upper && elev === 'frame') {
      // Recessed front for a deep balcony inside the projecting frame.
      fv0 = v0 + 1.4;
      fdd = fd - 1.4;
    }
    if (upper && elev === 'cantilever' && i === 1) {
      // Upper floor cantilevers 1.2 m over the porch on half the width.
      bx(pal.plaster, porchLeft * fw * 0.25, v0 - 0.6, fw * 0.5, 1.2, fh, y);
      bx(pal.accent, porchLeft * fw * 0.25, v0 - 1.22, fw * 0.5 + 0.2, 0.06, fh + 0.05, y - 0.02);
      B.add(lit(), box(P(porchLeft * fw * 0.25, v0 - 1.25), fw * 0.5 - 0.8, 0.05, fh - 1.0, y + 0.5, a));
    }
    bx(pal.plaster, cu, fv0 + fdd / 2, cw, fdd, fh, y);
    // Floor band / slab edge
    bx(pal.trim, 0, v0 + fd / 2, fw + 0.12, fd + 0.12, 0.18, y + fh - 0.18);
    // Front windows with frames and chajjas
    const nWin = Math.max(1, Math.floor(fw / 3.6));
    for (let k = 0; k < nWin; k++) {
      const u = -fw / 2 + (fw / nWin) * (k + 0.5);
      if (!upper && k === (porchLeft > 0 ? nWin - 1 : 0) && nWin > 1) {
        // Main door: tall wood door + glazed side light.
        bx('wood', u - 0.3, fv0 - 0.04, 1.2, 0.08, 2.4, y);
        B.add(lit(), box(P(u + 0.65, fv0 - 0.04), 0.5, 0.06, 2.4, y, a));
        bx(pal.accent, u, fv0 - 0.5, 2.4, 1.0, 0.12, y + 2.6);
        continue;
      }
      const ww = Math.min(2.6, fw / nWin - 1);
      const wh = upper && elev === 'frame' ? fh - 0.8 : 1.6;
      const wy = y + (upper && elev === 'frame' ? 0.15 : 0.85);
      B.add(lit(), box(P(u, fv0 - 0.02), ww, 0.05, wh, wy, a));
      bx('accent0', u, fv0 - 0.08, ww + 0.16, 0.12, 0.08, wy - 0.08);
      bx('accent0', u, fv0 - 0.08, ww + 0.16, 0.12, 0.08, wy + wh);
      for (const s of [-1, 1]) bx('accent0', u + s * (ww / 2 + 0.04), fv0 - 0.08, 0.08, 0.12, wh, wy);
      if (!(upper && elev === 'frame')) bx(pal.trim, u, fv0 - 0.35, ww + 0.5, 0.7, 0.08, wy + wh + 0.18);
    }
    // Side windows
    for (const s of [-1, 1])
      for (let k = 0; k < Math.max(1, Math.floor(fd / 5)); k++) {
        const v = v0 + 1.5 + k * 5 + 1;
        if (v > v0 + fd - 1) continue;
        B.add(lit(), box(P(s * (fw / 2 + 0.01), v), 0.05, 1.2, 1.3, y + 0.95, a));
        bx(pal.trim, s * (fw / 2 + 0.3), v, 0.6, 1.6, 0.07, y + 2.35);
      }
    if (upper && elev === 'frame') {
      // Balcony slab + glass railing with MS top rail.
      bx(pal.trim, 0, v0 + 0.7, fw - 0.6, 1.4, 0.15, y);
      B.add('railGlass', box(P(0, v0 + 0.05), fw - 0.8, 0.04, 1.0, y + 0.15, a));
      bx('darkMetal', 0, v0 + 0.05, fw - 0.8, 0.06, 0.05, y + 1.15);
    }
    if (upper && elev === 'fins') {
      // Vertical timber louvres over half the front.
      for (let u = 0; u < fw * 0.45; u += 0.35) bx('wood', -porchLeft * (fw / 2 - 0.3 - u), v0 - 0.18, 0.08, 0.25, fh - 0.2, y + 0.1);
      bx(pal.trim, 0, v0 - 0.45, fw + 0.4, 0.9, 0.12, y + fh - 0.05);
    }
  }
  const top = g0 + F * fh;
  if (elev === 'frame' && F > 1) {
    // The projecting picture frame around the upper floors.
    const y = g0 + fh;
    const h = (F - 1) * fh;
    bx(pal.accent, 0, v0 - 0.15, fw + 0.3, 0.9, 0.35, top - 0.15);
    bx(pal.accent, 0, v0 - 0.15, fw + 0.3, 0.9, 0.3, y - 0.3);
    for (const s of [-1, 1]) bx(pal.accent, s * (fw / 2 - 0.05), v0 - 0.15, 0.4, 0.9, h + 0.2, y - 0.3);
  }
  // Stone-clad feature wall on the front.
  const cs = -porchLeft;
  B.add('stone', planarUV(box(P(cs * (fw / 2 - 0.45), v0 - 0.2), 0.9, 0.45, top - base + 0.6, base, a), 1.2, 'x'));
  // Roof: parapet, stair headroom, tank.
  const ph = 1.0;
  const corners = [P(-fw / 2, v0), P(fw / 2, v0), P(fw / 2, v0 + fd), P(-fw / 2, v0 + fd)];
  for (let i = 0; i < 4; i++) B.add(pal.plaster, wallSeg(corners[i], corners[(i + 1) % 4], 0.18, ph, top));
  bx(pal.trim, 0, vm, fw + 0.2, fd + 0.2, 0.1, top - 0.05);
  const hu = porchLeft * (fw / 2 - 1.7);
  const hv = v0 + fd - 2.2;
  bx(pal.plaster, hu, hv, 3.2, 4.2, 2.7, top);
  bx(pal.trim, hu, hv, 3.6, 4.6, 0.15, top + 2.7);
  B.add('glassDark', box(P(hu, hv - 2.12), 0.9, 0.05, 2.1, top, a));
  B.add('tank', cyl(P(hu, hv + 0.6), 0.68, 0.68, 1.35, top + 2.85, 14));
  B.add('tank', cyl(P(hu, hv - 0.9), 0.5, 0.5, 1.05, top + 2.85, 14));
  if (o.premium) {
    // Terrace pergola.
    const pu = -porchLeft * fw * 0.2;
    for (let k = -2; k <= 2; k++) bx('wood', pu + k * 0.6, v0 + 2.5, 0.12, 3.6, 0.18, top + 2.6);
    for (const [s, t] of [[-1, 0.9], [1, 0.9], [-1, 4.1], [1, 4.1]]) bx('darkMetal', pu + s * 1.3, v0 + t, 0.12, 0.12, 2.6, top);
  }
  // Car porch over the driveway.
  const pu = porchLeft * (fw / 2 - 1.8);
  const pd = Math.min(front - 0.4, 5.4);
  if (elev !== 'cantilever') {
    bx(pal.trim, pu, v0 - pd / 2, 3.6, pd, 0.22, g0 + 2.75);
    bx(pal.accent, pu, v0 - pd / 2, 3.7, pd + 0.05, 0.08, g0 + 2.97);
    for (const s of [-1, 1]) bx('darkMetal', pu + s * 1.6, v0 - pd + 0.25, 0.16, 0.16, 2.75 + pl, base);
  }
  // Driveway, front lawn and compound wall with gate.
  bx('paver', pu, front / 2, 3.2, front, 0.05, base);
  const lw = fw - 4;
  if (lw > 1) bx('lawn', -porchLeft * (fw / 2 - lw / 2 - 0.3), front / 2 + 0.3, lw, front - 1.2, 0.04, base);
  const half = W / 2 - 0.1;
  const gateL = pu - 1.7;
  const gateR = pu + 1.7;
  // Front wall in two pieces either side of the gate, low with an MS grill on top.
  for (const [u0, u1] of [[-half, gateL], [gateR, half]] as [number, number][]) {
    if (u1 - u0 < 0.3) continue;
    B.add('wall', wallSeg(P(u0, 0.15), P(u1, 0.15), 0.2, 1.0, base));
    B.add('darkMetal', wallSeg(P(u0, 0.15), P(u1, 0.15), 0.05, 0.05, base + 1.6));
    B.add(pal.accent, wallSeg(P(u0, 0.15), P(u1, 0.15), 0.26, 0.08, base + 1.0));
  }
  for (const u of [gateL, gateR]) bx('pillar', u, 0.15, 0.4, 0.4, 1.8, base);
  bx('darkMetal', pu, 0.15, 3.0, 0.06, 1.4, base + 0.1);
  for (const s of [-1, 1]) B.add('wall', wallSeg(P(s * half, 0.15), P(s * half, D - 0.15), 0.18, 1.6, base));
  B.add('wall', wallSeg(P(-half, D - 0.15), P(half, D - 0.15), 0.18, 1.6, base));
  // Porch / gate lights and a tree or two in the front lawn.
  ctx.lamps.push({ p: P(pu, v0 - pd + 0.4), h: g0 + 2.6, arm: 0, angle: 0 });
  if (o.hero || o.rng() > 0.55) ctx.trees.push({ p: P(-porchLeft * (fw / 2 - 1.2), 1.4), kind: o.hero || o.rng() > 0.5 ? 'palm' : 'jacaranda', s: 0.45 + o.rng() * 0.15 });
  if (o.hero) {
    ctx.trees.push({ p: P(-porchLeft * (fw / 2 - 3.2), 1.6), kind: 'palm', s: 0.5 });
    bx('flowers', -porchLeft * (fw / 2 - 2), 0.8, Math.max(1, lw - 1), 0.6, 0.35, base);
    ctx.lamps.push({ p: P(gateL, 0.15), h: base + 1.9, arm: 0, angle: 0 }, { p: P(gateR, 0.15), h: base + 1.9, arm: 0, angle: 0 });
  }
}
