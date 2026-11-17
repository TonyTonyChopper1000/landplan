import { regionArea } from './geometry';
import type { Prepared } from './layout';
import type { AreaLine, Layout } from './types';

/** Approach-road widening give-up: half the shortfall to master-plan width along the south-most edge. */
export function approachGiveUp(prep: Prepared): number {
  const s = prep.params.site;
  const short = Math.max(0, s.approachMP - s.approachExisting) / 2;
  if (!short) return 0;
  const p = prep.parcel;
  let best = 0;
  let bestY = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const my = (a.y + b.y) / 2;
    if (my < bestY) {
      bestY = my;
      best = Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return short * best;
}

/** Net layout area after master-plan road give-up and the declared road-affected strip. */
export function netLayoutArea(prep: Prepared): number {
  return Math.max(0, prep.gross - prep.params.site.roadAffected - approachGiveUp(prep));
}

export function areaStatement(
  layout: Layout,
  prep: Prepared,
  extra: { fragments: number; splayArea: number },
): void {
  const parity = prep.params.mode === 'parity' && !prep.robust;
  const sum = (use: string) => layout.open.filter((o) => o.use === use).reduce((s, o) => s + o.area, 0);
  if (parity) {
    const blockArea = layout.blocks.reduce((s, b) => s + b.area, 0);
    const lines: AreaLine[] = [
      { key: 'plots', label: 'Plots', m2: layout.plotted },
      { key: 'park', label: 'Open space', m2: layout.openArea },
      { key: 'roads', label: 'Roads (v1: gross − blocks)', m2: layout.gross - blockArea },
      { key: 'slivers', label: 'Residual in blocks', m2: blockArea - layout.plotted - layout.openArea },
    ];
    layout.areaLines = lines;
    layout.netLayout = layout.gross;
    return;
  }
  const insetA = regionArea(prep.inset);
  const devA = regionArea(prep.developable);
  const park = sum('park');
  const util = sum('util');
  const social = sum('social');
  const lines: AreaLine[] = [
    { key: 'plots', label: 'Plots', m2: layout.plotted },
    { key: 'roads', label: 'Internal roads', m2: devA - extra.fragments },
    { key: 'splays', label: 'Junction splays', m2: extra.splayArea },
    { key: 'boundary', label: 'Boundary road', m2: layout.gross - insetA },
    { key: 'park', label: 'Parks / green', m2: park },
    { key: 'util', label: 'Utilities', m2: util },
    { key: 'social', label: 'Social infrastructure', m2: social },
    { key: 'buffers', label: 'Statutory buffers', m2: insetA - devA },
    {
      key: 'slivers',
      label: 'Unusable slivers',
      m2: Math.max(0, extra.fragments - extra.splayArea - layout.plotted - park - util - social),
    },
  ];
  layout.areaLines = lines;
  layout.netLayout = netLayoutArea(prep);
}

export function line(layout: Layout, key: string): number {
  return layout.areaLines.find((l) => l.key === key)?.m2 ?? 0;
}

/** Roads share for KPIs: everything road-like. */
export function roadsTotal(layout: Layout): number {
  return ['roads', 'splays', 'boundary'].reduce((s, k) => s + line(layout, k), 0);
}
