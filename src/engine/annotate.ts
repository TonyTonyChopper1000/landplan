import { regionCentroid, rotate, rotateRegion, type Pt } from './geometry';
import { applyMortgage } from './mortgage';
import { DIRS, type Dir8, type Params, type Plot } from './types';

export function snapDir(bearingDeg: number): Dir8 {
  const b = ((bearingDeg % 360) + 360) % 360;
  return DIRS[Math.round(b / 45) % 8];
}

/** Front-side normal rotated by θ, adjusted for north offset, snapped to 8 directions. */
export function facingFor(fs: -1 | 1, thetaRad: number, northOffset: number): Dir8 {
  const n = rotate({ x: 0, y: fs }, thetaRad);
  const bearing = (Math.atan2(n.x, n.y) * 180) / Math.PI + northOffset;
  return snapDir(bearing);
}

export function multiplierFor(p: Pick<Plot, 'facing' | 'corner' | 'irregular'>, m: Params['money']): number {
  return 1 + (m.premiums[p.facing] ?? 0) + (p.corner ? m.corner : 0) - (p.irregular ? m.irregular : 0);
}

/** Number in generation order, convert to world frame, set facing, multiplier and mortgage. */
export function annotate(plots: Plot[], params: Params, thetaRad: number, origin: Pt, entry?: Pt): void {
  for (const p of plots) {
    p.region = rotateRegion(p.region, thetaRad, origin);
    p.centroid = regionCentroid(p.region);
  }
  if (params.plots.numbering === 'serpentine' && entry) serpentine(plots, entry);
  plots.forEach((p, i) => {
    p.no = i + 1;
    p.facing = facingFor(p.row, thetaRad, params.site.northOffset);
    p.multiplier = multiplierFor(p, params.money);
  });
  applyMortgage(plots, params.money.mortPct, params.money.mortPolicy);
}

/** Real-layout numbering: blocks from the entry outward; bottom row left→right, top row right→left. */
function serpentine(plots: Plot[], entry: Pt): void {
  const blocks = new Map<number, Plot[]>();
  for (const p of plots) blocks.set(p.blockId, [...(blocks.get(p.blockId) ?? []), p]);
  const dist = (g: Plot[]) => {
    const c = g.reduce((a, p) => ({ x: a.x + p.centroid.x / g.length, y: a.y + p.centroid.y / g.length }), { x: 0, y: 0 });
    return Math.hypot(c.x - entry.x, c.y - entry.y);
  };
  const ordered = [...blocks.entries()].sort((a, b) => dist(a[1]) - dist(b[1]) || a[0] - b[0]);
  const out: Plot[] = [];
  for (const [, g] of ordered) {
    out.push(...g.filter((p) => p.row === -1).sort((a, b) => a.rect.x0 - b.rect.x0));
    out.push(...g.filter((p) => p.row === 1).sort((a, b) => b.rect.x0 - a.rect.x0));
  }
  plots.splice(0, plots.length, ...out);
}
