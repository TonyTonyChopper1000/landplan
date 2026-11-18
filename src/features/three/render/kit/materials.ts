import * as THREE from 'three';
import type { Textures } from './textures';

export type Mats = Record<string, THREE.Material>;
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

/** Shared uniforms (wind time, night factor) for shader patches. */
export const shared = { time: { value: 0 }, night: { value: 0 } };

/** Emissive that ramps with the night factor (windows, lamps, signs). */
function nightGlow(m: THREE.MeshStandardMaterial, strength: number) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = shared.night;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance *= (uNight * ${strength.toFixed(2)});`);
  };
  m.customProgramCacheKey = () => `glow${strength}`;
  return m;
}

export function makeMaterials(t: Textures): Mats {
  const tex = (x: THREE.Texture) => x;
  return {
    ground: std({ color: '#7d9a55', roughness: 1 }),
    asphalt: std({ map: tex(t.asphalt), color: '#ffffff', roughness: 0.92 }),
    murrum: std({ map: tex(t.murrum), color: '#ffffff', roughness: 1 }),
    marking: std({ color: '#f4f4ef', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    markingYellow: std({ color: '#f1c40f', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    zebra: std({ color: '#f7f7f2', roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    paver: std({ map: tex(t.pavers), color: '#ffffff', roughness: 0.85 }),
    kerb: std({ map: tex(t.kerb), color: '#ffffff', roughness: 0.7 }),
    kerbGrey: std({ color: '#c9c4ba', roughness: 0.8 }),
    lawn: std({ map: tex(t.lawn), color: '#ffffff', roughness: 1 }),
    pad: std({ map: tex(t.soil), color: '#ffffff', vertexColors: true, roughness: 0.95 }),
    padEdge: std({ color: '#ffffff', roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    hatch: std({ map: tex(t.hatch), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    boundaryStone: std({ color: '#e8e2d4', roughness: 0.7 }),
    wall: std({ color: '#efeae0', roughness: 0.9 }),
    pillar: std({ color: '#f6f2ea', roughness: 0.85 }),
    cap: std({ color: '#c9b79a', roughness: 0.7 }),
    hedge: std({ color: '#3f7a35', roughness: 1 }),
    flowers: std({ color: '#e0559a', roughness: 1 }),
    flowersY: std({ color: '#f2b632', roughness: 1 }),
    trunk: std({ color: '#6b4f3a', roughness: 1 }),
    palm: std({ color: '#4f8f3a', roughness: 0.9, side: THREE.DoubleSide }),
    gulmohar: std({ color: '#d8462f', roughness: 0.95 }),
    jacaranda: std({ color: '#8f6fd1', roughness: 0.95 }),
    neem: std({ color: '#3f7f34', roughness: 1 }),
    rain: std({ color: '#5a9440', roughness: 1 }),
    stone: std({ map: tex(t.stone), color: '#ffffff', roughness: 0.95 }),
    concrete: std({ color: '#d6d2c9', roughness: 0.9 }),
    darkMetal: std({ color: '#2b2f33', roughness: 0.45, metalness: 0.6 }),
    steel: std({ color: '#9aa2a8', roughness: 0.35, metalness: 0.8 }),
    wood: std({ color: '#8a5a36', roughness: 0.7 }),
    white: std({ color: '#f7f5f0', roughness: 0.6 }),
    tile: std({ color: '#b5603f', roughness: 0.8 }),
    tank: std({ color: '#2a2d30', roughness: 0.6 }),
    glass: nightGlow(std({ color: '#6f8ea6', roughness: 0.08, metalness: 0.65, emissive: '#ffcf8a', emissiveIntensity: 1 }), 2.4),
    glassDark: std({ color: '#5d7487', roughness: 0.08, metalness: 0.7 }),
    railGlass: std({ color: '#bfe3f0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }),
    lampHead: nightGlow(std({ color: '#fff3d6', roughness: 0.3, emissive: '#ffd59a', emissiveIntensity: 1 }), 6),
    sign: nightGlow(std({ color: '#1b1e22', roughness: 0.5, emissive: '#ffb36b', emissiveIntensity: 1 }), 0.6),
    water: std({ map: tex(t.water), color: '#ffffff', roughness: 0.08, metalness: 0.2 }),
    pool: nightGlow(std({ color: '#3fc6e0', roughness: 0.05, metalness: 0.1, emissive: '#3fc6e0', emissiveIntensity: 1 }), 0.8),
    track: std({ map: tex(t.track), color: '#ffffff', roughness: 0.9 }),
    turf: std({ map: tex(t.turf), color: '#ffffff', roughness: 0.95 }),
    net: std({ color: '#f2f2f2', roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    fence: std({ color: '#7d7d7d', roughness: 0.6, metalness: 0.5 }),
    ghost: std({ color: '#ffffff', transparent: true, opacity: 0.32, roughness: 0.6, depthWrite: false }),
    canopy: std({ color: '#f1ece2', roughness: 0.8, side: THREE.DoubleSide }),
    plaster0: std({ color: '#f3efe7', roughness: 0.9 }),
    plaster1: std({ color: '#ece0cd', roughness: 0.9 }),
    plaster2: std({ color: '#dfe1e0', roughness: 0.9 }),
    plaster3: std({ color: '#f1e6d6', roughness: 0.9 }),
    accent0: std({ color: '#2e3135', roughness: 0.6 }),
    accent1: std({ color: '#7a5233', roughness: 0.65 }),
    accent2: std({ color: '#a8583c', roughness: 0.75 }),
    farmFence: std({ color: '#5c5c5c', roughness: 0.6, metalness: 0.4 }),
    rubber: std({ color: '#2f8f9d', roughness: 0.95 }),
    drip: std({ color: '#1c1c1c', roughness: 0.6 }),
  };
}

export function disposeMaterials(m: Mats) {
  Object.values(m).forEach((x) => x.dispose());
}
