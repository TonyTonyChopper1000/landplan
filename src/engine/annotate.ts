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
export function annotate(plots: Plot[], params: Params, thetaRad: number, origin: Pt): void {
  plots.forEach((p, i) => {
    p.no = i + 1;
    p.region = rotateRegion(p.region, thetaRad, origin);
    p.centroid = regionCentroid(p.region);
    p.facing = facingFor(p.row, thetaRad, params.site.northOffset);
    p.multiplier = multiplierFor(p, params.money);
  });
  applyMortgage(plots, params.money.mortPct);
}
