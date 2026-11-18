import { generate, prepare, type GridConfig } from './layout';
import { runChecks, tally } from './checks';
import { finance } from './finance';
import type { Layout, Params } from './types';

export const THETAS = Array.from({ length: 18 }, (_, i) => i * 5);
export const BL_FACTORS = [1, 0.75, 1.25];
export const OFFSETS = [0, 1 / 3, 2 / 3];

export type Candidate = {
  idx: number;
  theta: number;
  blFactor: number;
  blockLen: number;
  offX: number;
  offY: number;
  plotted: number;
  plots: number;
  margin: number;
  failing: number;
};

export function candidates(params: Params): Omit<Candidate, 'plotted' | 'plots' | 'margin' | 'failing'>[] {
  const out: Omit<Candidate, 'plotted' | 'plots' | 'margin' | 'failing'>[] = [];
  for (const theta of THETAS)
    for (const blFactor of BL_FACTORS)
      for (const offX of OFFSETS)
        for (const offY of OFFSETS)
          out.push({ idx: out.length, theta, blFactor, blockLen: params.plots.blockLen * blFactor, offX, offY });
  return out;
}

export const toGrid = (c: Pick<Candidate, 'theta' | 'blockLen' | 'offX' | 'offY'>): GridConfig => ({
  theta: c.theta,
  blockLen: c.blockLen,
  offX: c.offX,
  offY: c.offY,
});

/** v1 optimizer: maximum plotted area; first maximum wins ties (deterministic order). */
export function optimize(
  params: Params,
  opts: { scoreExtras?: boolean; onResult?: (c: Candidate) => void } = {},
): { best: Candidate; layout: Layout; all: Candidate[] } {
  const prep = prepare(params);
  const all: Candidate[] = [];
  let best: Candidate | null = null;
  let bestLayout: Layout | null = null;
  for (const c of candidates(params)) {
    const layout = generate(params, toGrid(c), prep);
    const res: Candidate = { ...c, plotted: layout.plotted, plots: layout.plots.length, margin: 0, failing: 0 };
    if (opts.scoreExtras) {
      res.margin = finance(layout).marginPct;
      res.failing = tally(runChecks(layout)).failing;
    }
    all.push(res);
    opts.onResult?.(res);
    if (!best || res.plotted > best.plotted + 1e-9) {
      best = res;
      bestLayout = layout;
    }
  }
  if (!best || !bestLayout) throw new Error('No candidates');
  return { best, layout: bestLayout, all };
}
