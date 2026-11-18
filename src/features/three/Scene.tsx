import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { pointInRegion, rotate, type Poly, type Region } from '@/engine/geometry';
import { footprint } from '@/engine/massing';
import type { Layout } from '@/engine/types';

const toShape = (ring: Poly) => new THREE.Shape(ring.map((q) => new THREE.Vector2(q.x, q.y)));

function regionGeometry(rings: Region[], y: number): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  for (const r of rings) for (const ring of r) if (ring.length >= 3) geos.push(new THREE.ShapeGeometry(toShape(ring)));
  if (!geos.length) return null;
  const g = mergeGeometries(geos);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

const BAND = (s: number, irr: boolean) => (irr ? '#5A6270' : s <= 200 ? '#C9A227' : s <= 300 ? '#3FC1D9' : s <= 450 ? '#8C6FD6' : '#FF6B1A');

export function Scene({ layout, sun, fly, onFlyEnd }: { layout: Layout; sun: { elevation: number; azimuth: number }; fly: boolean; onFlyEnd: () => void }) {
  const p = layout.params;
  const parcelGeo = useMemo(() => regionGeometry([[layout.parcel]], 0), [layout.parcel]);
  const plotGeo = useMemo(() => regionGeometry(layout.plots.map((q) => q.region), 0.05), [layout.plots]);
  const parkGeo = useMemo(() => regionGeometry(layout.open.filter((o) => o.use === 'park').map((o) => o.region), 0.06), [layout.open]);
  const otherOpenGeo = useMemo(() => regionGeometry(layout.open.filter((o) => o.use !== 'park').map((o) => o.region), 0.06), [layout.open]);
  const bufferGeo = useMemo(() => regionGeometry(layout.buffers.map((b) => b.region), 0.04), [layout.buffers]);
  const theta = (layout.theta * Math.PI) / 180;
  const origin = useMemo(() => {
    const ps = layout.parcel;
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i], r = ps[(i + 1) % ps.length], f = q.x * r.y - r.x * q.y;
      a += f; cx += (q.x + r.x) * f; cy += (q.y + r.y) * f;
    }
    return { x: cx / (3 * a), y: cy / (3 * a) };
  }, [layout.parcel]);

  const buildings = useMemo(() => {
    const h = (p.built.floors + 1) * p.built.floorHeight;
    return layout.plots
      .filter((q) => !q.irregular)
      .map((q) => {
        const f = footprint(q, p.built.setbacks);
        const r = q.rect;
        const side = f.sb.side;
        const y0 = q.row === -1 ? r.y0 + f.sb.front : r.y0 + f.sb.rear;
        const y1 = q.row === -1 ? r.y1 - f.sb.rear : r.y1 - f.sb.front;
        const c = rotate({ x: (r.x0 + r.x1) / 2, y: (y0 + y1) / 2 }, theta, origin);
        return { no: q.no, x: c.x, z: -c.y, w: Math.max(0.5, r.x1 - r.x0 - 2 * side), d: Math.max(0.5, y1 - y0), h, color: BAND(q.sizeSqYd, false) };
      });
  }, [layout.plots, p.built, theta, origin]);

  const bRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = bRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    buildings.forEach((b, i) => {
      o.position.set(b.x, b.h / 2 + 0.06, b.z);
      o.rotation.set(0, theta, 0);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set('#E9E4D8').lerp(new THREE.Color(b.color), 0.18));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [buildings, theta]);

  const trees = useMemo(() => {
    const out: { x: number; z: number; s: number }[] = [];
    let k = 0;
    for (const o of layout.open.filter((x) => x.use === 'park')) {
      const xs = o.region.flat().map((q) => q.x);
      const ys = o.region.flat().map((q) => q.y);
      for (let x = Math.min(...xs) + 4; x < Math.max(...xs); x += 9)
        for (let y = Math.min(...ys) + 4; y < Math.max(...ys); y += 9)
          if (pointInRegion({ x, y }, o.region)) out.push({ x, z: -y, s: 0.8 + ((k++ * 37) % 10) / 25 });
    }
    return out;
  }, [layout.open]);
  const tRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = tRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    trees.forEach((t, i) => {
      o.position.set(t.x, 3.2 * t.s, t.z);
      o.scale.set(t.s, t.s, t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [trees]);

  const size = Math.max(layout.bounds.x1 - layout.bounds.x0, layout.bounds.y1 - layout.bounds.y0);
  const el = (Math.max(2, sun.elevation) * Math.PI) / 180;
  const az = (sun.azimuth * Math.PI) / 180;
  const dist = size * 1.2;
  const sunPos: [number, number, number] = [Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, -Math.cos(az) * Math.cos(el) * dist];
  const night = sun.elevation <= 0;

  const controls = useRef<OrbitImpl>(null);
  const { camera } = useThree();
  const t0 = useRef<number | null>(null);
  useFrame((state) => {
    if (!fly) {
      t0.current = null;
      return;
    }
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = (state.clock.elapsedTime - t0.current) / 12;
    if (t >= 1) {
      onFlyEnd();
      return;
    }
    const a = t * Math.PI * 2;
    const r = size * (0.75 - 0.35 * Math.sin(t * Math.PI));
    camera.position.set(Math.cos(a) * r + origin.x, size * (0.18 + 0.2 * (1 - Math.sin(t * Math.PI))), -Math.sin(a) * r - origin.y);
    camera.lookAt(origin.x, 0, -origin.y);
    controls.current?.target.set(origin.x, 0, -origin.y);
  });

  return (
    <>
      <color attach="background" args={[night ? '#07080A' : '#0F1114']} />
      <hemisphereLight args={['#bcd6e0', '#1a1e24', night ? 0.15 : 0.55]} />
      <directionalLight
        position={sunPos}
        intensity={night ? 0 : 2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-far={dist * 3}
        shadow-bias={-0.0004}
      />
      {parcelGeo && (
        <mesh geometry={parcelGeo} receiveShadow>
          <meshStandardMaterial color="#2A3038" roughness={0.95} />
        </mesh>
      )}
      {plotGeo && (
        <mesh geometry={plotGeo} receiveShadow>
          <meshStandardMaterial color="#C9C2AE" roughness={1} />
        </mesh>
      )}
      {parkGeo && (
        <mesh geometry={parkGeo} receiveShadow>
          <meshStandardMaterial color="#2F6B47" roughness={1} />
        </mesh>
      )}
      {otherOpenGeo && (
        <mesh geometry={otherOpenGeo} receiveShadow>
          <meshStandardMaterial color="#7A6A44" roughness={1} />
        </mesh>
      )}
      {bufferGeo && (
        <mesh geometry={bufferGeo}>
          <meshStandardMaterial color="#3FC1D9" transparent opacity={0.25} />
        </mesh>
      )}
      <instancedMesh key={`b${buildings.length}`} ref={bRef} args={[undefined, undefined, buildings.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh key={`t${trees.length}`} ref={tRef} args={[undefined, undefined, trees.length]} castShadow>
        <coneGeometry args={[2.2, 6.4, 7]} />
        <meshStandardMaterial color="#3E8A5A" roughness={0.9} />
      </instancedMesh>
      <OrbitControls ref={controls} makeDefault target={[origin.x, 0, -origin.y]} maxPolarAngle={Math.PI / 2.1} enabled={!fly} />
    </>
  );
}
