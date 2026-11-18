// Surroundings, level 1: Google Photorealistic 3D Tiles (only with VITE_GOOGLE_MAPS_KEY and a
// georeferenced parcel). The mesh is flattened inside the parcel so our site sits on it.
// Attributions and the Google logo are always shown; nothing is cached beyond the browser's
// normal HTTP cache. Any failure falls back to satellite imagery.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TilesPlugin, TilesRenderer } from '3d-tiles-renderer/r3f';
import { GLTFExtensionsPlugin, GoogleCloudAuthPlugin, ReorientationPlugin, TileCompressionPlugin, TileFlatteningPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { offsetRegion } from '@/engine/clip';
import type { Built } from '../build';
import { flatRegion } from '../kit/geom';

/** Latest attribution text, read by the overlay and by exports. */
export const googleAttribution = { text: '', listeners: new Set<() => void>() };

type TilesLike = THREE.EventDispatcher & {
  group: THREE.Group;
  getAttributions: (t?: { type: string; value: unknown }[]) => { type: string; value: unknown }[];
  addEventListener: (t: string, f: (e: unknown) => void) => void;
  removeEventListener: (t: string, f: (e: unknown) => void) => void;
  getPluginByName?: (n: string) => unknown;
};

export default function GoogleTiles({ built, anchor, apiKey, onFail }: { built: Built; anchor: { lat: number; lon: number }; apiKey: string; onFail: () => void }) {
  const tilesRef = useRef<TilesLike | null>(null);
  const flattenRef = useRef<TileFlatteningPlugin | null>(null);
  const holder = useRef<THREE.Group>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const draco = useMemo(() => new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/'), []);
  useEffect(
    () => () => {
      draco.dispose();
    },
    [draco],
  );
  const deg = Math.PI / 180;

  // Fall back if nothing has loaded after 15 s or on error.
  const loaded = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => !loaded.current && onFail(), 15000);
    return () => clearTimeout(t);
  }, [onFail]);

  // Flattening shape: the parcel plus a 15 m apron, at ground level.
  const shape = useMemo(() => {
    const g = flatRegion(offsetRegion([built.ctx.layout.parcel], 15), 0);
    return g ? new THREE.Mesh(g, new THREE.MeshBasicMaterial()) : null;
  }, [built]);
  useEffect(() => () => shape?.geometry.dispose(), [shape]);

  const ray = useMemo(() => new THREE.Raycaster(), []);
  const frame = useRef(0);
  useFrame(() => {
    const tiles = tilesRef.current;
    if (!tiles) return;
    if (++frame.current % 30 === 0) {
      const a = tiles.getAttributions().filter((x) => x.type === 'string').map((x) => String(x.value)).join(' · ');
      if (a !== googleAttribution.text) {
        googleAttribution.text = a;
        googleAttribution.listeners.forEach((f) => f());
      }
    }
    // Once tiles under the site have loaded, find the terrain height there and drop the
    // tiles so that ground sits at y = 0; then flatten inside the parcel.
    if (offset === null && frame.current % 20 === 0) {
      const c = built.ctx.centre;
      ray.set(new THREE.Vector3(c.x, 4000, -c.y), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(tiles.group, true)[0];
      if (hit) {
        loaded.current = true;
        setOffset(-hit.point.y);
      }
    }
  });
  useEffect(() => {
    if (offset === null || !shape || !flattenRef.current) return;
    shape.updateMatrixWorld(true);
    try {
      flattenRef.current.addShape(shape, new THREE.Vector3(0, -1, 0), Infinity);
    } catch {
      /* flattening is cosmetic */
    }
  }, [offset, shape]);

  return (
    <group ref={holder} position={[0, offset ?? -2000, 0]}>
      <TilesRenderer
        ref={tilesRef as never}
        errorTarget={12}
        onLoadError={() => {
          if (!loaded.current) onFail();
        }}
      >
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={[{ apiToken: apiKey, autoRefreshToken: true }]} />
        <TilesPlugin plugin={GLTFExtensionsPlugin} args={[{ dracoLoader: draco }]} />
        <TilesPlugin plugin={TileCompressionPlugin} />
        <TilesPlugin plugin={ReorientationPlugin} args={[{ lat: anchor.lat * deg, lon: anchor.lon * deg, height: 0, up: '+y', recenter: true }]} />
        <TilesPlugin plugin={TileFlatteningPlugin} ref={flattenRef as never} />
      </TilesRenderer>
    </group>
  );
}
