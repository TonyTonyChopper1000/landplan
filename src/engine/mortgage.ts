import type { Plot } from './types';

/** Descending plot number, whole plots, until cumulative area ≥ mortPct of plotted area. */
export function applyMortgage(plots: Plot[], mortPct: number): void {
  const plotted = plots.reduce((s, p) => s + p.area, 0);
  const target = plotted * (mortPct / 100);
  let cum = 0;
  for (const p of plots) p.mortgaged = false;
  const byNo = [...plots].sort((a, b) => b.no - a.no);
  for (const p of byNo) {
    if (cum >= target) break;
    p.mortgaged = true;
    cum += p.area;
  }
}

export function mortgagedArea(plots: Plot[]): number {
  return plots.filter((p) => p.mortgaged).reduce((s, p) => s + p.area, 0);
}
