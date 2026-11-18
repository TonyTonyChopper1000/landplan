import { create } from 'zustand';
import { generate } from '@/engine/layout';
import { runChecks, tally, type Check, type Tally } from '@/engine/checks';
import { finance, type Finance } from '@/engine/finance';
import type { Layout, Params } from '@/engine/types';
import { useProject } from './project';

type Derived = {
  params: Params | null;
  layout: Layout | null;
  checks: Check[];
  tally: Tally;
  fin: Finance | null;
  ms: number;
  error: string | null;
};

export const useDerived = create<Derived>()(() => ({
  params: null,
  layout: null,
  checks: [],
  tally: { verified: 0, failing: 0, conflict: 0, notChecked: 0, total: 0 },
  fin: null,
  ms: 0,
  error: null,
}));

export function compute(params: Params): Omit<Derived, 'params'> {
  const t = performance.now();
  try {
    const layout = generate(params);
    const checks = runChecks(layout);
    return { layout, checks, tally: tally(checks), fin: finance(layout), ms: performance.now() - t, error: null };
  } catch (e) {
    return {
      layout: null,
      checks: [],
      tally: { verified: 0, failing: 0, conflict: 0, notChecked: 0, total: 0 },
      fin: null,
      ms: performance.now() - t,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Recompute derived state from params, debounced at 120 ms. Returns an unsubscribe function. */
export function startDeriving(): () => void {
  let timer = 0;
  const run = (p: Params) => useDerived.setState({ params: p, ...compute(p) });
  run(useProject.getState().params);
  const unsub = useProject.subscribe((s, prev) => {
    if (s.params === prev.params) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run(s.params), 120);
  });
  return () => {
    window.clearTimeout(timer);
    unsub();
  };
}

const cache = new WeakMap<Params, Omit<Derived, 'params'>>();
/** Memoised compute for side-by-side views (Compare). */
export function computeCached(p: Params): Omit<Derived, 'params'> {
  let v = cache.get(p);
  if (!v) {
    v = compute(p);
    cache.set(p, v);
  }
  return v;
}
