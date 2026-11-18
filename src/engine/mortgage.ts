import type { Plot } from './types';

export type MortPolicy = 'highest' | 'contiguous' | 'lowest-value';

/**
 * Whole plots only, until the cumulative area reaches mortPct of plotted area.
 * highest: descending plot number (v1). contiguous: whole blocks from the last block backwards.
 * lowest-value: cheapest plots first (multiplier, then size), keeping premium stock sellable.
 */
export function applyMortgage(plots: Plot[], mortPct: number, policy: MortPolicy = 'highest'): void {
  const plotted = plots.reduce((s, p) => s + p.area, 0);
  const target = plotted * (mortPct / 100);
  let cum = 0;
  for (const p of plots) p.mortgaged = false;
  let order: Plot[];
  if (policy === 'lowest-value') order = [...plots].sort((a, b) => a.multiplier - b.multiplier || a.area - b.area || b.no - a.no);
  else if (policy === 'contiguous') {
    const blocks = new Map<number, Plot[]>();
    for (const p of plots) blocks.set(p.blockId, [...(blocks.get(p.blockId) ?? []), p]);
    const byBlock = [...blocks.values()].sort((a, b) => Math.max(...b.map((p) => p.no)) - Math.max(...a.map((p) => p.no)));
    order = byBlock.flatMap((g) => [...g].sort((a, b) => b.no - a.no));
  } else order = [...plots].sort((a, b) => b.no - a.no);
  for (const p of order) {
    if (cum >= target) break;
    p.mortgaged = true;
    cum += p.area;
  }
}

export function mortgagedArea(plots: Plot[]): number {
  return plots.filter((p) => p.mortgaged).reduce((s, p) => s + p.area, 0);
}

/** Compress plot numbers into ranges: [1,2,3,7,9,10] → "1–3, 7, 9–10". */
export function plotRanges(nos: number[]): string {
  const s = [...nos].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? `${s[i]}` : `${s[i]}–${s[j]}`);
    i = j + 1;
  }
  return out.join(', ');
}
