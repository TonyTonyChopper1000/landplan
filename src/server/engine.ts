// Server-side engine runs: v1/v2 selection, hashing, caching, result building.
import { optimize } from '../engine/optimize';
import { generate } from '../engine/layout';
import { runChecks } from '../engine/checks';
import { inputHash } from '../engine/hash';
import { parcelFor } from '../engine/parcel';
import { ACRE, area } from '../engine/geometry';
import { checksOut, toLayoutResult } from '../engine/result';
import { search, type SearchOptions } from '../engine/search';
import type { Params } from '../engine/types';
import { Problem } from './http';
import { applyGo105, defaultParams } from '../engine/defaults';
import { deepMerge, validate } from './params';

export const SYNC_MAX_ACRES = Number(process.env.SYNC_MAX_ACRES ?? 150);

/** engine 'v1' = parity mode with cycling widths; 'v2' = rule-aware with DP packing unless the caller sets it. */
export function paramsFor(input: unknown, engine: 'v1' | 'v2'): Params {
  const raw = (input ?? {}) as { mode?: string; plots?: { packing?: string; numbering?: string } };
  const forced =
    engine === 'v1'
      ? { mode: 'parity', plots: { packing: 'cycle', numbering: 'v1' } }
      : { mode: raw.mode ?? 'rules', plots: { packing: raw.plots?.packing ?? 'dp', numbering: raw.plots?.numbering ?? 'serpentine' } };
  // v2 starts from the GO 105 standards preset; anything the caller sends overrides it.
  const base = engine === 'v2' ? applyGo105(defaultParams()) : defaultParams();
  return validate(deepMerge(deepMerge(base, input ?? {}), forced));
}

export function grossAcres(p: Params): number {
  return area(parcelFor(p)) / ACRE;
}

type GenOpts = { engine: 'v1' | 'v2'; seed: number; optimizeGrid: boolean; output: 'local' | 'wgs84' };
export const generateHash = (params: Params, opts: GenOpts) =>
  inputHash({ params, engine: opts.engine, seed: opts.seed, optimizeGrid: opts.optimizeGrid, output: opts.output, v: 2 });

export async function generateResult(params: Params, opts: { engine: 'v1' | 'v2'; seed: number; optimizeGrid: boolean; output: 'local' | 'wgs84' }) {
  const ac = grossAcres(params);
  if (ac > SYNC_MAX_ACRES)
    throw new Problem(413, 'Site too large for synchronous generation', `${ac.toFixed(1)} acres exceeds ${SYNC_MAX_ACRES}; use POST /v1/layouts/optimize.`);
  const hash = await generateHash(params, opts);
  const t0 = performance.now();
  let p = params;
  const timings: Record<string, number> = {};
  if (opts.optimizeGrid) {
    const best = optimize(p).best;
    p = { ...p, grid: { theta: best.theta, blockLenFactor: best.blFactor, offX: best.offX, offY: best.offY } };
    timings.gridSearch = Math.round(performance.now() - t0);
  }
  const t1 = performance.now();
  const layout = generate(p);
  timings.generate = Math.round((performance.now() - t1) * 10) / 10;
  const t2 = performance.now();
  const checks = runChecks(layout);
  timings.checks = Math.round((performance.now() - t2) * 10) / 10;
  const result = { ...toLayoutResult(layout, { mode: opts.engine, seed: opts.seed, inputHash: hash, output: opts.output, timings }), checks: checksOut(checks), params: p };
  result.diagnostics.stageTimingsMs.total = Math.round(performance.now() - t0);
  return { hash, result };
}

export async function optimizeResult(params: Params, opts: SearchOptions & { engine: 'v1' | 'v2'; output: 'local' | 'wgs84' }) {
  const seed = opts.seed ?? 1;
  const hash = await inputHash({ params, engine: opts.engine, seed, budgetMs: opts.budgetMs, maxCandidates: opts.maxCandidates, weights: opts.weights, v: 2 });
  if (opts.engine === 'v1') {
    const r = optimize(params);
    const layout = r.layout;
    const p = { ...params, grid: { theta: r.best.theta, blockLenFactor: r.best.blFactor, offX: r.best.offX, offY: r.best.offY } };
    const one = { ...toLayoutResult(layout, { mode: 'v1', seed, inputHash: hash, output: opts.output }), checks: checksOut(runChecks(layout)), params: p };
    return { hash, result: { seed, evaluated: r.all.length, cancelled: false, top: [one], pareto: r.all.map((c) => ({ grid: { theta: c.theta, blFactor: c.blFactor, offX: c.offX, offY: c.offY }, plotted: c.plotted, plots: c.plots })) } };
  }
  const s = await search(params, opts);
  const top = s.top.map((t) => ({ ...toLayoutResult(t.layout, { mode: 'v2', seed, inputHash: hash, output: opts.output, warnings: t.evaluation.rejected.length ? [`rejected by ${t.evaluation.rejected.join(', ')}`] : [] }), checks: checksOut(runChecks(t.layout)), params: t.params, evaluation: t.evaluation }));
  return { hash, result: { seed, evaluated: s.evaluated, elapsedMs: s.elapsedMs, cancelled: s.cancelled, top, pareto: s.pareto } };
}
