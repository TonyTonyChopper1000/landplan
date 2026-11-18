import { useDerived } from '@/state/derived';
import { useProject } from '@/state/project';
import { toast } from '@/state/ui';
import { plotPrice } from '@/engine/finance';
import { SQYD } from '@/engine/geometry';
import type { Layout, Params } from '@/engine/types';
import { localToLonLat } from '@/lib/geo';
import { statusOf } from '@/features/studio/Inspector';
import { drawingSheet, planSvg } from './planSvg';
import { toDxf } from './dxf';

export type ExportKind = 'pdf' | 'svg' | 'dxf' | 'xlsx' | 'csv' | 'geojson';
const DISCLAIMER = 'Yield study only - not a submission drawing.';

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const slug = (p: Params) => (p.site.projectName || 'layout').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layout';

export function scheduleRows(layout: Layout) {
  const p = layout.params;
  return layout.plots.map((pl) => ({
    no: pl.no,
    size: pl.sizeSqYd,
    m2: Math.round(pl.area * 100) / 100,
    sqyd: Math.round((pl.area / SQYD) * 100) / 100,
    width: Math.round(pl.width * 100) / 100,
    depth: Math.round(pl.depth * 100) / 100,
    facing: pl.facing,
    corner: pl.corner ? 'Y' : '',
    irregular: pl.irregular ? 'Y' : '',
    mortgaged: pl.mortgaged ? 'Y' : '',
    status: statusOf(pl, p.inventory),
    multiplier: Math.round(pl.multiplier * 1000) / 1000,
    price: Math.round(plotPrice(pl, p)),
  }));
}

export function toCsv(layout: Layout): string {
  const rows = scheduleRows(layout);
  const head = ['Plot', 'Nominal sq yd', 'Area m2', 'Area sq yd', 'Width m', 'Depth m', 'Facing', 'Corner', 'Irregular', 'Mortgaged', 'Status', 'Multiplier', 'Price INR'];
  return [`# ${DISCLAIMER}`, head.join(','), ...rows.map((r) => Object.values(r).join(','))].join('\n');
}

export function toGeoJson(layout: Layout): string {
  const a = layout.params.site.anchor;
  const ring = (r: { x: number; y: number }[]) => {
    const c = r.map((q) => localToLonLat(q, a));
    return [...c, c[0]];
  };
  const features = [
    { type: 'Feature', properties: { kind: 'parcel', name: layout.params.site.projectName, note: DISCLAIMER }, geometry: { type: 'Polygon', coordinates: [ring(layout.parcel)] } },
    ...layout.plots.map((p) => ({ type: 'Feature', properties: { kind: 'plot', no: p.no, area_m2: +p.area.toFixed(2), facing: p.facing, corner: p.corner, mortgaged: p.mortgaged }, geometry: { type: 'Polygon', coordinates: p.region.map(ring) } })),
    ...layout.open.map((o) => ({ type: 'Feature', properties: { kind: o.use, id: o.id, area_m2: +o.area.toFixed(2) }, geometry: { type: 'Polygon', coordinates: o.region.map(ring) } })),
    ...layout.buffers.map((b) => ({ type: 'Feature', properties: { kind: 'buffer', rule: b.rule, label: b.label }, geometry: { type: 'Polygon', coordinates: b.region.map(ring) } })),
    ...layout.roadRuns.map((r) => ({ type: 'Feature', properties: { kind: 'road', id: r.id, axis: r.axis, width_m: r.width, length_m: +r.length.toFixed(1) }, geometry: { type: 'LineString', coordinates: [localToLonLat(r.a, a), localToLonLat(r.b, a)] } })),
  ];
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 1);
}

async function toXlsx(layout: Layout, name: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const rows = scheduleRows(layout);
  const bold = (v: string) => ({ value: v, fontWeight: 'bold' as const });
  const head = ['Plot', 'Nominal sq yd', 'Area m²', 'Area sq yd', 'Width m', 'Depth m', 'Facing', 'Corner', 'Irregular', 'Mortgaged', 'Status', 'Multiplier', 'Price ₹'].map(bold);
  const schedule = [[{ value: DISCLAIMER, fontWeight: 'bold' as const }], head, ...rows.map((r) => Object.values(r).map((v) => ({ value: v })))];
  const area = [[{ value: DISCLAIMER, fontWeight: 'bold' as const }], ['Use', 'm²', '% gross'].map(bold), ...layout.areaLines.map((l) => [{ value: l.label }, { value: Math.round(l.m2 * 100) / 100 }, { value: Math.round((l.m2 / layout.gross) * 10000) / 100 }]), [{ value: 'Gross' }, { value: Math.round(layout.gross * 100) / 100 }, { value: 100 }]];
  const blob = await writeXlsxFile([
    { sheet: 'Schedule', data: schedule, columns: [{ width: 7 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 8 }, { width: 8 }, { width: 9 }, { width: 10 }, { width: 11 }, { width: 10 }, { width: 14 }], stickyRowsCount: 2 },
    { sheet: 'Area statement', data: area, columns: [{ width: 28 }, { width: 14 }, { width: 10 }] },
  ]).toBlob();
  save(blob, name);
}

