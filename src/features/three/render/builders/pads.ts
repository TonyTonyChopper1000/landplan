// Plot pads: one merged mesh, vertex-coloured for status tint / filter dimming, with a
// triangle → plot lookup for picking and per-plot vertex ranges for recolouring.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { offsetRegion } from '@/engine/clip';
import type { Plot } from '@/engine/types';
import { planarUV, slabRegion } from '../kit/geom';

export type Pads = {
  mesh: THREE.Mesh;
  ranges: { start: number; count: number }[];
  triPlot: Int32Array;
  top: number;
  setColors: (cols: THREE.Color[]) => void;
};

export function buildPads(plots: Plot[], mat: THREE.Material, y0: number, y1: number, inset: number): Pads {
  const geos: THREE.BufferGeometry[] = [];
  const ranges: { start: number; count: number }[] = [];
  let v = 0;
  for (const p of plots) {
    const g = slabRegion(inset > 0 ? offsetRegion(p.region, -inset) : p.region, y0, y1);
    if (!g) {
      ranges.push({ start: v, count: 0 });
      continue;
    }
    planarUV(g, 3);
    ranges.push({ start: v, count: g.attributes.position.count });
    v += g.attributes.position.count;
    geos.push(g);
  }
  const merged = geos.length ? mergeGeometries(geos, false)! : new THREE.BufferGeometry();
  geos.forEach((g) => g.dispose());
  const colors = new Float32Array(v * 3).fill(1);
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const triPlot = new Int32Array(Math.floor(v / 3));
  ranges.forEach((r, i) => triPlot.fill(i, r.start / 3, (r.start + r.count) / 3));
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'pads';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  const setColors = (cols: THREE.Color[]) => {
    const a = merged.attributes.color as THREE.BufferAttribute;
    ranges.forEach((r, i) => {
      const c = cols[i];
      for (let k = r.start; k < r.start + r.count; k++) a.setXYZ(k, c.r, c.g, c.b);
    });
    a.needsUpdate = true;
  };
  return { mesh, ranges, triPlot, top: y1, setColors };
}
