// v2 search: seeded multi-start Nelder–Mead over continuous grid parameters, a discrete placement sweep,
// hard-constraint rejection, top-5 diverse layouts and a Pareto set. Cooperative cancellation via AbortSignal.
import { RULES_BY_ID } from '../rules/regulations';
import { runChecks, type Check } from './checks';
import { finance, plotPrice } from './finance';
import { generate, prepare, type GridConfig, type Prepared } from './layout';
import { mulberry32 } from './prng';
import { BL_FACTORS, OFFSETS, THETAS } from './optimize';
import { SQYD } from './geometry';
import type { Layout, Params } from './types';

export type Weights = { alpha: number; beta: number; gamma: number };
export const DEFAULT_WEIGHTS: Weights = { alpha: 0.05, beta: 0.1, gamma: 1 };

export type Evaluated = {
  grid: GridConfig & { blFactor: number };
  placement: Params['open']['placement'];
  score: number;
  plotted: number;
  plots: number;
  marginPct: number;
  warnings: number;
  rejected: string[];
  signature: Set<string>;
};

export type SearchOptions = {
  seed?: number;
  budgetMs?: number;
  maxCandidates?: number;
  starts?: number;
  weights?: Partial<Weights>;
  signal?: AbortSignal;
  onProgress?: (p: { evaluated: number; bestScore: number; etaMs: number }) => void;
};

export type SearchResult = {
  seed: number;
  evaluated: number;
  elapsedMs: number;
  cancelled: boolean;
  top: { params: Params; layout: Layout; evaluation: Omit<Evaluated, 'signature'> }[];
  pareto: Omit<Evaluated, 'signature'>[];
};

/** A check rejects a candidate only when it fails on an in-force rule. Conflict/verify rules only warn. */
export function classify(checks: Check[]): { rejected: string[]; warnings: number } {
  const rejected: string[] = [];
  let warnings = 0;
  for (const c of checks) {
    if (c.status === 'warn' || c.status === 'conflict') warnings++;
    if (c.status !== 'fail') continue;
    const inForce = c.ruleIds.every((r) => RULES_BY_ID[r.split(':')[0]]?.status === 'in-force');
    if (inForce && !c.verify) rejected.push(c.id);
    else warnings++;
  }
  return { rejected, warnings };
}

export function scoreLayout(layout: Layout, w: Weights): number {
  const p = layout.params;
  const value = layout.plots.reduce((s, pl) => s + plotPrice(pl, p), 0);
  const roadLen = layout.roadRuns.reduce((s, r) => s + r.length, 0);
  const roadCost = roadLen * p.money.roadCostPerM;
  const irregular = layout.plots.filter((pl) => pl.irregular).reduce((s, pl) => s + pl.area, 0);
  const rate = p.money.baseRate / SQYD;
  // Mix deviation: share by count vs weighted target among enabled sizes
  const on = p.plots.sizes.filter((s) => s.on && s.weight > 0);
  const tw = on.reduce((s, x) => s + x.weight, 0) || 1;
  const n = layout.plots.length || 1;
  const dev = on.reduce((s, x) => s + Math.abs(layout.plots.filter((pl) => pl.sizeSqYd === x.sqyd).length / n - x.weight / tw), 0);
  const openValue = layout.openArea * rate * 0.01;
  return value - roadCost - w.alpha * irregular * rate - w.beta * dev * value - w.gamma * openValue;
}

const signatureOf = (l: Layout) => new Set(l.plots.map((p) => `${Math.round(p.centroid.x)},${Math.round(p.centroid.y)}`));
function difference(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? 1 - inter / uni : 0;
}

