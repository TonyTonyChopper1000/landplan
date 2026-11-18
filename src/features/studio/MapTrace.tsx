import { useEffect, useRef, useState } from 'react';
import { Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import type { Feature } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useProject, setSection } from '@/state/project';
import { useUi } from '@/state/ui';
import { centre } from '@/engine/parcel';
import { ensureCCW, area } from '@/engine/geometry';
import { lonLatToLocal } from '@/lib/geo';
import { Button, Caps } from '@/components/ui/controls';
import { acres } from '@/lib/format';

type LL = [number, number];

export default function MapTrace() {
  const anchor = useProject((s) => s.params.site.anchor);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [pts, setPts] = useState<LL[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const m = new MlMap({
      container: box.current,
      center: [anchor.lon, anchor.lat],
      zoom: 16,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          sat: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
          },
        },
        layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
      },
    });
    m.on('error', () => setFailed(true));
    m.on('click', (e) => setPts((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]));
    m.doubleClickZoom.disable();
    m.getCanvas().style.cursor = 'crosshair';
    map.current = m;
    return () => m.remove();
  }, [anchor.lat, anchor.lon]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const data: Feature = {
      type: 'Feature',
      properties: {},
      geometry: pts.length > 2 ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] } : { type: 'LineString', coordinates: pts },
    };
    const apply = () => {
      const src = m.getSource('trace') as GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource('trace', { type: 'geojson', data });
        m.addLayer({ id: 'trace-fill', type: 'fill', source: 'trace', paint: { 'fill-color': '#3FC1D9', 'fill-opacity': 0.18 } });
        m.addLayer({ id: 'trace-line', type: 'line', source: 'trace', paint: { 'line-color': '#FF6B1A', 'line-width': 2 } });
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
  }, [pts]);

  const local = pts.length >= 3 ? lonLatToLocal(pts, pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0])) : null;

  const use = () => {
    if (!local || pts.length < 3) return;
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    setSection('site', { polygon: centre(ensureCCW(local)), source: 'drawn', anchor: { lon: c[0], lat: c[1] }, bearings: [] });
    useUi.setState({ mapTrace: false, tool: 'parcel' });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-asphalt">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-asphalt-2 px-3 py-2">
        <Caps>Trace site on satellite</Caps>
        <span className="text-[12px] text-lane-dim">Click corners in order.</span>
        <span className="num text-[12px]">{pts.length} pts{local ? ` · ${acres(area(local))}` : ''}</span>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setPts((p) => p.slice(0, -1))} disabled={!pts.length}>
          Undo point
        </Button>
        <Button size="sm" variant="outline" onClick={() => useUi.setState({ mapTrace: false })}>
          Cancel
        </Button>
        <Button size="sm" variant="signal" onClick={use} disabled={pts.length < 3}>
          Use as parcel
        </Button>
      </div>
      <div ref={box} className="relative flex-1" />
      {failed && (
        <p className="absolute bottom-3 left-3 rounded-[4px] border border-line bg-asphalt-2 p-2 text-[11px] text-lane-dim">
          Satellite tiles could not load (offline or blocked). You can still click to trace; coordinates are geographic.
        </p>
      )}
    </div>
  );
}
