// Optimizer Web Worker (Comlink). Streams each candidate result; cancel by terminating the worker.
import * as Comlink from 'comlink';
import { candidates, toGrid, type Candidate } from './optimize';
import { generate, prepare } from './layout';
import { finance } from './finance';
import { runChecks, tally } from './checks';
import type { Params } from './types';

const api = {
  async run(params: Params, onBatch: (batch: Candidate[], done: number, total: number) => void): Promise<Candidate> {
    const prep = prepare(params);
    const list = candidates(params);
    let best: Candidate | null = null;
    let batch: Candidate[] = [];
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const layout = generate(params, toGrid(c), prep);
      const res: Candidate = {
        ...c,
        plotted: layout.plotted,
        plots: layout.plots.length,
        margin: finance(layout).marginPct,
        failing: tally(runChecks(layout)).failing,
      };
      if (!best || res.plotted > best.plotted + 1e-9) best = res;
      batch.push(res);
      // Stream one θ row at a time (27 layouts). Cancel terminates the worker, so no yielding is needed.
      if (batch.length >= 27 || i === list.length - 1) {
        void onBatch(batch, i + 1, list.length);
        batch = [];
      }
    }
    if (!best) throw new Error('No candidates');
    return best;
  },
};

export type OptimizerApi = typeof api;
Comlink.expose(api);
