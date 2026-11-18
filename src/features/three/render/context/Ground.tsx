// Surroundings, level 2 and 3: Esri satellite tiles draped on a ground plane (fading into
// haze at the edges) over procedural fields with hedgerow trees.
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { pointInPoly, type Pt } from '@/engine/geometry';
import { lonLatToLocal } from '@/lib/geo';
import type { Built } from '../build';
import type { TreeSpot } from '../kit/ctx';
import { buildTrees } from '../kit/trees';

export const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ESRI_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics';

export function ProceduralGround({ built, showTrees }: { built: Built; showTrees: boolean }) {
  const { ctx, tex } = built;
  const S = Math.max(3000, ctx.size * 14);
  const mat = useMemo(() => {
    const t = tex.fields.clone();
    t.needsUpdate = true;
    t.repeat.set(S / 520, S / 520);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: '#ffffff' });
  }, [tex, S]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(S, S);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [S]);
  const trees = useMemo(() => {
    const spots: TreeSpot[] = [];
    const rng = ctx.rng;
    const parcel = ctx.layout.parcel;
    const g = ctx.gate;
    const out = { x: -g.inward.x, y: -g.inward.y };
    const roadC = { x: g.edgeMid.x + out.x * (2.5 + ctx.approachWidth / 2), y: g.edgeMid.y + out.y * (2.5 + ctx.approachWidth / 2) };
    const offRoad = (p: Pt) => Math.abs((p.x - roadC.x) * out.x + (p.y - roadC.y) * out.y) > ctx.approachWidth / 2 + 8;
    const nearParcel = (p: Pt) => {
      if (pointInPoly(p, parcel)) return true;
      for (let i = 0; i < parcel.length; i++) {
        const a = parcel[i];
        const b = parcel[(i + 1) % parcel.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t) < 14) return true;
      }
      return false;
    };
    // Hedgerows along a loose field grid, plus clumps.
    const R = ctx.size * 2.2;
    const c = ctx.centre;
    for (let gx = -R; gx < R; gx += 140 + rng() * 60)
      for (let t = -R; t < R; t += 9 + rng() * 10) {
        for (const p of [{ x: c.x + gx + rng() * 4, y: c.y + t }, { x: c.x + t, y: c.y + gx + rng() * 4 }]) {
          if (rng() > 0.55 || nearParcel(p) || !offRoad(p)) continue;
          spots.push({ p, kind: rng() > 0.85 ? 'palm' : rng() > 0.4 ? 'neem' : 'rain', s: 0.7 + rng() * 0.6 });
        }
      }
    for (let k = 0; k < 60; k++) {
      const a = rng() * Math.PI * 2;
      const r = ctx.size * (0.7 + rng() * 1.6);
      const cc = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
      for (let j = 0; j < 6; j++) {
        const p = { x: cc.x + (rng() - 0.5) * 30, y: cc.y + (rng() - 0.5) * 30 };
        if (!nearParcel(p) && offRoad(p)) spots.push({ p, kind: rng() > 0.7 ? 'palm' : 'neem', s: 0.8 + rng() * 0.5 });
      }
    }
    return buildTrees(spots.slice(0, 2600), built.mats, rng);
  }, [ctx, built.mats]);
  useEffect(
    () => () => {
      mat.map?.dispose();
      mat.dispose();
      geo.dispose();
      trees.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
    [mat, geo, trees],
  );
  return (
    <>
      <mesh geometry={geo} material={mat} position={[ctx.centre.x, -0.06, -ctx.centre.y]} receiveShadow />
      {showTrees && <primitive object={trees} />}
    </>
  );
}

function tileXY(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}
function tileLonLat(x: number, y: number, z: number): [number, number] {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return [lon, lat];
}

/** Stitch z17 Esri tiles into one texture with a radial fade. Calls onFail if most tiles fail. */
export function EsriGround({ built, anchor, onFail }: { built: Built; anchor: { lat: number; lon: number }; onFail: () => void }) {
  const { ctx } = built;
  const [state, setState] = useState<{ tex: THREE.CanvasTexture; x0: number; y0: number; x1: number; y1: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const z = 17;
    const span = Math.max(1400, ctx.size * 5);
    const mPerTile = (40075016 * Math.cos((anchor.lat * Math.PI) / 180)) / 2 ** z;
    const half = Math.ceil(span / 2 / mPerTile);
    const c = tileXY(anchor.lon, anchor.lat, z);
    const tx0 = Math.floor(c.x) - half;
    const ty0 = Math.floor(c.y) - half;
    const n = half * 2 + 1;
    const T = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n * T;
    const g = cv.getContext('2d')!;
    let ok = 0;
    let bad = 0;
    const loads: Promise<void>[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        loads.push(
          new Promise<void>((res) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              g.drawImage(img, i * T, j * T);
              ok++;
              res();
            };
            img.onerror = () => {
              bad++;
              res();
            };
            img.src = ESRI_URL.replace('{z}', String(z)).replace('{y}', String(ty0 + j)).replace('{x}', String(tx0 + i));
            setTimeout(() => res(), 12000);
          }),
        );
    Promise.all(loads).then(() => {
      if (!alive) return;
      if (ok < bad || ok === 0) {
        onFail();
        return;
      }
      // Fade to transparent towards the edges so imagery melts into the haze.
      g.globalCompositeOperation = 'destination-in';
      const rg = g.createRadialGradient(cv.width / 2, cv.height / 2, cv.width * 0.28, cv.width / 2, cv.height / 2, cv.width * 0.5);
      rg.addColorStop(0, 'rgba(0,0,0,1)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const [lonA, latA] = tileLonLat(tx0, ty0, z);
      const [lonB, latB] = tileLonLat(tx0 + n, ty0 + n, z);
      const [p0, p1] = lonLatToLocal(
        [
          [lonA, latA],
          [lonB, latB],
        ],
        [anchor.lon, anchor.lat],
      );
      setState({ tex, x0: p0.x, y0: p1.y, x1: p1.x, y1: p0.y });
    });
    return () => {
      alive = false;
    };
  }, [anchor.lat, anchor.lon, ctx.size, onFail]);
  useEffect(() => () => state?.tex.dispose(), [state]);
  if (!state) return null;
  const w = state.x1 - state.x0;
  const h = state.y1 - state.y0;
  return (
    <mesh position={[(state.x0 + state.x1) / 2, -0.03, -(state.y0 + state.y1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={state.tex} transparent roughness={1} depthWrite={false} />
    </mesh>
  );
}
