// Versioned output contract (LayoutResult). Local metres by default, or WGS84 on request.
import type { Check } from './checks';
import { finance, plotPrice, tornado } from './finance';
import { FT, SQYD, type Pt, type Region } from './geometry';
import { mortgagedArea, plotRanges } from './mortgage';
import { fromLocal, toUtm, type Crs } from './site';
import type { Layout } from './types';

export const ENGINE_VERSION = '2.0.0';

type Feature = { type: 'Feature'; id: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };

export type ResultOptions = {
  mode: 'v1' | 'v2';
  seed: number;
  inputHash: string;
  output?: 'local' | 'wgs84';
  crs?: Crs | null;
  timings?: Record<string, number>;
  warnings?: string[];
};

export function crsForAnchor(anchor: { lat: number; lon: number }): Crs {
  const [o] = toUtm([[anchor.lon, anchor.lat]]);
  return { local: 'EPSG:32644', origin: [o.x, o.y] };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function featureIdsOf(c: Check): string[] {
  const h = c.highlight ?? {};
  return [
    ...(h.plots ?? []).map((n) => `plot-${n}`),
    ...(h.open ?? []),
    ...(h.runs ?? []).map((r) => `road-${r}`),
    ...(h.buffers ?? []).map((b) => `buffer-${b}`),
  ];
}

export function toLayoutResult(layout: Layout, o: ResultOptions) {
  const crs = o.crs ?? crsForAnchor(layout.params.site.anchor);
  const wgs = o.output === 'wgs84';
  const pt = (q: Pt) => (wgs ? fromLocal(q, crs).map((v) => Math.round(v * 1e8) / 1e8) : [r3(q.x), r3(q.y)]);
  const ring = (r: Pt[]) => {
    const c = r.map(pt);
    return [...c, c[0]];
  };
  const poly = (reg: Region) => (reg.length === 1 ? { type: 'Polygon', coordinates: [ring(reg[0])] } : { type: 'MultiPolygon', coordinates: reg.map((r) => [ring(r)]) });
  const f = (id: string, kind: string, geometry: Feature['geometry'], props: Record<string, unknown> = {}): Feature => ({ type: 'Feature', id, properties: { kind, ...props }, geometry });
  const p = layout.params;
  const features: Feature[] = [f('parcel', 'parcel', poly([layout.parcel]), { areaM2: r3(layout.gross) })];
  for (const r of layout.roadRuns)
    features.push(f(`road-${r.id}`, 'road', { type: 'LineString', coordinates: [pt(r.a), pt(r.b)] }, { axis: r.axis, widthM: r.width, lengthM: r3(r.length), requiredM: r.requiredRow }));
  if (layout.splays.length) features.push(f('splays', 'splay', poly(layout.splays)));
  if (layout.mpStrip.length) features.push(f('mp-road', 'mpRoad', poly(layout.mpStrip)));
  for (const b of layout.blocks) features.push(f(`block-${b.id}`, 'block', poly(b.region), { use: b.use, areaM2: r3(b.area) }));
  for (const b of layout.buffers) features.push(f(`buffer-${b.id}`, 'buffer', poly(b.region), { rule: b.rule, label: b.label, areaM2: r3(b.area) }));
  for (const op of layout.open) features.push(f(op.id, op.use === 'park' ? 'open' : op.use === 'util' ? 'utility' : 'si', poly(op.region), { areaM2: r3(op.area) }));
  for (const pl of layout.plots)
    features.push(
      f(`plot-${pl.no}`, 'plot', poly(pl.region), {
        no: pl.no,
        nominalSqyd: pl.sizeSqYd,
        areaM2: r3(pl.area),
        sqyd: r3(pl.area / SQYD),
        sqft: r3(pl.area / (FT * FT)),
        dimsFt: [Math.round((pl.width / FT) * 10) / 10, Math.round((pl.depth / FT) * 10) / 10],
        facing: pl.facing,
        corner: pl.corner,
        irregular: pl.irregular,
        mortgaged: pl.mortgaged,
        price: Math.round(plotPrice(pl, p)),
      }),
    );
  const fin = finance(layout);
  const tor = tornado(layout);
  return {
    engineVersion: ENGINE_VERSION,
    mode: o.mode,
    seed: o.seed,
    inputHash: o.inputHash,
    units: 'm' as const,
    crs: { local: crs.local, origin: crs.origin, output: wgs ? ('wgs84' as const) : ('local' as const) },
    features: { type: 'FeatureCollection' as const, features },
    areaStatement: layout.areaLines.map((l) => ({ kind: l.key, label: l.label, areaM2: r3(l.m2), pct: Math.round((l.m2 / layout.gross) * 10000) / 100 })),
    roadRuns: layout.roadRuns.map((r) => ({ id: r.id, axis: r.axis, lengthM: r3(r.length), widthM: r.width, requiredM: r.requiredRow, splayM: r.splay, ok: r.requiredRow === null || r.width + 0.01 >= r.requiredRow })),
    kpis: {
      plots: layout.plots.length,
      saleablePct: Math.round((layout.plotted / layout.gross) * 10000) / 100,
      avgPlotSqyd: layout.plots.length ? r3(layout.plotted / layout.plots.length / SQYD) : 0,
      revenue: Math.round(fin.revenue),
      sellableNow: Math.round(fin.sellableNow),
      mortgagedValue: Math.round(fin.mortgagedValue),
      devCost: Math.round(fin.devCost),
      marginPct: Math.round(fin.marginPct * 100) / 100,
      irr: fin.irr === null ? null : Math.round(fin.irr * 100) / 100,
      npv: Math.round(fin.npv),
      mortgagedAreaM2: r3(mortgagedArea(layout.plots)),
      mortgagedRanges: plotRanges(layout.plots.filter((x) => x.mortgaged).map((x) => x.no)),
    },
    finance: { cashflow: fin.months, tornado: tor.bars, npvBase: tor.base, peakFunding: fin.peakFunding },
    diagnostics: { stageTimingsMs: o.timings ?? {}, widthIterations: 1, solverGap: null, warnings: o.warnings ?? [] },
  };
}

export function checksOut(checks: Check[]) {
  return checks.map((c) => ({
    id: c.id,
    ruleId: c.ruleIds[0] ?? '',
    ruleIds: c.ruleIds,
    status: c.status === 'not-checked' ? ('unknown' as const) : c.status,
    measured: c.actual,
    required: c.required,
    featureIds: featureIdsOf(c),
    message: c.note ?? c.title,
    title: c.title,
    verify: !!c.verify,
  }));
}
