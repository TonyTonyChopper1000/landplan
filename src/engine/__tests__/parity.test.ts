import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultParams } from '../defaults';
import { optimize } from '../optimize';
import { PRESETS } from '../parcel';
import type { Params, PresetId } from '../types';
import { v1Optimize, type V1Input, type V1Result } from './v1reference';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

type Set = { name: string; apply: (p: Params) => Params };
const SETS: Set[] = [
  { name: 'v1-defaults', apply: (p) => p },
  {
    name: 'tight',
    apply: (p) => ({
      ...p,
      site: { ...p.site, acres: 9.5 },
      plots: { ...p.plots, depthFt: 50, blockLen: 120 },
      roads: { ...p.roads, frontage: 9, spine: 12 },
      open: { ...p.open, total: 12 },
      money: { ...p.money, mortPct: 15 },
    }),
  },
  {
    name: 'boundary-road',
    apply: (p) => ({
      ...p,
      site: { ...p.site, acres: 26 },
      plots: {
        ...p.plots,
        depthFt: 65,
        blockLen: 180,
        sizes: p.plots.sizes.map((s) => ({ ...s, on: s.sqyd !== 400, weight: s.sqyd === 120 ? 2 : s.weight })),
      },
      roads: { ...p.roads, frontage: 12.2, spine: 18, boundary: 6 },
      money: { ...p.money, mortPct: 25 },
    }),
  },
];

const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

function toV1(p: Params): V1Input {
  return {
    preset: PRESETS[p.site.preset],
    acres: p.site.acres,
    depthFt: p.plots.depthFt,
    blockLen: p.plots.blockLen,
    roadX: p.roads.spine,
    roadY: p.roads.frontage,
    periph: p.roads.boundary,
    openPct: p.open.total,
    mortPct: p.money.mortPct,
    sizes: p.plots.sizes,
  };
}

function summarize(r: V1Result) {
  return {
    grid: { theta: r.theta, blockLen: r6(r.blockLen), offX: r6(r.offX), offY: r6(r.offY) },
    plotted: r6(r.plotted),
    open: r6(r.open),
    count: r.plots.length,
    plots: r.plots.map((p) => [p.no, r6(p.area), r6(p.w), p.corner ? 1 : 0, p.irregular ? 1 : 0, p.mortgaged ? 1 : 0]),
  };
}

describe('engine parity with v1 (5 presets × 3 parameter sets)', () => {
  for (const preset of PRESET_IDS) {
    for (const set of SETS) {
      it(`${preset} / ${set.name}`, () => {
        const params = set.apply({ ...defaultParams(), site: { ...defaultParams().site, preset } });
        const file = join(FIX, `${preset}.${set.name}.json`);
        if (!existsSync(file)) {
          mkdirSync(FIX, { recursive: true });
          writeFileSync(file, JSON.stringify(summarize(v1Optimize(toV1(params)))) + '\n');
        }
        const fixture = JSON.parse(readFileSync(file, 'utf8'));
        const { best, layout } = optimize(params);
        const got = {
          grid: { theta: best.theta, blockLen: r6(best.blockLen), offX: r6(best.offX), offY: r6(best.offY) },
          plotted: r6(layout.plotted),
          open: r6(layout.openArea),
          count: layout.plots.length,
          plots: layout.plots.map((p) => [
            p.no,
            r6(p.area),
            r6(p.width),
            p.corner ? 1 : 0,
            p.irregular ? 1 : 0,
            p.mortgaged ? 1 : 0,
          ]),
        };
        expect(got.count).toBeGreaterThan(0);
        expect(got).toEqual(fixture);
      });
    }
  }
});
