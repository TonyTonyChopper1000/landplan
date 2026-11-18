import type { Pt } from '@/engine/geometry';
import { lonLatToLocal } from '@/lib/geo';

type Result = { points: Pt[]; anchor?: { lat: number; lon: number } };

function fromLonLat(coords: number[][]): Result {
  const ring = coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1] ? coords.slice(0, -1) : coords;
  const c: [number, number] = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
  return { points: lonLatToLocal(ring.map((p) => [p[0], p[1]]), c), anchor: { lon: c[0], lat: c[1] } };
}

type GeoJsonLike = { type?: string; features?: GeoJsonLike[]; geometry?: GeoJsonLike; coordinates?: unknown };

function firstPolygon(g: GeoJsonLike): number[][] | null {
  if (!g) return null;
  if (g.type === 'FeatureCollection') {
    for (const f of g.features ?? []) {
      const r = firstPolygon(f);
      if (r) return r;
    }
    return null;
  }
  if (g.type === 'Feature' && g.geometry) return firstPolygon(g.geometry);
  if (g.type === 'Polygon') return (g.coordinates as number[][][])[0];
  if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][])[0][0];
  return null;
}

function parseDxf(text: string): Pt[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let cur: Pt[] | null = null;
  const polys: Pt[][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i];
    const val = lines[i + 1];
    if (code === '0') {
      if (val === 'LWPOLYLINE' || val === 'POLYLINE') {
        if (cur) polys.push(cur);
        cur = [];
      } else if (val !== 'VERTEX' && cur) {
        polys.push(cur);
        cur = null;
      }
    } else if (cur && code === '10') cur.push({ x: Number(val), y: 0 });
    else if (cur && code === '20' && cur.length) cur[cur.length - 1].y = Number(val);
  }
  if (cur) polys.push(cur);
  const found = polys.find((p) => p.length >= 3);
  if (!found) throw new Error('No closed polyline found in DXF');
  return found;
}

export function parseParcelFile(name: string, text: string, _anchor: { lat: number; lon: number }): Result {
  void _anchor;
  const lower = name.toLowerCase();
  if (lower.endsWith('.dxf')) return { points: parseDxf(text) };
  if (lower.endsWith('.kml')) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const c = doc.querySelector('Polygon coordinates, coordinates');
    if (!c?.textContent) throw new Error('No polygon coordinates in KML');
    const coords = c.textContent.trim().split(/\s+/).map((t) => t.split(',').map(Number));
    return fromLonLat(coords);
  }
  const ring = firstPolygon(JSON.parse(text) as GeoJsonLike);
  if (!ring) throw new Error('No polygon in GeoJSON');
  return fromLonLat(ring);
}
