import { planSvg } from '../features/reports/planSvg';
import { toDxf } from '../features/reports/dxf';
import { plotPrice } from '../engine/finance';
import { SQYD } from '../engine/geometry';
import { toLayoutResult } from '../engine/result';
import type { Layout } from '../engine/types';
import type { Res } from './http';

const DISCLAIMER = 'Yield study only - not a submission drawing.';

export function exportFile(format: 'svg' | 'dxf' | 'geojson' | 'csv', layout: Layout): Res {
  const name = (layout.params.site.projectName || 'layout').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layout';
  const disp = (ext: string) => ({ 'content-disposition': `attachment; filename="${name}.${ext}"` });
  if (format === 'svg') return { status: 200, text: planSvg(layout), contentType: 'image/svg+xml', headers: disp('svg') };
  if (format === 'dxf') return { status: 200, text: toDxf(layout), contentType: 'application/dxf', headers: disp('dxf') };
  if (format === 'geojson') {
    const r = toLayoutResult(layout, { mode: layout.params.mode === 'parity' ? 'v1' : 'v2', seed: 1, inputHash: '', output: 'wgs84' });
    return { status: 200, text: JSON.stringify({ ...r.features, properties: { note: DISCLAIMER } }), contentType: 'application/geo+json', headers: disp('geojson') };
  }
  const rows = layout.plots.map((p) =>
    [p.no, p.sizeSqYd, p.area.toFixed(2), (p.area / SQYD).toFixed(2), p.width.toFixed(2), p.depth.toFixed(2), p.facing, p.corner ? 'Y' : '', p.irregular ? 'Y' : '', p.mortgaged ? 'Y' : '', Math.round(plotPrice(p, layout.params))].join(','),
  );
  const csv = [`# ${DISCLAIMER}`, 'Plot,Nominal sq yd,Area m2,Area sq yd,Width m,Depth m,Facing,Corner,Irregular,Mortgaged,Price INR', ...rows].join('\n');
  return { status: 200, text: csv, contentType: 'text/csv', headers: disp('csv') };
}
