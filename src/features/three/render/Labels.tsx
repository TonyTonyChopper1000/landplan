// Batched SDF labels: plot numbers/dimensions/areas on the ground, painted road names,
// billboard amenity labels and the gate name board.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { BatchedText, Text as TText } from 'troika-three-text';
import { area as fmtArea } from '@/lib/format';
import type { Units } from '@/lib/format';
import type { SceneCtx } from './kit/ctx';
import { useRender } from './store';

export const FONT = '/fonts/Geist-SemiBold.ttf';
export const FONT_BOLD = '/fonts/Geist-Bold.ttf';

function makeBatch(items: { text: string; x: number; y: number; z: number; rz: number; size: number; color: string; outline?: string }[], opacity = 1) {
  const batch = new BatchedText();
  batch.font = FONT;
  for (const it of items) {
    const t = new TText();
    t.text = it.text;
    t.font = FONT;
    t.fontSize = it.size;
    t.anchorX = 'center';
    t.anchorY = 'middle';
    t.color = it.color;
    t.fillOpacity = opacity;
    if (it.outline) {
      t.outlineWidth = '7%';
      t.outlineColor = it.outline;
    }
    t.position.set(it.x, it.y, it.z);
    t.rotation.set(-Math.PI / 2, 0, it.rz);
    batch.add(t);
  }
  batch.sync();
  return batch;
}

export function PlotLabels({ ctx, top, units }: { ctx: SceneCtx; top: number; units: Units }) {
  const show = useRender((s) => s.layers.labels);
  const farm = ctx.type === 'farm';
  const { nums, details } = useMemo(() => {
    const nums: Parameters<typeof makeBatch>[0] = [];
    const det: Parameters<typeof makeBatch>[0] = [];
    for (const p of ctx.layout.plots) {
      const s = Math.max(0.9, Math.min(farm ? 6 : 3, Math.min(p.width, p.depth) * 0.26));
      // Text reads along the frontage; numbers sit nearer the road, details below.
      const rz = ctx.theta + (p.row === 1 ? Math.PI : 0);
      const back = { x: -Math.sin(ctx.theta) * (p.row === 1 ? -1 : 1), y: Math.cos(ctx.theta) * (p.row === 1 ? -1 : 1) };
      const c = p.centroid;
      const off = Math.min(p.depth * 0.18, s * 0.9);
      const ty = ctx.type === 'villas' ? 0.6 : top + 0.03;
      const pc = ctx.type === 'villas' ? { x: c.x - back.x * (p.depth / 2 - 1.6), y: c.y - back.y * (p.depth / 2 - 1.6) } : { x: c.x - back.x * off * 0.3, y: c.y - back.y * off * 0.3 };
      nums.push({ text: String(p.no), x: pc.x, y: ty, z: -pc.y, rz, size: ctx.type === 'villas' ? Math.min(1.4, s) : s, color: '#ffffff', outline: '#20262c' });
      if (ctx.type !== 'villas') {
        const dc = { x: c.x + back.x * off, y: c.y + back.y * off };
        det.push({ text: `${p.width.toFixed(1)} × ${p.depth.toFixed(1)} m\n${fmtArea(p.area, units)}`, x: dc.x, y: ty, z: -dc.y, rz, size: s * 0.36, color: '#fdfcf7', outline: '#20262c' });
      }
    }
    return { nums: makeBatch(nums), details: det.length ? makeBatch(det) : null };
  }, [ctx, top, units, farm]);
  useEffect(
    () => () => {
      nums.dispose();
      details?.dispose();
    },
    [nums, details],
  );
  const { camera, controls } = useThree();
  const [near, setNear] = useState(false);
  useFrame(() => {
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    const d = (camera as THREE.OrthographicCamera).isOrthographicCamera ? 1000 / (camera as THREE.OrthographicCamera).zoom : target ? camera.position.distanceTo(target) : camera.position.y * 2;
    const n = d < Math.max(140, ctx.size * 0.42);
    if (n !== near) setNear(n);
  });
  if (!show) return null;
  return (
    <>
      <primitive object={nums} />
      {details && near && <primitive object={details} />}
    </>
  );
}

export function RoadLabels({ ctx }: { ctx: SceneCtx }) {
  const show = useRender((s) => s.layers.labels);
  const batch = useMemo(
    () => (ctx.roadLabels.length ? makeBatch(ctx.roadLabels.map((r) => ({ text: r.text.toUpperCase(), x: r.p.x, y: 0.06, z: -r.p.y, rz: r.angle, size: r.size, color: '#f2f2ea' })), 0.82) : null),
    [ctx],
  );
  useEffect(() => () => batch?.dispose(), [batch]);
  if (!show || !batch) return null;
  return <primitive object={batch} />;
}

export function AmenityLabels({ ctx }: { ctx: SceneCtx }) {
  const show = useRender((s) => s.layers.amenities && s.layers.labels);
  const gate = ctx.labels.find((l) => l.kind === 'gate');
  const out = Math.atan2(-ctx.gate.inward.x, -ctx.gate.inward.y);
  const ref = useRef<THREE.Group>(null);
  return (
    <group ref={ref}>
      {gate && (
        <Text font={FONT_BOLD} fontSize={gate.size} position={[gate.p.x, gate.h, -gate.p.y]} rotation={[0, out + Math.PI, 0]} color="#ffd9a0" anchorX="center" anchorY="middle" maxWidth={ctx.gate.width}>
          {gate.text}
        </Text>
      )}
      {show &&
        ctx.labels
          .filter((l) => l.kind !== 'gate')
          .map((l, i) => (
            <Billboard key={i} position={[l.p.x, l.h, -l.p.y]}>
              <Text font={FONT_BOLD} fontSize={l.size} color={l.kind === 'entry' ? '#ffcf4a' : '#ffffff'} outlineWidth="6%" outlineColor="#1a1f25" anchorX="center" anchorY="bottom" letterSpacing={0.04}>
                {l.text}
              </Text>
            </Billboard>
          ))}
    </group>
  );
}