export async function search(params: Params, opts: SearchOptions = {}): Promise<SearchResult> {
  const seed = opts.seed ?? 1;
  const rand = mulberry32(seed);
  const w = { ...DEFAULT_WEIGHTS, ...opts.weights };
  const budget = opts.budgetMs ?? 8000;
  const cap = opts.maxCandidates ?? 1500;
  const t0 = Date.now();
  const placements: Params['open']['placement'][] = params.mode === 'rules' ? ['central', 'distributed', ...(params.constraints.length ? (['buffer'] as const) : [])] : ['central'];
  const preps = new Map<string, { prep: Prepared; params: Params }>();
  const prepFor = (pl: Params['open']['placement']) => {
    let v = preps.get(pl);
    if (!v) {
      const pp = { ...params, open: { ...params.open, placement: pl } };
      v = { prep: prepare(pp), params: pp };
      preps.set(pl, v);
    }
    return v;
  };
  const all: Evaluated[] = [];
  let evaluated = 0;
  let cancelled = false;
  const stop = () => {
    if (opts.signal?.aborted) cancelled = true;
    return cancelled || evaluated >= cap || Date.now() - t0 > budget;
  };

  const evaluate = (x: number[], pl: Params['open']['placement']): number => {
    const theta = ((x[0] % 90) + 90) % 90;
    const offX = ((x[1] % 1) + 1) % 1;
    const offY = ((x[2] % 1) + 1) % 1;
    const blFactor = Math.min(1.5, Math.max(0.6, x[3]));
    const { prep, params: pp } = prepFor(pl);
    const grid = { theta, blockLen: pp.plots.blockLen * blFactor, offX, offY };
    let layout: Layout;
    try {
      layout = generate(pp, grid, prep);
    } catch {
      return 1e18;
    }
    evaluated++;
    const checks = runChecks(layout);
    const { rejected, warnings } = classify(checks);
    const score = scoreLayout(layout, w);
    const e: Evaluated = { grid: { ...grid, blFactor }, placement: pl, score, plotted: layout.plotted, plots: layout.plots.length, marginPct: finance(layout).marginPct, warnings, rejected, signature: signatureOf(layout) };
    all.push(e);
    if (opts.onProgress && evaluated % 10 === 0) {
      const best = Math.max(...all.filter((a) => !a.rejected.length).map((a) => a.score), -Infinity);
      const rate = (Date.now() - t0) / evaluated;
      opts.onProgress({ evaluated, bestScore: best, etaMs: Math.max(0, Math.min(budget - (Date.now() - t0), (cap - evaluated) * rate)) });
    }
    return rejected.length ? -score + Math.abs(score) + 1e12 : -score;
  };

  // Nelder–Mead in 4-D
  const nelderMead = async (x0: number[], pl: Params['open']['placement'], scale: number[]) => {
    let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + scale[j] : v)))].map((x) => ({ x, f: evaluate(x, pl) }));
    for (let it = 0; it < 40 && !stop(); it++) {
      simplex.sort((a, b) => a.f - b.f);
      const n = x0.length;
      const c = Array.from({ length: n }, (_, j) => simplex.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n);
      const worst = simplex[n];
      const at = (k: number) => c.map((v, j) => v + k * (worst.x[j] - v));
      const r = { x: at(-1), f: 0 };
      r.f = evaluate(r.x, pl);
      if (r.f < simplex[0].f) {
        const e = { x: at(-2), f: 0 };
        e.f = evaluate(e.x, pl);
        simplex[n] = e.f < r.f ? e : r;
      } else if (r.f < simplex[n - 1].f) simplex[n] = r;
      else {
        const k = { x: at(0.5), f: 0 };
        k.f = evaluate(k.x, pl);
        if (k.f < worst.f) simplex[n] = k;
        else simplex = simplex.map((p, i) => (i === 0 ? p : { x: p.x.map((v, j) => simplex[0].x[j] + 0.5 * (v - simplex[0].x[j])), f: 0 })).map((p, i) => (i === 0 ? p : { ...p, f: evaluate(p.x, pl) }));
      }
      if (evaluated % 20 === 0) await new Promise((res) => setTimeout(res, 0));
      const spread = Math.abs(simplex[n].f - simplex[0].f);
      if (spread < 1e-6 * Math.abs(simplex[0].f || 1)) break;
    }
  };

  const starts = opts.starts ?? 6;
  outer: for (const pl of placements) {
    // The full v1 grid (θ × block length × offsets) seeds the starts, so v2 never does worse than v1;
    // seeded random starts add diversity.
    const coarse: { x: number[]; f: number }[] = [];
    for (const th of THETAS)
      for (const bl of BL_FACTORS)
        for (const ox of OFFSETS)
          for (const oy of OFFSETS) {
            if (stop()) break;
            const x = [th, ox, oy, bl];
            coarse.push({ x, f: evaluate(x, pl) });
          }
    coarse.sort((a, b) => a.f - b.f);
    const seeds: number[][] = [];
    for (const c of coarse) {
      if (seeds.length >= Math.ceil(starts / 2)) break;
      if (seeds.every((s0) => Math.abs(s0[0] - c.x[0]) >= 10 || Math.abs(s0[3] - c.x[3]) > 0.01)) seeds.push(c.x);
    }
    while (seeds.length < starts) seeds.push([rand() * 90, rand(), rand(), 0.75 + rand() * 0.5]);
    for (const s of seeds) {
      if (stop()) break outer;
      await nelderMead(s, pl, [6, 0.2, 0.2, 0.15]);
    }
  }

  // Top 5 diverse, valid layouts
  const valid = all.filter((e) => !e.rejected.length).sort((a, b) => b.score - a.score);
  const picked: Evaluated[] = [];
  for (const e of valid) {
    if (picked.length >= 5) break;
    if (picked.every((p) => difference(p.signature, e.signature) >= 0.1)) picked.push(e);
  }
  // Pareto on (plotted ↑, margin ↑, warnings ↓)
  const pool = valid.length ? valid : all;
  const pareto = pool.filter((a) => !pool.some((b) => b !== a && b.plotted >= a.plotted && b.marginPct >= a.marginPct && b.warnings <= a.warnings && (b.plotted > a.plotted || b.marginPct > a.marginPct || b.warnings < a.warnings)));
  const strip = ({ signature: _s, ...rest }: Evaluated) => {
    void _s;
    return rest;
  };
  return {
    seed,
    evaluated,
    elapsedMs: Date.now() - t0,
    cancelled,
    // Layouts are deterministic, so only the picked ones are regenerated (keeps memory flat).
    top: picked.map((e) => {
      const { prep, params: pp } = prepFor(e.placement);
      const out = { ...pp, grid: { theta: e.grid.theta, blockLenFactor: e.grid.blFactor, offX: e.grid.offX, offY: e.grid.offY } };
      return { params: out, layout: generate(pp, e.grid, prep), evaluation: strip(e) };
    }),
    pareto: pareto.slice(0, 60).map(strip),
  };
}
