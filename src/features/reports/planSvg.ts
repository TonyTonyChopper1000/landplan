// Pure SVG string for exports (paper styling regardless of UI theme).
import { bbox, regionToPath, polyToPath } from '../../engine/geometry';
import type { Layout, Plot } from '../../engine/types';
import { ACRE } from '../../engine/geometry';
import { PROFILES } from '../../rules/profiles';

const INK = '#1B1E22';
const LINE = '#2D6E7E';
const BAND = (p: Plot) => (p.irregular ? '#9AA0A8' : p.sizeSqYd <= 200 ? '#C9A227' : p.sizeSqYd <= 300 ? '#3FC1D9' : p.sizeSqYd <= 450 ? '#8C6FD6' : '#FF6B1A');
const OPEN: Record<string, string> = { park: '#CFE0C9', util: '#E6D6B0', social: '#DDD2EC' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** The plan drawn in world metres (y flipped). */
export function planGroup(layout: Layout, numbers = true): string {
  const parts: string[] = [];
  parts.push(`<path d="${polyToPath(layout.parcel)}" fill="#E9E4D8" stroke="${LINE}" stroke-width="0.6"/>`);
  for (const b of layout.buffers) parts.push(`<path d="${regionToPath(b.region)}" fill="url(#hb)" stroke="${LINE}" stroke-width="0.25" stroke-dasharray="1.5 1.5"/>`);
  for (const c of layout.params.constraints) {
    if (c.kind === 'lake' && c.pts.length > 2) parts.push(`<path d="${polyToPath(c.pts)}" fill="#9CC7D3" stroke="${LINE}" stroke-width="0.4"/>`);
    else if (c.pts.length > 1) parts.push(`<polyline points="${c.pts.map((q) => `${q.x},${-q.y}`).join(' ')}" fill="none" stroke="${LINE}" stroke-width="0.6"/>`);
  }
  for (const o of layout.open) parts.push(`<path d="${regionToPath(o.region)}" fill="${OPEN[o.use]}" stroke="#2A7A4F" stroke-width="0.3" fill-rule="evenodd"/>`);
  for (const r of layout.roadRuns) parts.push(`<line x1="${r.a.x.toFixed(2)}" y1="${(-r.a.y).toFixed(2)}" x2="${r.b.x.toFixed(2)}" y2="${(-r.b.y).toFixed(2)}" stroke="#B9B09C" stroke-width="0.25" stroke-dasharray="3 2"/>`);
  if (layout.splays.length) parts.push(`<path d="${regionToPath(layout.splays)}" fill="#D9611C" fill-opacity="0.35"/>`);
  for (const p of layout.plots) {
    const d = regionToPath(p.region);
    parts.push(`<path d="${d}" fill="${BAND(p)}" fill-opacity="0.28" stroke="${BAND(p)}" stroke-width="0.25"/>`);
    if (p.mortgaged) parts.push(`<path d="${d}" fill="url(#hm)"/>`);
  }
  if (numbers)
    for (const p of layout.plots)
      parts.push(`<text x="${p.centroid.x.toFixed(2)}" y="${(-p.centroid.y).toFixed(2)}" font-size="${Math.min(3.2, p.width * 0.4).toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-family="Helvetica, Arial, sans-serif" fill="${INK}">${p.no}</text>`);
  return parts.join('\n');
}

const DEFS = `<defs>
<pattern id="hm" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#C4500A" stroke-width="0.45"/></pattern>
<pattern id="hb" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="3" stroke="${LINE}" stroke-width="0.3"/></pattern>
</defs>`;

/** Plain plan SVG in metres. */
export function planSvg(layout: Layout): string {
  const b = bbox(layout.parcel);
  const pad = 15;
  const w = b.x1 - b.x0 + 2 * pad;
  const h = b.y1 - b.y0 + 2 * pad;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0 - pad} ${-b.y1 - pad} ${w} ${h}" width="${w}mm" height="${h}mm">
<title>${esc(layout.params.site.projectName)} — yield study only</title>
${DEFS}
<rect x="${b.x0 - pad}" y="${-b.y1 - pad}" width="${w}" height="${h}" fill="#F4F1EA"/>
${planGroup(layout)}
<text x="${b.x0}" y="${-b.y1 - 5}" font-size="5" font-family="Helvetica" fill="#C4500A">YIELD STUDY ONLY — NOT A SUBMISSION DRAWING</text>
</svg>`;
}

const SCALES = [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];

/** A3 landscape drawing sheet (mm) with architectural title block. */
export function drawingSheet(layout: Layout, date = new Date()): string {
  const W = 420;
  const H = 297;
  const m = 10;
  const tbW = 100;
  const fw = W - 2 * m - tbW - 4;
  const fh = H - 2 * m;
  const b = bbox(layout.parcel);
  const pw = b.x1 - b.x0;
  const ph = b.y1 - b.y0;
  const need = Math.max(pw / (fw - 16), ph / (fh - 16)) * 1000;
  const N = SCALES.find((s) => s >= need) ?? Math.ceil(need / 1000) * 1000;
  const k = 1000 / N;
  const cx = m + fw / 2 - ((b.x0 + b.x1) / 2) * k;
  const cy = m + fh / 2 + ((b.y0 + b.y1) / 2) * k;
  const s = layout.params.site;
  const tx = W - m - tbW;
  const rows: [string, string][] = [
    ['PROJECT', s.projectName],
    ['SURVEY NOS.', s.surveyNos || '—'],
    ['AUTHORITY', PROFILES[s.authority].label],
    ['EXTENT', `${(layout.gross / ACRE).toFixed(2)} ac · ${Math.round(layout.gross).toLocaleString('en-IN')} m²`],
    ['PLOTS', `${layout.plots.length} · ${Math.round(layout.plotted).toLocaleString('en-IN')} m²`],
    ['SCALE', `1:${N} @ A3`],
    ['DATE', date.toISOString().slice(0, 10)],
    ['REVISION', s.revision || 'A'],
    ['ENGINE', layout.params.mode === 'rules' ? 'Rule-aware (GO 105)' : 'v1 parity'],
  ];
  const sbM = N >= 2000 ? 100 : 50;
  const sbLen = sbM * k;
  const lines = layout.areaLines.filter((l) => l.m2 > 0.5);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="Helvetica, Arial, sans-serif">
${DEFS}
<rect width="${W}" height="${H}" fill="#F4F1EA"/>
<rect x="${m / 2}" y="${m / 2}" width="${W - m}" height="${H - m}" fill="none" stroke="${INK}" stroke-width="0.6"/>
<rect x="${m}" y="${m}" width="${fw}" height="${fh}" fill="none" stroke="${INK}" stroke-width="0.25"/>
<g transform="translate(${cx.toFixed(3)} ${cy.toFixed(3)}) scale(${k})">${planGroup(layout, N <= 1500)}</g>
<g transform="translate(${m + fw - 16} ${m + 18})">
  <circle r="9" fill="none" stroke="${INK}" stroke-width="0.3"/>
  <g transform="rotate(${-s.northOffset})"><path d="M0 -12 4 6 0 3 -4 6z" fill="none" stroke="${INK}" stroke-width="0.4"/><path d="M0 -12 0 3 -4 6z" fill="${INK}"/></g>
  <text y="14" font-size="4" text-anchor="middle" fill="${INK}">N</text>
</g>
<g transform="translate(${m + 6} ${m + fh - 8})">
  ${[0, 1, 2, 3].map((i) => `<rect x="${(i * sbLen) / 4}" y="0" width="${sbLen / 4}" height="2" fill="${i % 2 ? '#F4F1EA' : INK}" stroke="${INK}" stroke-width="0.2"/>`).join('')}
  <text y="-1.5" font-size="2.6" fill="${INK}">0</text><text x="${sbLen}" y="-1.5" font-size="2.6" text-anchor="end" fill="${INK}">${sbM} m</text>
</g>
<rect x="${tx}" y="${m}" width="${tbW}" height="${fh}" fill="none" stroke="${INK}" stroke-width="0.4"/>
<text x="${tx + 5}" y="${m + 10}" font-size="6" font-weight="bold" fill="${INK}">LANDPLAN STUDIO</text>
<text x="${tx + 5}" y="${m + 15}" font-size="2.8" fill="#575C63">Plotted layout · feasibility · Telangana</text>
${rows.map(([kk, v], i) => `<line x1="${tx}" x2="${tx + tbW}" y1="${m + 20 + i * 11}" y2="${m + 20 + i * 11}" stroke="${INK}" stroke-width="0.15"/><text x="${tx + 4}" y="${m + 24 + i * 11}" font-size="2.3" letter-spacing="0.4" fill="#575C63">${kk}</text><text x="${tx + 4}" y="${m + 29 + i * 11}" font-size="3.4" fill="${INK}">${esc(v)}</text>`).join('\n')}
<text x="${tx + 4}" y="${m + 128}" font-size="2.3" letter-spacing="0.4" fill="#575C63">AREA STATEMENT</text>
${lines.map((l, i) => `<text x="${tx + 4}" y="${m + 134 + i * 4.6}" font-size="2.9" fill="${INK}">${esc(l.label)}</text><text x="${tx + tbW - 4}" y="${m + 134 + i * 4.6}" font-size="2.9" text-anchor="end" fill="${INK}">${Math.round(l.m2).toLocaleString('en-IN')} m² · ${((l.m2 / layout.gross) * 100).toFixed(1)}%</text>`).join('\n')}
<g transform="translate(${tx + tbW / 2} ${m + fh - 26}) rotate(-6)">
  <rect x="-40" y="-9" width="80" height="18" fill="none" stroke="#C4500A" stroke-width="0.9"/>
  <text y="-1" font-size="6" font-weight="bold" text-anchor="middle" fill="#C4500A">YIELD STUDY ONLY</text>
  <text y="5.5" font-size="2.8" text-anchor="middle" fill="#C4500A">NOT A SUBMISSION DRAWING</text>
</g>
<text x="${tx + 4}" y="${m + fh - 4}" font-size="2.2" fill="#575C63">Rules change by GO — verify against current text.</text>
</svg>`;
}
