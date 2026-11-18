import type * as THREE from 'three';

/** Handles to the live renderer for exports (set from inside the Canvas). */
export const registry: { gl: THREE.WebGLRenderer | null; scene: THREE.Scene | null; camera: THREE.Camera | null; invalidate: () => void; setDpr?: (d: number) => void } = {
  gl: null,
  scene: null,
  camera: null,
  invalidate: () => undefined,
};