async function toPdf(layout: Layout, name: string) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:420mm;height:297mm';
  holder.innerHTML = drawingSheet(layout);
  document.body.appendChild(holder);
  try {
    await svg2pdf(holder.querySelector('svg')!, doc, { x: 0, y: 0, width: 420, height: 297 });
  } finally {
    holder.remove();
  }
  const { checks, tally, fin } = useDerived.getState();
  doc.addPage('a4', 'portrait');
  let y = 18;
  const line = (t: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(t, 15, y);
    y += size * 0.5 + 1.5;
    if (y > 280) {
      footer();
      doc.addPage('a4', 'portrait');
      y = 18;
    }
  };
  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(196, 80, 10);
    doc.text(DISCLAIMER + ' Rules change by GO - verify each rule against the current text.', 15, 290);
    doc.setTextColor(27, 30, 34);
  };
  const p = layout.params;
  line(`${p.site.projectName} - feasibility report`, 16, true);
  line(`${new Date().toISOString().slice(0, 10)} · ${p.site.authority} · rev ${p.site.revision} · ${p.mode === 'rules' ? 'rule-aware' : 'v1 parity'} engine`, 9);
  y += 3;
  line('Area statement', 12, true);
  for (const l of layout.areaLines) line(`${l.label.padEnd(30, ' ')}  ${Math.round(l.m2).toLocaleString('en-IN')} m2  (${((l.m2 / layout.gross) * 100).toFixed(2)}%)`, 9);
  y += 3;
  line(`Compliance: ${tally.verified} verified · ${tally.failing} failing · ${tally.conflict} conflict · ${tally.notChecked} not checked`, 12, true);
  for (const c of checks) line(`[${c.status.toUpperCase()}] ${c.title} (${c.ruleIds.join(', ')}) - ${c.actual} / ${c.required}`, 8.5);
  if (fin) {
    y += 3;
    line('Financials', 12, true);
    const cr = (n: number) => `Rs ${(n / 1e7).toFixed(2)} Cr`;
    line(`Revenue ${cr(fin.revenue)} · Cost ${cr(fin.totalCost)} · Profit ${cr(fin.profit)} · Margin ${fin.marginPct.toFixed(1)}%`, 9);
    line(`NPV ${cr(fin.npv)} · IRR ${fin.irr === null ? 'n/a' : fin.irr.toFixed(1) + '%'} · Peak funding ${cr(fin.peakFunding)}`, 9);
  }
  y += 3;
  line('Plot schedule', 12, true);
  for (const r of scheduleRows(layout)) line(`${String(r.no).padStart(4)}  ${String(r.sqyd).padStart(8)} sq yd  ${r.width.toFixed(2)} x ${r.depth.toFixed(2)} m  ${r.facing.padEnd(2)} ${r.corner ? 'corner ' : ''}${r.mortgaged ? 'mortgaged ' : ''}Rs ${r.price.toLocaleString('en-IN')}`, 8);
  footer();
  doc.save(name);
}

export async function runExport(kind: ExportKind, layoutArg?: Layout): Promise<void> {
  const layout = layoutArg ?? useDerived.getState().layout;
  if (!layout) return;
  const base = slug(useProject.getState().params);
  try {
    if (kind === 'svg') save(new Blob([planSvg(layout)], { type: 'image/svg+xml' }), `${base}-plan.svg`);
    else if (kind === 'dxf') save(new Blob([toDxf(layout)], { type: 'application/dxf' }), `${base}-plan.dxf`);
    else if (kind === 'csv') save(new Blob([toCsv(layout)], { type: 'text/csv' }), `${base}-schedule.csv`);
    else if (kind === 'geojson') save(new Blob([toGeoJson(layout)], { type: 'application/geo+json' }), `${base}.geojson`);
    else if (kind === 'xlsx') await toXlsx(layout, `${base}-schedule.xlsx`);
    else if (kind === 'pdf') await toPdf(layout, `${base}-report.pdf`);
    toast(`Exported ${kind.toUpperCase()}`);
  } catch (e) {
    toast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
