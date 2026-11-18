// Minimal ASCII DXF (R12-style) writer: LWPOLYLINE-free POLYLINE entities on named layers, metres.
import type { Layout } from '../../engine/types';
import type { Poly } from '../../engine/geometry';

function poly(layer: string, p: Poly, closed = true): string {
  const out = ['0', 'POLYLINE', '8', layer, '66', '1', '70', closed ? '1' : '0'];
  for (const q of p) out.push('0', 'VERTEX', '8', layer, '10', q.x.toFixed(4), '20', q.y.toFixed(4), '30', '0');
  out.push('0', 'SEQEND', '8', layer);
  return out.join('\n');
}
function text(layer: string, x: number, y: number, h: number, s: string): string {
  return ['0', 'TEXT', '8', layer, '10', x.toFixed(3), '20', y.toFixed(3), '30', '0', '40', h.toFixed(2), '1', s, '72', '1', '11', x.toFixed(3), '21', y.toFixed(3), '31', '0'].join('\n');
}

export function toDxf(layout: Layout): string {
  const layers = ['PARCEL', 'BOUNDARY_ROAD', 'PLOTS', 'PLOT_NOS', 'OPEN_SPACE', 'UTILITIES', 'SOCIAL_INFRA', 'ROAD_CL', 'BUFFERS', 'SPLAYS', 'NOTES'];
  const ent: string[] = [];
  ent.push(poly('PARCEL', layout.parcel));
  if (layout.params.roads.boundary > 0) for (const r of layout.inset) ent.push(poly('BOUNDARY_ROAD', r));
  for (const p of layout.plots) {
    for (const r of p.region) ent.push(poly('PLOTS', r));
    ent.push(text('PLOT_NOS', p.centroid.x, p.centroid.y, 1.2, String(p.no)));
  }
  for (const o of layout.open) for (const r of o.region) ent.push(poly(o.use === 'park' ? 'OPEN_SPACE' : o.use === 'util' ? 'UTILITIES' : 'SOCIAL_INFRA', r));
  for (const r of layout.roadRuns) ent.push(poly('ROAD_CL', [r.a, r.b], false));
  for (const b of layout.buffers) for (const r of b.region) ent.push(poly('BUFFERS', r));
  for (const r of layout.splays) ent.push(poly('SPLAYS', r));
  const b0 = layout.parcel.reduce((a, q) => ({ x: Math.min(a.x, q.x), y: Math.min(a.y, q.y) }), { x: Infinity, y: Infinity });
  ent.push(text('NOTES', b0.x, b0.y - 8, 3, 'YIELD STUDY ONLY - NOT A SUBMISSION DRAWING'));
  const table = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(layers.length)];
  layers.forEach((l, i) => table.push('0', 'LAYER', '2', l, '70', '0', '62', String((i % 7) + 1), '6', 'CONTINUOUS'));
  table.push('0', 'ENDTAB', '0', 'ENDSEC');
  return [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC',
    ...table,
    '0', 'SECTION', '2', 'ENTITIES', ent.join('\n'), '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}
