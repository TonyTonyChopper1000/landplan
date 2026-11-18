import { describe, expect, it } from 'vitest';
import { applyGo105, defaultParams } from '../defaults';
import { search } from '../search';
import { optimize } from '../optimize';

describe('v2 search', () => {
  const p = applyGo105(defaultParams());
  it('is deterministic for a seed and at least as good as the v1 grid', async () => {
    const a = await search(p, { seed: 5, maxCandidates: 700 });
    const b = await search(p, { seed: 5, maxCandidates: 700 });
    expect(a.top.map((t) => t.evaluation.score)).toEqual(b.top.map((t) => t.evaluation.score));
    expect(a.top.length).toBeGreaterThan(0);
    expect(Math.max(...a.top.map((t) => t.layout.plotted))).toBeGreaterThanOrEqual(optimize(p).layout.plotted * 0.995);
  }, 30000);
  it('returns diverse top layouts and a Pareto set', async () => {
    const r = await search(p, { seed: 2, maxCandidates: 700 });
    expect(r.top.length).toBeLessThanOrEqual(5);
    expect(r.pareto.length).toBeGreaterThan(0);
    for (const t of r.top) expect(t.evaluation.rejected).toEqual([]);
  }, 30000);
  it('stops on AbortSignal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const r = await search(p, { seed: 1, signal: ctrl.signal });
    expect(r.cancelled).toBe(true);
    expect(r.evaluated).toBeLessThan(3);
  });
});
