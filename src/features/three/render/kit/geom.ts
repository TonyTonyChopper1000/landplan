// Geometry helpers for the render scene. World (x east, y north) → three (x, up, -y).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Poly, Pt, Region } from '@/engine/geometry';

export const v3 = (p: Pt, h = 0) => new THREE.Vector3(p.x, h, -p.y);

/** Normalise attributes so geometries from different generators merge. */
export function normalise(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((out.attributes.position.count) * 2), 2));
  if (out !== g) g.dispose();
  out.morphAttributes = {};
  out.clearGroups();
  return out;
}

/** World-space planar UVs (metres / scale) so textures tile consistently across merged meshes. */
export function planarUV(g: THREE.BufferGeometry, scale = 1, axis: 'y' | 'x' | 'z' = 'y'): THREE.BufferGeometry {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (axis === 'y') {
      uv[i * 2] = x / scale;
      uv[i * 2 + 1] = -z / scale;
    } else if (axis === 'x') {
      uv[i * 2] = -z / scale;
      uv[i * 2 + 1] = y / scale;
    } else {
      uv[i * 2] = x / scale;
      uv[i * 2 + 1] = y / scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Flat polygon (with holes, even-odd rings) at height h. */
export function flatRegion(r: Region, h = 0): THREE.BufferGeometry | null {
  const shapes = regionShapes(r);
  if (!shapes.length) return null;
  const g = new THREE.ShapeGeometry(shapes);
  g.rotateX(-Math.PI / 2);
  g.translate(0, h, 0);
  return normalise(g);
}

/** Extruded slab between y0 and y1 (pads, plinths, lawns). */
export function slabRegion(r: Region, y0: number, y1: number): THREE.BufferGeometry | null {
  const shapes = regionShapes(r);
  if (!shapes.length) return null;
  const g = new THREE.ExtrudeGeometry(shapes, { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return normalise(g);
}

function signed(p: Poly) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i];
    const r = p[(i + 1) % p.length];
    a += q.x * r.y - r.x * q.y;
  }
  return a / 2;
}

/** Outer rings (CCW) become shapes; CW rings become holes of the outer ring that contains them. */
export function regionShapes(r: Region): THREE.Shape[] {
  const outers = r.filter((p) => p.length >= 3 && signed(p) > 0);
  const holes = r.filter((p) => p.length >= 3 && signed(p) < 0);
  const inside = (pt: Pt, poly: Poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  return outers.map((o) => {
    const s = new THREE.Shape(o.map((q) => new THREE.Vector2(q.x, q.y)));
    for (const h of holes) if (inside(h[0], o)) s.holes.push(new THREE.Path(h.map((q) => new THREE.Vector2(q.x, q.y))));
    return s;
  });
}

/** Axis box in a local frame: centre (world xy), size w (along dir) × d (across) × h, base at y0, rotated by angle. */
export function box(c: Pt, w: number, d: number, h: number, y0: number, angle: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d));
  g.translate(0, h / 2, 0);
  g.rotateY(angle);
  g.translate(c.x, y0, -c.y);
  return normalise(g);
}

/** Cylinder at c. */
export function cyl(c: Pt, r0: number, r1: number, h: number, y0: number, seg = 12): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg);
  g.translate(c.x, y0 + h / 2, -c.y);
  return normalise(g);
}

/** Thin flat strip along a segment (road markings, edge lines). */
export function strip(a: Pt, b: Pt, width: number, h: number): THREE.BufferGeometry {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const g = new THREE.PlaneGeometry(len, width);
  g.rotateX(-Math.PI / 2);
  g.rotateY(ang);
  g.translate((a.x + b.x) / 2, h, -(a.y + b.y) / 2);
  return normalise(g);
}

/** Wall/box spanning segment a→b. */
export function wallSeg(a: Pt, b: Pt, thick: number, h: number, y0 = 0): THREE.BufferGeometry {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return box({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, len, thick, h, y0, Math.atan2(b.y - a.y, b.x - a.x));
}

/** Collects geometries by material key and merges them at the end. */
export class Buckets {
  private m = new Map<string, THREE.BufferGeometry[]>();
  add(key: string, g: THREE.BufferGeometry | null | undefined) {
    if (!g) return;
    const list = this.m.get(key) ?? [];
    list.push(g);
    this.m.set(key, list);
  }
  build(materials: Record<string, THREE.Material>, opts: { cast?: (k: string) => boolean; receive?: (k: string) => boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    for (const [k, list] of this.m) {
      const mat = materials[k];
      if (!mat || !list.length) continue;
      // Merge in chunks to stay under 16M vertices per draw.
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = k;
      mesh.castShadow = opts.cast ? opts.cast(k) : true;
      mesh.receiveShadow = opts.receive ? opts.receive(k) : true;
      group.add(mesh);
    }
    this.m.clear();
    return group;
  }
}

/** Yield to the browser so long builds don't freeze the page. */
export const tick = () => new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
