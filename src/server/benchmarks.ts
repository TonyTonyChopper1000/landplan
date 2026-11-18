// Benchmark harness: run the engine on recorded approved layouts and report land-use share errors.
import bench from '../../benchmarks/hmda-000091-2020.json';
import { ACRE } from '../engine/geometry';
import { roadsTotal, line } from '../engine/areas';
import { generate } from '../engine/layout';
import { optimize } from '../engine/optimize';
import { centre } from '../engine/parcel';
import { paramsFor } from './engine';

type Bench = typeof bench;
const SETS: Bench[] = [bench];

export async function runBenchmarks() {
  const out = SETS.map((b) => {
    const base = paramsFor({ ...b.params, site: { ...b.params.site, acres: b.netSiteM2 / ACRE } }, 'v2');
    const params = b.boundary
      ? { ...base, site: { ...base.site, source: 'import' as const, polygon: centre(b.boundary as { x: number; y: number }[]) } }
      : base;
    const best = optimize(params).best;
    const layout = generate({ ...params, grid: { theta: best.theta, blockLenFactor: best.blFactor, offX: best.offX, offY: best.offY } });
    const g = layout.gross;
    const got = { plotted: layout.plotted / g, roads: roadsTotal(layout) / g, park: line(layout, 'park') / g, socialInfra: line(layout, 'social') / g };
    const rec = { plotted: b.record.plottedM2 / b.netSiteM2, roads: b.record.roadsM2 / b.netSiteM2, park: b.record.parkM2 / b.netSiteM2, socialInfra: b.record.socialInfraM2 / b.netSiteM2 };
    const err = Object.fromEntries(Object.keys(rec).map((k) => [k, Math.round(((got as Record<string, number>)[k] - (rec as Record<string, number>)[k]) * 10000) / 100]));
    const meanAbs = Object.values(err).reduce((s, v) => s + Math.abs(v), 0) / Object.keys(err).length;
    return { id: b.id, approximateBoundary: !b.boundary, plots: layout.plots.length, sharesPct: Object.fromEntries(Object.entries(got).map(([k, v]) => [k, Math.round(v * 10000) / 100])), recordPct: Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, Math.round(v * 10000) / 100])), errorPctPoints: err, meanAbsErrorPctPoints: Math.round(meanAbs * 100) / 100 };
  });
  return { benchmarks: out, meanAbsErrorPctPoints: Math.round((out.reduce((s, b) => s + b.meanAbsErrorPctPoints, 0) / out.length) * 100) / 100 };
}
