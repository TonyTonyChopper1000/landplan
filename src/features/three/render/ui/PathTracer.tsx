// Ultra: progressive path-traced stills whenever the camera rests (three-gpu-pathtracer).
// Lazy-loaded; only mounted at Ultra quality on WebGL2 with float render targets.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { useRender } from '../store';

const MAX_INSTANCES = 1500;

/** A static copy of the scene the tracer understands: standard materials only, instances expanded. */
function traceScene(src: THREE.Scene, focus: THREE.Vector3): THREE.Scene {
  const out = new THREE.Scene();
  out.environment = src.environment;
  out.background = new THREE.Color('#b9cde0');
  out.environmentIntensity = src.environmentIntensity;
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const push = (m: THREE.Material, g: THREE.BufferGeometry) => byMat.set(m, [...(byMat.get(m) ?? []), g]);
  src.updateMatrixWorld(true);
  const tmp = new THREE.Matrix4();
  src.traverse((o) => {
    if (!o.visible) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.Material;
    if (mat.type !== 'MeshStandardMaterial' || (mat as THREE.MeshStandardMaterial).transparent) return;
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      const idx = Array.from({ length: inst.count }, (_, i) => i);
      const pos = new THREE.Vector3();
      const d = idx.map((i) => {
        inst.getMatrixAt(i, tmp);
        return pos.setFromMatrixPosition(tmp).distanceToSquared(focus);
      });
      idx.sort((a, b) => d[a] - d[b]);
      for (const i of idx.slice(0, MAX_INSTANCES)) {
        inst.getMatrixAt(i, tmp);
        const g = inst.geometry.clone();
        g.applyMatrix4(tmp.premultiply(inst.matrixWorld));
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        push(mat, g.index ? g.toNonIndexed() : g);
      }
      return;
    }
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    push(mat, g.index ? g.toNonIndexed() : g);
  });
  for (const [m, list] of byMat) {
    const keep = list.filter((g) => g.attributes.position);
    const attrs = (g: THREE.BufferGeometry) => Object.keys(g.attributes).sort().join();
    const first = keep[0] ? attrs(keep[0]) : '';
    const merged = mergeGeometries(keep.filter((g) => attrs(g) === first), false);
    if (merged) out.add(new THREE.Mesh(merged, m));
    list.forEach((g) => g.dispose());
  }
  src.traverse((o) => {
    const l = o as THREE.DirectionalLight;
    if (l.isDirectionalLight) {
      const c = new THREE.DirectionalLight(l.color, l.intensity);
      c.position.copy(l.getWorldPosition(new THREE.Vector3()));
      c.target.position.copy(l.target.getWorldPosition(new THREE.Vector3()));
      out.add(c, c.target);
    }
  });
  return out;
}

export default function PathTracer() {
  const { gl, scene, camera, controls, invalidate } = useThree();
  const tracer = useRef<WebGLPathTracer | null>(null);
  const last = useRef<THREE.Scene | null>(null);
  const drop = () => {
    last.current?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    last.current = null;
  };
  const still = useRef({ t: 0, m: new THREE.Matrix4() });
  const tracing = useRender((s) => s.tracing);
  const set = useRender((s) => s.set);

  useEffect(() => {
    try {
      const pt = new WebGLPathTracer(gl);
      pt.tiles.set(2, 2);
      pt.minSamples = 3;
      pt.renderDelay = 0;
      pt.fadeDuration = 400;
      tracer.current = pt;
    } catch (e) {
      set({ quality: 'high', ultraBlocked: `Ultra unavailable: ${(e as Error).message}` });
    }
    return () => {
      tracer.current?.dispose();
      tracer.current = null;
      drop();
      set({ tracing: false });
    };
  }, [gl, set]);

  useFrame((state, dt) => {
    const pt = tracer.current;
    if (!pt) return;
    const moved = !still.current.m.equals(camera.matrixWorld);
    if (moved) {
      still.current.m.copy(camera.matrixWorld);
      still.current.t = 0;
      if (useRender.getState().tracing) set({ tracing: false });
      return;
    }
    still.current.t += dt;
    if (!useRender.getState().tracing && still.current.t > 1.2) {
      try {
        const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? new THREE.Vector3();
        drop();
        last.current = traceScene(scene, target);
        pt.setScene(last.current, camera);
        set({ tracing: true });
      } catch (e) {
        set({ quality: 'high', ultraBlocked: `Ultra unavailable: ${(e as Error).message}` });
      }
    }
    if (useRender.getState().tracing) {
      pt.renderSample();
      invalidate();
    }
    void state;
  }, tracing ? 1 : 0);

  return null;
}
