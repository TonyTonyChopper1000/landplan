import { rule } from '../rules/regulations';
import type { Layout, Plot } from './types';

export type Setbacks = { front: number; rear: number; side: number };

/** Front setback from SB-FRONT; rear and side are documented assumptions (DECISIONS.md). */
export function setbacksFor(areaM2: number): Setbacks {
  const table = rule('SB-FRONT').value as { max: number; m: number }[];
  const front = (table.find((t) => areaM2 < t.max) ?? table[table.length - 1]).m;
  if (areaM2 < 200) return { front, rear: 1, side: 0 };
  if (areaM2 < 300) return { front, rear: 1.5, side: 1 };
  return { front, rear: 2, side: 1.5 };
}

export function footprint(p: Plot, enabled = true): { w: number; d: number; coverage: number; sb: Setbacks } {
  const sb = enabled ? setbacksFor(p.area) : { front: 0, rear: 0, side: 0 };
  const w = Math.max(0, p.width - 2 * sb.side);
  const d = Math.max(0, p.depth - sb.front - sb.rear);
  return { w, d, coverage: Math.min(1, (w * d) / (p.width * p.depth)), sb };
}

export function coverageFor(layout: Layout): number {
  const ps = layout.plots;
  if (!ps.length) return 0;
  const enabled = layout.params.built.setbacks;
  let built = 0;
  let total = 0;
  for (const p of ps) {
    const f = footprint(p, enabled);
    built += f.coverage * p.area;
    total += p.area;
  }
  return built / total;
}
