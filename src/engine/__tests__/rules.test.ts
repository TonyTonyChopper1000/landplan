import { describe, expect, it } from 'vitest';
import { applyGo105, defaultParams } from '../defaults';
import { generate } from '../layout';
import { optimize } from '../optimize';
import { runChecks, tally } from '../checks';
import { bandFor } from '../roads';
import { finance, tornado } from '../finance';
import { RULES, CONFLICT_GROUPS } from '../../rules/regulations';
import { circle } from '../clip';
import { HECTARE, regionArea } from '../geometry';
import type { Params } from '../types';

const sumLines = (l: { m2: number; key: string }[]) => l.reduce((s, x) => s + x.m2, 0);

describe('road table bands', () => {
  it('fixes the v1 1000 m boundary', () => {
    expect(bandFor(600).row).toBe(12);
    expect(bandFor(600.01).row).toBe(18);
    expect(bandFor(1000).row).toBe(18);
    expect(bandFor(1000.01).row).toBe(24);
  });
});

describe('rules seed data', () => {
  it('encodes every seed rule with source and status', () => {
    expect(RULES.length).toBe(30);
    for (const r of RULES) {
      expect(r.sourceUrl).toMatch(/^https:\/\//);
      expect(r.lastVerified).toBe('2026-11-17');
    }
    expect(Object.keys(CONFLICT_GROUPS)).toEqual(['mortgage', 'os-split', 'hmda-frontage']);
  });
});

describe('determinism', () => {
  it('same inputs give the same layout', () => {
    const p = applyGo105(defaultParams());
    const a = generate(p);
    const b = generate(p);
    expect(a.plots.map((x) => [x.no, x.area])).toEqual(b.plots.map((x) => [x.no, x.area]));
  });
});

describe('GO 105 standards preset', () => {
  it('turns on splays, 9/1 split, 50 m²/6 m minimum and 15% mortgage', () => {
    const p = applyGo105(defaultParams());
    expect(p.roads.splays).toBe(true);
    expect([p.open.park, p.open.util]).toEqual([9, 1]);
    expect([p.plots.minPlotM2, p.plots.minWidth]).toEqual([50, 6]);
    expect(p.money.mortPct).toBe(15);
    const before = runChecks(generate(defaultParams()));
    const after = runChecks(generate(p));
    const st = (cs: typeof before, id: string) => cs.find((c) => c.id === id)?.status;
    expect(st(before, 'chk-splays')).toBe('fail');
    expect(st(after, 'chk-splays')).toBe('pass');
    expect(st(before, 'chk-mortgage')).toBe('conflict');
    expect(st(after, 'chk-mortgage')).toBe('pass');
    expect(st(after, 'chk-os-split')).toBe('pass');
    const lay = generate(p);
    expect(lay.open.some((o) => o.use === 'util')).toBe(true);
    expect(lay.plots.every((x) => x.width >= 6)).toBe(true);
  });

  it('area statement lines sum to gross in both modes', () => {
    for (const p of [defaultParams(), applyGo105(defaultParams())]) {
      const l = generate(p);
      expect(sumLines(l.areaLines)).toBeCloseTo(l.gross, 0);
    }
  });
});

describe('constraints', () => {
  it('a lake ≥10 ha creates a 30 m buffer that removes plots', () => {
    const base = applyGo105(defaultParams());
    const lake = circle({ x: 0, y: 0 }, Math.sqrt((12 * HECTARE) / Math.PI) * 0.35, 40);
    const p: Params = { ...base, constraints: [{ id: 'L1', kind: 'lake', pts: lake, lakeHa: 12 }] };
    const a = generate(base);
    const b = generate(p);
    expect(b.buffers[0].label).toContain('30 m');
    expect(b.plots.length).toBeLessThan(a.plots.length);
    expect(b.areaLines.find((x) => x.key === 'buffers')!.m2).toBeGreaterThan(1000);
    for (const pl of b.plots) expect(regionArea(pl.region)).toBeGreaterThan(0);
    const chk = runChecks(b).find((c) => c.id === 'chk-buffer-lake');
    expect(chk?.status).toBe('pass');
    expect(sumLines(b.areaLines)).toBeCloseTo(b.gross, 0);
  });

  it('a small lake uses the 9 m buffer', () => {
    const base = applyGo105(defaultParams());
    const p: Params = { ...base, constraints: [{ id: 'L2', kind: 'lake', pts: circle({ x: 0, y: 0 }, 30, 24) }] };
    expect(generate(p).buffers[0].label).toContain('9 m');
  });
});

describe('conflict resolution', () => {
  it('choosing a mortgage rule changes the check', () => {
    const p = defaultParams();
    const at = '2026-11-17';
    const p15 = { ...p, ruleChoices: { mortgage: { ruleId: 'MG-15', note: '', at } } };
    const p25 = { ...p, money: { ...p.money, mortPct: 10 }, ruleChoices: { mortgage: { ruleId: 'MG-25', note: '', at } } };
    expect(runChecks(generate(p15)).find((c) => c.id === 'chk-mortgage')?.status).toBe('pass');
    expect(runChecks(generate(p25)).find((c) => c.id === 'chk-mortgage')?.status).toBe('fail');
  });
  it('overrides mark checks overridden', () => {
    const p = { ...defaultParams(), overrides: { 'RD-TABLE': { value: '9 m', reason: 'LRS case' } } };
    expect(runChecks(generate(p)).find((c) => c.id === 'chk-road-row')?.status).toBe('overridden');
  });
});

describe('finance', () => {
  it('produces cash flow, NPV, IRR and tornado', () => {
    const d = defaultParams();
    const l = generate({ ...d, money: { ...d.money, landCost: 15000000 } });
    const f = finance(l);
    expect(f.revenue).toBeGreaterThan(0);
    expect(f.months.length).toBeGreaterThan(12);
    expect(f.peakFunding).toBeGreaterThan(0);
    expect(f.irr).not.toBeNull();
    expect(tornado(l).bars).toHaveLength(4);
  });
});

describe('performance', () => {
  it('regenerates 17 acres quickly', () => {
    const p = applyGo105(defaultParams());
    generate(p);
    const t = performance.now();
    for (let i = 0; i < 5; i++) generate(p);
    expect((performance.now() - t) / 5).toBeLessThan(80);
  });
  it('rule-aware optimizer finishes under 2 s', () => {
    const t = performance.now();
    optimize(applyGo105(defaultParams()));
    expect(performance.now() - t).toBeLessThan(4000);
  });
  it('tally covers every check', () => {
    const cs = runChecks(generate(defaultParams()));
    const t = tally(cs);
    expect(t.verified + t.failing + t.conflict + t.notChecked).toBe(cs.length);
  });
});
