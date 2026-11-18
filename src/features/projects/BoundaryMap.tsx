// Wizard "Land boundary": trace corners on Esri satellite imagery, import KML / GeoJSON / DXF,
// or jump to coordinates pasted from any map. Returns a centred local polygon + anchor.
import { useEffect, useRef, useState } from 'react';
import { Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import type { Feature } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { centre } from '@/engine/parcel';
import { area, ensureCCW, type Pt } from '@/engine/geometry';
import { lonLatToLocal, localToLonLat } from '@/lib/geo';
import { acres as fmtAcres } from '@/lib/format';
import { parseParcelFile } from '@/features/reports/importers';
import type { Boundary } from './types';

type LL = [number, number];
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const btn = 'h-8 rounded-[4px] border border-line px-3 text-[12.5px] hover:border-signal disabled:opacity-40';

export default function BoundaryMap({ value, onChange }: { value?: Boundary; onChange: (b: Boundary | undefined) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const start = value?.anchor ?? { lat: 17.385, lon: 78.4867 };
  const [pts, setPts] = useState<LL[]>(() => (value && value.source === 'drawn' ? value.polygon.map((p) => localToLonLat(p, value.anchor)) : []));
  const [msg, setMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const m = new MlMap({
      container: box.current,
      center: [start.lon, start.lat],
      zoom: value ? 16 : 12,
      attributionControl: { compact: true },
      style: { version: 8, sources: { sat: { type: 'raster', tiles: [ESRI], tileSize: 256, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' } }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }] },
    });
    m.on('error', () => setFailed(true));
    m.on('click', (e) => setPts((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]));
    m.doubleClickZoom.disable();
    map.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const data: Feature = { type: 'Feature', properties: {}, geometry: pts.length > 2 ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] } : { type: 'LineString', coordinates: pts } };
    const apply = () => {
      const src = m.getSource('trace') as GeoJSONSource | undefined;
      if (src) return src.setData(data);
      m.addSource('trace', { type: 'geojson', data });
      m.addLayer({ id: 'fill', type: 'fill', source: 'trace', paint: { 'fill-color': '#3FC1D9', 'fill-opacity': 0.2 } });
      m.addLayer({ id: 'line', type: 'line', source: 'trace', paint: { 'line-color': '#FF6B1A', 'line-width': 2.5 } });
      m.addLayer({ id: 'pts', type: 'circle', source: 'trace', paint: { 'circle-radius': 4, 'circle-color': '#fff' } });
    };
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
  }, [pts]);

  const mid = (p: LL[]): LL => p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
  const local = pts.length >= 3 ? lonLatToLocal(pts, mid(pts)) : null;
  const use = () => {
    if (!local) return;
    const c = mid(pts);
    onChange({ polygon: centre(ensureCCW(local)), anchor: { lon: c[0], lat: c[1] }, source: 'drawn' });
    setMsg(`Boundary set: ${fmtAcres(area(local))}`);
  };
  const goTo = (raw: string) => {
    const n = raw.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (!n || n.length < 2) return setMsg('Paste coordinates like 17.4123, 78.3456');
    const [lat, lon] = Math.abs(n[0]) <= 90 ? [n[0], n[1]] : [n[1], n[0]];
    map.current?.jumpTo({ center: [lon, lat], zoom: 17 });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            goTo(String(new FormData(e.currentTarget).get('ll') ?? ''));
          }}
        >
          <input name="ll" placeholder="Go to lat, lon (e.g. 17.41, 78.35)" className="h-8 w-[230px] rounded-[4px] border border-line bg-asphalt px-2.5 text-[12.5px] outline-none focus:border-signal" />
          <button className={btn}>Go</button>
        </form>
        <button type="button" className={btn} onClick={() => setPts((p) => p.slice(0, -1))} disabled={!pts.length}>
          Undo point
        </button>
        <button type="button" className={btn} onClick={() => (setPts([]), onChange(undefined), setMsg(null))} disabled={!pts.length && !value}>
          Clear
        </button>
        <label className={`${btn} inline-flex cursor-pointer items-center`}>
          Import KML / GeoJSON / DXF
          <input
            type="file"
            accept=".kml,.geojson,.json,.dxf"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const r = parseParcelFile(f.name, await f.text(), start);
                const poly: Pt[] = centre(ensureCCW(r.points));
                const anchor = r.anchor ?? start;
                onChange({ polygon: poly, anchor, source: 'import', located: !!r.anchor });
                setPts(poly.map((p) => localToLonLat(p, anchor)));
                if (r.anchor) map.current?.jumpTo({ center: [anchor.lon, anchor.lat], zoom: 16 });
                setMsg(`Imported ${poly.length} corners from ${f.name}: ${fmtAcres(area(poly))}${r.anchor ? '' : ' (DXF has no location, so satellite context is off)'}`);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'Could not read that file');
              }
            }}
          />
        </label>
        <div className="flex-1" />
        <span className="num text-[12px] text-lane-dim">
          {pts.length} pts{local ? ` · ${fmtAcres(area(local))}` : ''}
        </span>
        <button type="button" className={`${btn} border-signal text-signal-ink`} onClick={use} disabled={pts.length < 3}>
          Use this boundary
        </button>
      </div>
      <div ref={box} className="h-[380px] overflow-hidden rounded-[4px] border border-line" aria-label="Satellite map: click the corners of your land in order" />
      <p className="text-[11.5px] text-lane-dim">
        {failed ? 'Satellite tiles could not load here; import a KML or DXF instead. ' : 'Click each corner of the land in order, then press Use this boundary. '}
        A traced boundary is accurate to a few metres; for exact land, import the surveyor&apos;s DGPS/DXF or KML.
        {msg && <strong className="ml-1 text-lane">{msg}</strong>}
      </p>
    </div>
  );
}
