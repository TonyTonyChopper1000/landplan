// v2 plot packing: choose whole-foot plot widths along a frontage of length L by dynamic programming.
import { FT, SQYD } from './geometry';
import type { PlotSize } from './types';

export type Pattern = { widths: { sqyd: number; width: number }[]; used: number; leftover: number; deviation: number };

/**
 * Pack a row of length L (m). Widths are each enabled size at this depth, snapped to whole feet.
 * Objective: fill as much frontage as possible, then stay close to the weighted target mix.
 * A remainder ≤ stretchMax·L is absorbed by widening every plot equally.
 */
export function packRow(L: number, depth: number, sizes: PlotSize[], minWidth = 0, stretchMax = 0.02): Pattern {
  const opts = sizes
    .filter((s) => s.on && s.weight > 0)
    .map((s) => ({ sqyd: s.sqyd, ft: Math.max(1, Math.round((s.sqyd * SQYD) / depth / FT)), weight: s.weight }))
    .filter((o) => o.ft * FT >= minWidth - 1e-9);
  // Like v1, the last plot may overhang by up to 40% of the smallest width; the clip keeps it if ≥ 60% remains.
  const minFt = Math.min(...opts.map((o) => o.ft));
  const Lft = Math.floor((L + 0.4 * minFt * FT) / FT + 1e-9);
  if (!opts.length || Lft <= 0) return { widths: [], used: 0, leftover: L, deviation: 0 };
  const share = opts.reduce((s, o) => s + o.weight * o.ft, 0);
  const target = opts.map((o) => (Lft * o.weight) / share);
  // dp[len] = min deviation to use exactly len feet with the sizes processed so far
  let dp = new Float64Array(Lft + 1).fill(Infinity);
  dp[0] = 0;
  const choice: Int16Array[] = [];
  opts.forEach((o, i) => {
    const t = target[i];
    const lo = Math.max(0, Math.floor(t) - 3);
    const hi = Math.ceil(t) + 3;
    const next = new Float64Array(Lft + 1).fill(Infinity);
    const ch = new Int16Array(Lft + 1).fill(-1);
    for (let len = 0; len <= Lft; len++) {
      if (dp[len] === Infinity) continue;
      for (let c = lo; c <= hi; c++) {
        const nl = len + c * o.ft;
        if (nl > Lft) break;
        const v = dp[len] + Math.abs(c - t);
        if (v < next[nl]) {
          next[nl] = v;
          ch[nl] = c;
        }
      }
    }
    choice.push(ch);
    dp = next;
  });
  let best = -1;
  let bestScore = Infinity;
  for (let len = 0; len <= Lft; len++) {
    if (dp[len] === Infinity) continue;
    const score = (Lft - len) * 2 + dp[len];
    if (score < bestScore) {
      bestScore = score;
      best = len;
    }
  }
  if (best <= 0) return { widths: [], used: 0, leftover: L, deviation: 0 };
  // Backtrack counts
  const counts = new Array(opts.length).fill(0);
  let len = best;
  for (let i = opts.length - 1; i >= 0; i--) {
    const c = choice[i][len];
    counts[i] = c;
    len -= c * opts[i].ft;
  }
  const seq: { sqyd: number; width: number }[] = [];
  opts.forEach((o, i) => {
    for (let k = 0; k < counts[i]; k++) seq.push({ sqyd: o.sqyd, width: o.ft * FT });
  });
  seq.sort((a, b) => a.width - b.width);
  const out: { sqyd: number; width: number }[] = [];
  for (let i = 0, j = seq.length - 1; i <= j; ) {
    out.push(seq[i++]);
    if (i <= j) out.push(seq[j--]);
  }
  const used = out.reduce((s, w) => s + w.width, 0);
  const rem = L - used;
  if (rem < 0) return { widths: out, used, leftover: 0, deviation: dp[best] };
  if (rem > 1e-9 && rem <= stretchMax * L) {
    const k = L / used;
    return { widths: out.map((w) => ({ ...w, width: w.width * k })), used: L, leftover: 0, deviation: dp[best] };
  }
  return { widths: out, used, leftover: rem, deviation: dp[best] };
}
