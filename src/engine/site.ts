// Site intake: parse, project, clean and reconcile a parcel boundary. Pure; runs in browser and Node.
import proj4 from 'proj4';
import { union } from './clip';
import { ACRE, GUNTA, area, centroid, ensureCCW, signedArea, type Poly, type Pt } from './geometry';
import { reconcile, type Reconciliation } from './reconcile';
export { reconcile, type Reconciliation };

export class SiteError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SiteError';
  }
}

const UTM44N = '+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs';
const WGS84 = 'EPSG:4326';

export type Crs = { local: 'EPSG:32644'; origin: [number, number] };
export type SiteResult = {
  polygon: Poly; // local metres, centred on the centroid, CCW
  crs: Crs | null;
  areaM2: number;
  acres: number;
  guntas: number;
  closure?: { misclosureM: number; precision: string; adjusted: boolean };
  reconciliation: Reconciliation;
  warnings: string[];
};

export function toUtm(lonlat: [number, number][]): Pt[] {
  return lonlat.map(([lon, lat]) => {
    const [x, y] = proj4(WGS84, UTM44N, [lon, lat]);
    return { x, y };
  });
}

export function fromLocal(p: Pt, crs: Crs): [number, number] {
  const [lon, lat] = proj4(UTM44N, WGS84, [p.x + crs.origin[0], p.y + crs.origin[1]]);
  return [lon, lat];
}

/** Bearings (whole-circle degrees from north) and distances → closed polygon, Bowditch-adjusted. */
export function traverse(rows: { bearing: number; distance: number }[]): { polygon: Poly; misclosure: number; perimeter: number; adjusted: boolean } {
  if (rows.length < 3) throw new SiteError('A traverse needs at least 3 legs', 'traverse-short');
  const legs = rows.map((r) => {
    const b = (r.bearing * Math.PI) / 180;
    return { dx: r.distance * Math.sin(b), dy: r.distance * Math.cos(b), d: r.distance };
  });
  const ex = legs.reduce((s, l) => s + l.dx, 0);
  const ey = legs.reduce((s, l) => s + l.dy, 0);
  const perimeter = legs.reduce((s, l) => s + l.d, 0);
  const misclosure = Math.hypot(ex, ey);
  if (perimeter <= 0) throw new SiteError('Traverse has zero length', 'traverse-empty');
  if (misclosure / perimeter > 1 / 1000)
    throw new SiteError(`Closing error 1:${Math.round(perimeter / misclosure)} is worse than 1:1000; check the bearings`, 'traverse-misclose');
  const pts: Pt[] = [{ x: 0, y: 0 }];
  for (const l of legs.slice(0, -1)) {
    const prev = pts[pts.length - 1];
    pts.push({ x: prev.x + l.dx - (ex * l.d) / perimeter, y: prev.y + l.dy - (ey * l.d) / perimeter });
  }
  return { polygon: pts, misclosure, perimeter, adjusted: misclosure > 1e-9 };
}

/** Fix self-intersections, drop duplicate (<1 mm) and collinear vertices, force CCW. */
export function cleanPolygon(p: Poly): Poly {
  if (p.length < 3) throw new SiteError('Polygon needs at least 3 vertices', 'poly-short');
  const fixed = union([p]).filter((r) => signedArea(r) > 0);
  const ring = fixed.length ? fixed.reduce((a, b) => (area(b) > area(a) ? b : a)) : p;
  const out: Pt[] = [];
  for (const q of ring) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(q.x - last.x, q.y - last.y) >= 0.001) out.push(q);
  }
  if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 0.001) out.pop();
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length];
      const b = out[i];
      const c = out[(i + 1) % out.length];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
      if (Math.abs(cross) / len < 0.001) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (out.length < 3 || area(out) < 1) throw new SiteError('Polygon collapses after clean-up', 'poly-degenerate');
  return ensureCCW(out);
}

function centred(p: Poly): { polygon: Poly; c: Pt } {
  const c = centroid(p);
  return { polygon: p.map((q) => ({ x: q.x - c.x, y: q.y - c.y })), c };
}

type GeoJsonLike = { type?: string; features?: GeoJsonLike[]; geometry?: GeoJsonLike; coordinates?: unknown };
function firstRing(g: GeoJsonLike): number[][] | null {
  if (!g) return null;
  if (g.type === 'FeatureCollection') {
    for (const f of g.features ?? []) {
      const r = firstRing(f);
      if (r) return r;
    }
    return null;
  }
  if (g.type === 'Feature' && g.geometry) return firstRing(g.geometry);
  if (g.type === 'Polygon') return (g.coordinates as number[][][])[0];
  if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][])[0][0];
  return null;
}

export function parseDxfPolyline(text: string): Poly {
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
  if (!found) throw new SiteError('No closed polyline found in DXF', 'dxf-empty');
  return found;
}

export function parseKmlRing(text: string): number[][] {
  const m = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(text);
  if (!m) throw new SiteError('No polygon coordinates in KML', 'kml-empty');
  return m[1].trim().split(/\s+/).map((t) => t.split(',').map(Number));
}

export type SiteInput =
  | { kind: 'geojson'; data: unknown }
  | { kind: 'kml'; text: string }
  | { kind: 'dxf'; text: string }
  | { kind: 'bearings'; rows: { bearing: number; distance: number }[] }
  | { kind: 'local'; polygon: Pt[] };

export function intake(input: SiteInput, record: { acres?: number; guntas?: number; tolPct?: number } = {}): SiteResult {
  const warnings: string[] = [];
  let poly: Poly;
  let crs: Crs | null = null;
  let closure: SiteResult['closure'];
  if (input.kind === 'geojson' || input.kind === 'kml') {
    const ring = input.kind === 'kml' ? parseKmlRing(input.text) : firstRing(input.data as GeoJsonLike);
    if (!ring || ring.length < 3) throw new SiteError('No polygon found', 'geo-empty');
    const utm = toUtm(ring.map((c) => [c[0], c[1]] as [number, number]));
    const cleaned = cleanPolygon(utm);
    const { polygon, c } = centred(cleaned);
    crs = { local: 'EPSG:32644', origin: [c.x, c.y] };
    poly = polygon;
  } else if (input.kind === 'bearings') {
    const t = traverse(input.rows);
    closure = { misclosureM: t.misclosure, precision: t.misclosure > 1e-9 ? `1:${Math.round(t.perimeter / t.misclosure)}` : 'closed', adjusted: t.adjusted };
    if (t.adjusted) warnings.push(`Traverse adjusted by Bowditch rule (misclosure ${t.misclosure.toFixed(3)} m)`);
    poly = centred(cleanPolygon(t.polygon)).polygon;
  } else if (input.kind === 'dxf') poly = centred(cleanPolygon(parseDxfPolyline(input.text))).polygon;
  else poly = centred(cleanPolygon(input.polygon)).polygon;
  const a = area(poly);
  const rec = reconcile(a, record.acres, record.guntas, record.tolPct);
  if (rec.warning) warnings.push(rec.warning);
  return { polygon: poly, crs, areaM2: a, acres: a / ACRE, guntas: a / GUNTA, closure, reconciliation: rec, warnings };
}
