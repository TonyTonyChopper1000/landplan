// The generated layout drawn on Esri satellite imagery (georeferenced parcels only).
// Plots are coloured by status; hover for the plot number, size and status.
import { useEffect, useRef, useState } from 'react';
import { Map as MlMap, LngLatBounds, type GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre';
import { difference, union } from '@/engine/clip';
import { SQYD, type Region } from '@/engine/geometry';
import type { Layout } from '@/engine/types';
import { localToLonLat } from '@/lib/geo';
import { statusOf } from './Inspector';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const COLOURS: Record<string, string> = { Available: '#2fae5a', Booked: '#f2b632', Sold: '#d94848', Held: '#8c939c', Mortgaged: '#7d8796' };

export default function SatellitePlan({ layout }: { layout: Layout }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [opacity, setOpacity] = useState(0.55);
  const anchor = layout.params.site.anchor;

  const data = (): FeatureCollection => {
    const ll = (r: Region) => r.map((ring) => [...ring, ring[0]].map((p) => localToLonLat(p, anchor)));
    const blocks = union(layout.blocks.flatMap((b) => b.region));
    const feats: FeatureCollection['features'] = [
      { type: 'Feature', properties: { kind: 'road' }, geometry: { type: 'Polygon', coordinates: ll(difference([layout.parcel], blocks)) } },
      ...layout.open.map((o) => ({ type: 'Feature' as const, properties: { kind: 'open' }, geometry: { type: 'Polygon' as const, coordinates: ll(o.region) } })),
      ...layout.plots.map((p) => {
        const st = statusOf(p, layout.params.inventory);
        return {
          type: 'Feature' as const,
          properties: { kind: 'plot', colour: COLOURS[st], label: `Plot ${p.no} · ${Math.round(p.area / SQYD)} sq yd · ${p.width.toFixed(1)} × ${p.depth.toFixed(1)} m · ${p.facing} · ${st}` },
          geometry: { type: 'Polygon' as const, coordinates: ll(p.region) },
        };
      }),
      { type: 'Feature', properties: { kind: 'parcel' }, geometry: { type: 'Polygon', coordinates: ll([layout.parcel]) } },
    ];
    return { type: 'FeatureCollection', features: feats };
  };

  useEffect(() => {
    if (!box.current) return;
    const m = new MlMap({
      container: box.current,
      center: [anchor.lon, anchor.lat],
      zoom: 16,
      attributionControl: { compact: true },
      style: { version: 8, sources: { sat: { type: 'raster', tiles: [ESRI], tileSize: 256, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' } }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }] },
    });
    m.on('load', () => {
      m.addSource('lay', { type: 'geojson', data: data() });
      m.addLayer({ id: 'road', type: 'fill', source: 'lay', filter: ['==', ['get', 'kind'], 'road'], paint: { 'fill-color': '#2b2f36', 'fill-opacity': 0.55 } });
      m.addLayer({ id: 'open', type: 'fill', source: 'lay', filter: ['==', ['get', 'kind'], 'open'], paint: { 'fill-color': '#3e9b4f', 'fill-opacity': 0.6 } });
      m.addLayer({ id: 'plot', type: 'fill', source: 'lay', filter: ['==', ['get', 'kind'], 'plot'], paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.55 } });
      m.addLayer({ id: 'plot-line', type: 'line', source: 'lay', filter: ['==', ['get', 'kind'], 'plot'], paint: { 'line-color': '#ffffff', 'line-width': 1 } });
      m.addLayer({ id: 'parcel', type: 'line', source: 'lay', filter: ['==', ['get', 'kind'], 'parcel'], paint: { 'line-color': '#FF6B1A', 'line-width': 2.5 } });
      const b = new LngLatBounds();
      layout.parcel.forEach((p) => b.extend(localToLonLat(p, anchor)));
      m.fitBounds(b, { padding: 40, duration: 0 });
    });
    m.on('mousemove', 'plot', (e) => {
      const f = e.features?.[0];
      setTip(f ? { x: e.point.x, y: e.point.y, text: String(f.properties?.label ?? '') } : null);
    });
    m.on('mouseleave', 'plot', () => setTip(null));
    map.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.lat, anchor.lon]);

  useEffect(() => {
    const m = map.current;
    const src = m?.getSource('lay') as GeoJSONSource | undefined;
    src?.setData(data());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    const m = map.current;
    if (!m?.getLayer('plot')) return;
    m.setPaintProperty('plot', 'fill-opacity', opacity);
    m.setPaintProperty('road', 'fill-opacity', opacity);
    m.setPaintProperty('open', 'fill-opacity', opacity);
  }, [opacity]);

  return (
    <div className="absolute inset-0 z-10">
      <div ref={box} className="h-full w-full" aria-label="Layout on satellite imagery" />
      <label className="absolute bottom-3 left-3 flex items-center gap-2 rounded-[4px] border border-line bg-asphalt-2/90 px-3 py-2 text-[12px] backdrop-blur">
        Overlay
        <input type="range" min={0} max={0.9} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="Overlay opacity" />
      </label>
      {tip && (
        <div className="pointer-events-none absolute rounded-[4px] bg-asphalt-2 px-2 py-1 text-[11.5px] shadow" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
