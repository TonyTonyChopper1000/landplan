import * as Comlink from 'comlink';
import { create } from 'zustand';
import type { Candidate } from '@/engine/optimize';
import type { OptimizerApi } from '@/engine/worker';
import { useProject } from './project';
import { useUi } from './ui';
import { useDerived } from './derived';
import { ACRE } from '@/engine/geometry';
import { apiAvailable, optimizeOnServer } from '@/lib/api';

type OptState = {
  running: boolean;
  done: number;
  total: number;
  results: Candidate[];
  best: Candidate | null;
  ms: number;
  error: string | null;
  where: 'worker' | 'server';
};

export const useOptimizer = create<OptState>()(() => ({
  running: false,
  done: 0,
  total: 486,
  results: [],
  best: null,
  ms: 0,
  error: null,
  where: 'worker',
}));

export const SERVER_THRESHOLD_ACRES = 60;
let serverCtrl: AbortController | null = null;

async function runOnServer(params: Parameters<typeof optimizeOnServer>[0], t0: number): Promise<boolean> {
  serverCtrl = new AbortController();
  useOptimizer.setState({ where: 'server', total: params.mode === 'parity' ? 486 : 1500 });
  try {
    const top = await optimizeOnServer(params, (evaluated) => useOptimizer.setState({ done: evaluated, ms: performance.now() - t0 }), serverCtrl.signal);
    const g = top[0].params.grid;
    useProject.getState().update((p) => ({ ...p, grid: g, plots: { ...p.plots, packing: top[0].params.plots.packing } }));
    useUi.setState((s) => ({ genKey: s.genKey + 1 }));
    useOptimizer.setState({ running: false, done: useOptimizer.getState().total, ms: performance.now() - t0 });
    return true;
  } catch (e) {
    if (serverCtrl?.signal.aborted) return true;
    useOptimizer.setState({ error: `Server unavailable (${e instanceof Error ? e.message : e}); using the browser worker.`, where: 'worker' });
    return false;
  } finally {
    serverCtrl = null;
  }
}

let worker: Worker | null = null;

export function applyCandidate(c: Pick<Candidate, 'theta' | 'blFactor' | 'offX' | 'offY'>): void {
  useProject.getState().update((p) => ({
    ...p,
    grid: { theta: c.theta, blockLenFactor: c.blFactor, offX: c.offX, offY: c.offY },
  }));
  useUi.setState((s) => ({ genKey: s.genKey + 1 }));
}

export async function startOptimizer(): Promise<void> {
  cancelOptimizer();
  const params = useProject.getState().params;
  useOptimizer.setState({ running: true, done: 0, total: 486, results: [], best: null, error: null, ms: 0, where: 'worker' });
  useUi.setState({ drawer: 'optimizer' });
  const t0 = performance.now();
  const gross = useDerived.getState().layout?.gross ?? 0;
  if (gross / ACRE > SERVER_THRESHOLD_ACRES && (await apiAvailable()) && (await runOnServer(params, t0))) return;
  worker = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });
  const api = Comlink.wrap<OptimizerApi>(worker);
  try {
    const best = await api.run(
      params,
      Comlink.proxy((batch: Candidate[], done: number, total: number) => {
        useOptimizer.setState((s) => {
          const results = [...s.results, ...batch];
          let b = s.best;
          for (const c of batch) if (!b || c.plotted > b.plotted + 1e-9) b = c;
          return { results, done, total, best: b, ms: performance.now() - t0 };
        });
      }),
    );
    useOptimizer.setState({ running: false, best, ms: performance.now() - t0 });
    applyCandidate(best);
  } catch (e) {
    if (useOptimizer.getState().running) useOptimizer.setState({ running: false, error: String(e) });
  } finally {
    worker?.terminate();
    worker = null;
  }
}

export function cancelOptimizer(): void {
  serverCtrl?.abort();
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (useOptimizer.getState().running) useOptimizer.setState({ running: false });
}
