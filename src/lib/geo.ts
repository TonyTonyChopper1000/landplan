import type { Pt } from '@/engine/geometry';

const M_LAT = 110540;
const M_LON = 111320;

export function lonLatToLocal(pts: [number, number][], origin: [number, number]): Pt[] {
  const k = Math.cos((origin[1] * Math.PI) / 180);
  return pts.map(([lon, lat]) => ({ x: (lon - origin[0]) * M_LON * k, y: (lat - origin[1]) * M_LAT }));
}

export function localToLonLat(p: Pt, anchor: { lat: number; lon: number }): [number, number] {
  const k = Math.cos((anchor.lat * Math.PI) / 180);
  return [anchor.lon + p.x / (M_LON * k), anchor.lat + p.y / M_LAT];
}
