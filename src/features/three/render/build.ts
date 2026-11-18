// Orchestrates the render scene build across frames, reporting progress.
import * as THREE from 'three';
import type { Layout } from '@/engine/types';
import type { ProjectDetails, ProjectType } from '@/features/projects/types';
import { buildAmenities } from './kit/amenities';
import { makeCtx, type SceneCtx } from './kit/ctx';
import { Buckets, tick } from './kit/geom';
import { disposeMaterials, makeMaterials, type Mats } from './kit/materials';
import { buildSite } from './kit/site';
import { disposeTextures, makeTextures, type Textures } from './kit/textures';
import { buildLamps, buildTrees } from './kit/trees';
import { buildFarm, buildPlots, buildVillas, type TypeBuild } from './builders/types';

export type Built = {
  ctx: SceneCtx;
  root: THREE.Group;
  type: TypeBuild;
  mats: Mats;
  tex: Textures;
  glowMats: THREE.Material[];
  dispose: () => void;
};

const NO_SHADOW_CAST = new Set(['asphalt', 'murrum', 'marking', 'markingYellow', 'zebra', 'paver', 'lawn', 'padEdge', 'water', 'pool', 'turf', 'track', 'rubber', 'kerbGrey', 'drip', 'railGlass', 'net', 'ghost']);

export async function buildScene(
  layout: Layout,
  type: ProjectType,
  name: string,
  details: Partial<ProjectDetails>,
  roadNames: Record<string, string>,
  onProgress: (p: number, label: string) => void,
  signal?: { cancelled: boolean },
): Promise<Built | null> {
  const step = async (p: number, label: string) => {
    onProgress(p, label);
    await tick();
    if (signal?.cancelled) throw new Error('cancelled');
  };
  const tex = makeTextures();
  const mats = makeMaterials(tex);
  try {
    await step(0.05, 'Surfacing roads');
    const ctx = makeCtx(layout, type, name, details, roadNames);
    const B = new Buckets();
    buildSite(ctx, B);
    await step(0.3, 'Laying out gardens and amenities');
    buildAmenities(ctx, B);
    await step(0.5, type === 'villas' ? 'Raising villas' : type === 'farm' ? 'Planting the farm' : 'Levelling plot pads');
    const tb = type === 'villas' ? buildVillas(ctx, B, mats) : type === 'farm' ? buildFarm(ctx, B, mats) : buildPlots(ctx, B, mats);
    await step(0.72, 'Merging geometry');
    const root = new THREE.Group();
    root.name = 'render-root';
    const merged = B.build(mats, { cast: (k) => !NO_SHADOW_CAST.has(k) });
    root.add(merged);
    await step(0.85, 'Planting trees');
    root.add(buildTrees(ctx.trees, mats, ctx.rng));
    const lamps = buildLamps(ctx.lamps, mats, tex);
    root.add(lamps.group);
    await step(1, 'Ready');
    const dispose = () => {
      tb.pads.mesh.geometry.dispose();
      tb.ghosts?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mm && !Array.isArray(mm) && !Object.values(mats).includes(mm)) mm.dispose();
      });
      lamps.glowMats.forEach((m) => m.dispose());
      disposeMaterials(mats);
      disposeTextures(tex);
    };
    return { ctx, root, type: tb, mats, tex, glowMats: lamps.glowMats, dispose };
  } catch (e) {
    disposeMaterials(mats);
    disposeTextures(tex);
    if ((e as Error).message === 'cancelled') return null;
    throw e;
  }
}
