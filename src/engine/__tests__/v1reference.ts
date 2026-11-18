// Independent, deliberately plain re-implementation of the v1 algorithm (§3 of PROMPT.md),
// written in the single-function style of the v1 HTML file. It shares NO code with src/engine
// so that parity tests compare two implementations, not one implementation with itself.
// Fixtures in ./fixtures are generated from this file (see parity.test.ts).

type P = { x: number; y: number };
export type V1Input = {
  preset: [number, number][];
  acres: number;
  depthFt: number;
  blockLen: number;
  roadX: number;
  roadY: number;
  periph: number;
  openPct: number;
  mortPct: number;
  sizes: { sqyd: number; on: boolean; weight: number }[];
};
export type V1Plot = { no: number; area: number; w: number; corner: boolean; irregular: boolean; mortgaged: boolean; fs: number };
export type V1Result = { theta: number; blockLen: number; offX: number; offY: number; plotted: number; open: number; plots: V1Plot[] };

const ACRE = 4046.8564224;
const SQYD = 0.83612736;
const FT = 0.3048;

function shoelace(p: P[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return a / 2;
}

function clip(poly: P[], x0: number, y0: number, x1: number, y1: number) {
  let out = poly;
  const sides: [(p: P) => boolean, (a: P, b: P) => P][] = [
    [(p) => p.x >= x0, (a, b) => ({ x: x0, y: a.y + ((b.y - a.y) * (x0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= x1, (a, b) => ({ x: x1, y: a.y + ((b.y - a.y) * (x1 - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (y0 - a.y)) / (b.y - a.y), y: y0 })],
    [(p) => p.y <= y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (y1 - a.y)) / (b.y - a.y), y: y1 })],
  ];
  for (const [ins, cut] of sides) {
    if (!out.length) break;
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      const pr = src[(i + src.length - 1) % src.length];
      if (ins(c)) {
        if (!ins(pr)) out.push(cut(pr, c));
        out.push(c);
      } else if (ins(pr)) out.push(cut(pr, c));
    }
  }
  return out;
}

function inset(p: P[], d: number): P[] {
  if (d <= 0) return p;
  const n = p.length;
  const L = p.map((a, i) => {
    const b = p[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.x - a.x) / l;
    const dy = (b.y - a.y) / l;
    return { px: a.x - dy * d, py: a.y + dx * d, dx, dy };
  });
  return L.map((l2, i) => {
    const l1 = L[(i + n - 1) % n];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    if (Math.abs(den) < 1e-9) return { x: l2.px, y: l2.py };
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    return { x: l1.px + l1.dx * t, y: l1.py + l1.dy * t };
  });
}

function centroidOf(p: P[]) {
  const a = shoelace(p);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const f = p[i].x * p[j].y - p[j].x * p[i].y;
    cx += (p[i].x + p[j].x) * f;
    cy += (p[i].y + p[j].y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function v1Run(inp: V1Input, thetaDeg: number, bl: number, offX: number, offY: number): V1Result {
  let unit = inp.preset.map(([x, y]) => ({ x, y }));
  if (shoelace(unit) < 0) unit = unit.reverse();
  const s = Math.sqrt((inp.acres * ACRE) / Math.abs(shoelace(unit)));
  const scaled = unit.map((q) => ({ x: q.x * s, y: q.y * s }));
  const c0 = centroidOf(scaled);
  const parcel = scaled.map((q) => ({ x: q.x - c0.x, y: q.y - c0.y }));
  const gross = Math.abs(shoelace(parcel));
  const c = centroidOf(parcel);
  const th = (thetaDeg * Math.PI) / 180;
  const cs = Math.cos(-th);
  const sn = Math.sin(-th);
  const rot = inset(parcel, inp.periph).map((q) => ({
    x: c.x + (q.x - c.x) * cs - (q.y - c.y) * sn,
    y: c.y + (q.x - c.x) * sn + (q.y - c.y) * cs,
  }));
  const xs = rot.map((q) => q.x);
  const ys = rot.map((q) => q.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const d = inp.depthFt * FT;
  const minPlot = 70 * SQYD;
  const px = bl + inp.roadX;
  const py = 2 * d + inp.roadY;
  const gx = minX - offX * px;
  const gy = minY - offY * py;
  const nx = Math.max(0, Math.ceil((maxX - gx) / px));
  const ny = Math.max(0, Math.ceil((maxY - gy) / py));
  const blocks: { x0: number; y0: number; poly: P[]; area: number; dist: number; open: boolean }[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x0 = gx + i * px;
      const y0 = gy + j * py;
      const poly = clip(rot, x0, y0, x0 + bl, y0 + 2 * d);
      const a = poly.length >= 3 ? Math.abs(shoelace(poly)) : 0;
      if (a <= 2.5 * minPlot) continue;
      const bc = centroidOf(poly);
      blocks.push({ x0, y0, poly, area: a, dist: Math.hypot(bc.x - c.x, bc.y - c.y), open: false });
    }
  const order = blocks.map((_, i) => i).sort((a, b) => blocks[a].dist - blocks[b].dist || a - b);
  let cum = 0;
  for (const i of order) {
    if (cum >= gross * (inp.openPct / 100)) break;
    blocks[i].open = true;
    cum += blocks[i].area;
  }
  const raw: number[] = [];
  inp.sizes.forEach((z) => {
    if (z.on) for (let k = 0; k < Math.round(z.weight); k++) raw.push(z.sqyd);
  });
  raw.sort((a, b) => a - b);
  const seq: number[] = [];
  for (let lo = 0, hi = raw.length - 1; lo <= hi; ) {
    seq.push(raw[lo++]);
    if (lo <= hi) seq.push(raw[hi--]);
  }
  const widths = seq.map((q) => (q * SQYD) / d);
  const plots: V1Plot[] = [];
  let k = 0;
  if (widths.length)
    for (const b of blocks) {
      if (b.open) continue;
      for (const fs of [-1, 1]) {
        const ry = fs === -1 ? b.y0 : b.y0 + d;
        const row: V1Plot[] = [];
        for (let x = b.x0; x < b.x0 + bl - 1e-9; ) {
          const w = widths[k++ % widths.length];
          const poly = clip(b.poly, x, ry, x + w, ry + d);
          x += w;
          if (poly.length < 3) continue;
          const a = Math.abs(shoelace(poly));
          if (a < 0.6 * w * d || a < minPlot) continue;
          row.push({ no: 0, area: a, w, corner: false, irregular: a < 0.965 * w * d, mortgaged: false, fs });
        }
        if (row.length) {
          row[0].corner = true;
          row[row.length - 1].corner = true;
        }
        plots.push(...row);
      }
    }
  plots.forEach((p, i) => (p.no = i + 1));
  const plotted = plots.reduce((q, p) => q + p.area, 0);
  let m = 0;
  for (let i = plots.length - 1; i >= 0; i--) {
    if (m >= plotted * (inp.mortPct / 100)) break;
    plots[i].mortgaged = true;
    m += plots[i].area;
  }
  return { theta: thetaDeg, blockLen: bl, offX, offY, plotted, open: cum, plots };
}

export function v1Optimize(inp: V1Input): V1Result {
  let best: V1Result | null = null;
  for (let t = 0; t <= 85; t += 5)
    for (const f of [1, 0.75, 1.25])
      for (const ox of [0, 1 / 3, 2 / 3])
        for (const oy of [0, 1 / 3, 2 / 3]) {
          const r = v1Run(inp, t, inp.blockLen * f, ox, oy);
          if (!best || r.plotted > best.plotted + 1e-9) best = r;
        }
  return best as V1Result;
}
