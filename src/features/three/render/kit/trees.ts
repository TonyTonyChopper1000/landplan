// Instanced trees with vertex-shader wind sway, and instanced street lamps with night glow.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { normalise } from './geom';
import { shared, type Mats } from './materials';
import type { Lamp, TreeKind, TreeSpot } from './ctx';
import type { Textures } from './textures';

function swayMaterial(base: THREE.MeshStandardMaterial, amount: number): THREE.MeshStandardMaterial {
  const m = base.clone();
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.time;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float bend = max(0.0, position.y - 1.5) * ${amount.toFixed(3)};
        float ph = ip.x * 0.11 + ip.z * 0.07;
        transformed.x += sin(uTime * 1.3 + ph) * bend;
        transformed.z += cos(uTime * 1.1 + ph * 1.3) * bend * 0.6;`,
      );
  };
  m.customProgramCacheKey = () => `sway${amount}`;
  return m;
}

const blob = (r: number, x: number, y: number, z: number, detail = 1) => {
  const g = new THREE.IcosahedronGeometry(r, detail);
  g.translate(x, y, z);
  return normalise(g);
};

function canopy(kind: TreeKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'teak') {
    parts.push(blob(1.6, 0, 7.5, 0), blob(1.3, 0.4, 9.2, 0.2), blob(1.2, -0.5, 6.3, -0.3));
  } else if (kind === 'sanders') {
    parts.push(blob(1.3, 0, 3.6, 0), blob(1.0, 0.5, 4.4, 0.3));
  } else if (kind === 'mango') {
    parts.push(blob(2.6, 0, 4.2, 0), blob(2.0, 1.4, 4.6, 0.6), blob(2.0, -1.3, 4.4, -0.7), blob(1.8, 0.2, 5.6, -0.4));
  } else if (kind === 'gulmohar' || kind === 'rain') {
    // Umbrella crown.
    const sq = (g: THREE.BufferGeometry) => (g.scale(1, 0.55, 1), g);
    parts.push(sq(blob(3.6, 0, 9.5, 0)), sq(blob(2.6, 2.2, 9.0, 1.0)), sq(blob(2.6, -2.1, 9.1, -0.9)), sq(blob(2.2, 0.5, 10.3, -1.6)));
    parts.forEach((g, i) => i && g.translate(0, 0, 0));
  } else if (kind === 'jacaranda') {
    parts.push(blob(2.6, 0, 7.4, 0), blob(2.0, 1.6, 7.0, 0.8), blob(2.0, -1.5, 7.1, -0.6), blob(1.7, 0.2, 8.6, -0.5));
  } else {
    parts.push(blob(2.4, 0, 6.5, 0), blob(2.0, 1.5, 6.1, 0.9), blob(2.0, -1.4, 6.4, -0.8), blob(1.8, 0.3, 7.7, -0.3));
  }
  return mergeGeometries(parts)!;
}

function trunk(kind: TreeKind): THREE.BufferGeometry {
  if (kind === 'palm' || kind === 'coconut') {
    // Gently curved, ringed trunk.
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(0.28 - i * 0.012, (i / 10) * (kind === 'coconut' ? 10 : 8.5)));
    const g = new THREE.LatheGeometry(pts, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.pow(p.getY(i) / 9, 2) * 0.8);
    return normalise(g);
  }
  const h = kind === 'teak' ? 7 : kind === 'sanders' ? 3.2 : kind === 'mango' ? 3.2 : kind === 'gulmohar' || kind === 'rain' ? 8.2 : 5.8;
  const r = kind === 'sanders' ? 0.14 : kind === 'teak' ? 0.22 : 0.32;
  const g = new THREE.CylinderGeometry(r * 0.7, r, h, 7);
  g.translate(0, h / 2, 0);
  const parts = [normalise(g)];
  if (kind === 'gulmohar' || kind === 'rain') {
    for (const a of [0.6, 2.6, 4.4]) {
      const b = new THREE.CylinderGeometry(0.1, 0.18, 3.4, 5);
      b.translate(0, 1.7, 0);
      b.rotateZ(0.8);
      b.rotateY(a);
      b.translate(0, 6.5, 0);
      parts.push(normalise(b));
    }
  }
  return mergeGeometries(parts)!;
}

function fronds(kind: TreeKind): THREE.BufferGeometry {
  const H = kind === 'coconut' ? 10 : 8.5;
  const parts: THREE.BufferGeometry[] = [];
  const n = kind === 'coconut' ? 11 : 9;
  for (let i = 0; i < n; i++) {
    // A drooping frond: a bent, tapering strip.
    const segs = 6;
    const pos: number[] = [];
    const L = kind === 'coconut' ? 4.6 : 3.8;
    for (let k = 0; k < segs; k++) {
      const t0 = k / segs;
      const t1 = (k + 1) / segs;
      const w0 = Math.sin(Math.PI * Math.min(1, t0 + 0.08)) * 0.75;
      const w1 = Math.sin(Math.PI * Math.min(1, t1 + 0.08)) * 0.75;
      const y0 = Math.sin(t0 * 1.4) * 1.2 - t0 * t0 * 2.6;
      const y1 = Math.sin(t1 * 1.4) * 1.2 - t1 * t1 * 2.6;
      const x0 = t0 * L;
      const x1 = t1 * L;
      pos.push(x0, y0, -w0, x1, y1, -w1, x1, y1 + 0.15, 0, x0, y0, -w0, x1, y1 + 0.15, 0, x0, y0 + 0.15, 0);
      pos.push(x0, y0 + 0.15, 0, x1, y1 + 0.15, 0, x1, y1, w1, x0, y0 + 0.15, 0, x1, y1, w1, x0, y0, w0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.rotateZ(0.15 + (i % 3) * 0.12);
    g.rotateY((i / n) * Math.PI * 2 + (i % 2) * 0.2);
    g.translate(0.75, H, 0);
    parts.push(normalise(g));
  }
  if (kind === 'coconut') for (let k = 0; k < 5; k++) parts.push(blob(0.22, 0.75 + Math.cos(k) * 0.35, H - 0.4, Math.sin(k) * 0.35, 0));
  return mergeGeometries(parts)!;
}

const CANOPY_MAT: Record<TreeKind, string> = {
  palm: 'palm',
  coconut: 'palm',
  gulmohar: 'gulmohar',
  jacaranda: 'jacaranda',
  neem: 'neem',
  rain: 'rain',
  mango: 'neem',
  teak: 'rain',
  sanders: 'neem',
};

/** Build one InstancedMesh per tree part and kind. Colour jitter per instance. */
export function buildTrees(spots: TreeSpot[], mats: Mats, seedRng: () => number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'trees';
  const kinds = new Map<TreeKind, TreeSpot[]>();
  for (const s of spots) kinds.set(s.kind, [...(kinds.get(s.kind) ?? []), s]);
  const sway = new Map<string, THREE.MeshStandardMaterial>();
  const swayFor = (k: string, amount: number) => {
    const key = `${k}:${amount}`;
    if (!sway.has(key)) sway.set(key, swayMaterial(mats[k] as THREE.MeshStandardMaterial, amount));
    return sway.get(key)!;
  };
  const o = new THREE.Object3D();
  const col = new THREE.Color();
  for (const [kind, list] of kinds) {
    const palmy = kind === 'palm' || kind === 'coconut';
    const parts: [THREE.BufferGeometry, THREE.Material, boolean][] = [
      [trunk(kind), palmy ? swayFor('trunk', 0.012) : (mats.trunk as THREE.Material), false],
      [palmy ? fronds(kind) : canopy(kind), swayFor(CANOPY_MAT[kind], palmy ? 0.03 : 0.018), true],
    ];
    for (const [geo, mat, tint] of parts) {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => {
        o.position.set(s.p.x, 0, -s.p.y);
        o.rotation.set(0, seedRng() * Math.PI * 2, 0);
        o.scale.setScalar(s.s);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        if (tint) m.setColorAt(i, col.setHSL(0, 0, 0.82 + seedRng() * 0.3));
      });
      m.castShadow = true;
      m.receiveShadow = !tint;
      m.computeBoundingSphere();
      group.add(m);
    }
  }
  // Gulmohar and jacaranda: mix in a little green so crowns read as flowering trees, not lollipops.
  return group;
}

/** Street lamps: poles + heads instanced; glow sprites and ground light pools fade in at night. */
export function buildLamps(lamps: Lamp[], mats: Mats, tex: Textures): { group: THREE.Group; glowMats: THREE.Material[] } {
  const group = new THREE.Group();
  group.name = 'lamps';
  const poles = lamps.filter((l) => l.h >= 5);
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 1, 8);
  pole.translate(0, 0.5, 0);
  const arm = new THREE.BoxGeometry(1, 0.08, 0.08);
  arm.translate(0.5, 0, 0);
  const head = new THREE.BoxGeometry(0.7, 0.14, 0.32);
  const o = new THREE.Object3D();
  const mk = (g: THREE.BufferGeometry, mat: THREE.Material, n: number, f: (i: number) => void) => {
    const m = new THREE.InstancedMesh(g, mat, n);
    for (let i = 0; i < n; i++) {
      f(i);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.castShadow = true;
    m.computeBoundingSphere();
    group.add(m);
    return m;
  };
  const tip = (l: Lamp) => new THREE.Vector3(l.p.x + Math.cos(l.angle) * l.arm, l.h, -(l.p.y + Math.sin(l.angle) * l.arm));
  if (poles.length) {
    mk(pole, mats.darkMetal, poles.length, (i) => {
      o.position.set(poles[i].p.x, 0, -poles[i].p.y);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, poles[i].h, 1);
    });
    mk(arm, mats.darkMetal, poles.length, (i) => {
      o.position.set(poles[i].p.x, poles[i].h, -poles[i].p.y);
      o.rotation.set(0, poles[i].angle, 0);
      o.scale.set(poles[i].arm || 0.01, 1, 1);
    });
    mk(head, mats.lampHead, poles.length, (i) => {
      o.position.copy(tip(poles[i])).add(new THREE.Vector3(0, -0.08, 0));
      o.rotation.set(0, poles[i].angle, 0);
      o.scale.set(1, 1, 1);
    });
  }
  // Glow halos (sprites) and light pools on the ground — additive, scaled by the night factor.
  const halo = new THREE.PointsMaterial({ map: tex.glow, color: '#ffd29a', size: 3.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const haloPos = new Float32Array(lamps.length * 3);
  const poolMat = new THREE.MeshBasicMaterial({ map: tex.glow, color: '#ffc27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length);
  lamps.forEach((l, i) => {
    const t = tip(l);
    haloPos.set([t.x, t.y - 0.25, t.z], i * 3);
    o.position.set(t.x, 0.2, t.z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(l.h >= 5 ? l.h * 1.7 : 5);
    o.updateMatrix();
    pools.setMatrixAt(i, o.matrix);
  });
  pools.computeBoundingSphere();
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const points = new THREE.Points(hg, halo);
  points.renderOrder = 3;
  group.add(points);
  pools.renderOrder = 2;
  group.add(pools);
  return { group, glowMats: [halo, poolMat] };
}
