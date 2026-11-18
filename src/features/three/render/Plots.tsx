// Plot pads with live status tint and filter dimming, picking, and the selected-plot
// outline with edge dimension tags.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { offsetRegion } from '@/engine/clip';
import { plotPrice } from '@/engine/finance';
import { SQYD } from '@/engine/geometry';
import type { Plot, PlotStatus } from '@/engine/types';
import type { Built } from './build';
import { STATUS_COLOURS, useRender, type Filter } from './store';

export const statusOf = (p: Plot, inv: Record<number, { status?: PlotStatus }>): PlotStatus => inv[p.no]?.status ?? (p.mortgaged ? 'Mortgaged' : 'Available');

/** Size bands per project type (sq yd). */
export function sizeBand(type: string, p: Plot): 'small' | 'medium' | 'large' {
  const sy = p.area / SQYD;
  const [a, b] = type === 'farm' ? [1300, 2500] : type === 'villas' ? [300, 400] : [200, 300];
  return sy <= a ? 'small' : sy <= b ? 'medium' : 'large';
}

export function matches(f: Filter, p: Plot, built: Built): boolean {
  const params = built.ctx.layout.params;
  if (f.status.length && !f.status.includes(statusOf(p, params.inventory))) return false;
  if (f.budget) {
    const pr = plotPrice(p, params);
    if (pr < f.budget[0] || pr > f.budget[1]) return false;
  }
  if (f.size === 'custom') {
    if (p.area < f.custom[0] || (f.custom[1] > 0 && p.area > f.custom[1])) return false;
  } else if (f.size !== 'all' && sizeBand(built.ctx.type, p) !== f.size) return false;
  if (f.facing.length && !f.facing.includes(p.facing)) return false;
  if (f.frontage > 0 && p.width < f.frontage) return false;
  if (f.cornerOnly && !p.corner) return false;
  return true;
}

export function filterActive(f: Filter) {
  return f.status.length > 0 || !!f.budget || f.size !== 'all' || f.facing.length > 0 || f.frontage > 0 || f.cornerOnly;
}

export function Plots({ built }: { built: Built }) {
  const { ctx, type } = built;
  const plots = ctx.layout.plots;
  const statusOn = useRender((s) => s.layers.status);
  const future = useRender((s) => s.layers.future);
  const filter = useRender((s) => s.filter);
  const selected = useRender((s) => s.selected);
  const set = useRender((s) => s.set);
  const { invalidate } = useThree();

  useEffect(() => {
    const base = type.padColour;
    const dim = new THREE.Color('#5b6068');
    const active = filterActive(filter);
    const cols = plots.map((p) => {
      const c = statusOn ? new THREE.Color(STATUS_COLOURS[statusOf(p, ctx.layout.params.inventory)]).lerp(base, ctx.type === 'plots' ? 0.12 : 0.05) : base.clone();
      if (active && !matches(filter, p, built)) c.lerp(dim, 0.82);
      return c;
    });
    type.pads.setColors(cols);
    invalidate();
  }, [plots, statusOn, filter, built, type, ctx, invalidate]);

  useEffect(() => {
    if (type.ghosts) type.ghosts.visible = future;
    invalidate();
  }, [future, type, invalidate]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6 || e.faceIndex == null) return;
    const i = type.pads.triPlot[e.faceIndex];
    if (i >= 0 && plots[i]) set({ selected: plots[i].no });
  };

  const sel = plots.find((p) => p.no === selected);
  const outline = useMemo(() => {
    if (!sel) return null;
    const ring = offsetRegion(sel.region, 0.05)[0] ?? sel.region[0];
    const y = type.pads.top + 0.45;
    const pts = [...ring, ring[0]].map((q) => new THREE.Vector3(q.x, y, -q.y));
    const tags = ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length];
      return { p: new THREE.Vector3((a.x + b.x) / 2, y + 0.2, -(a.y + b.y) / 2), len: Math.hypot(b.x - a.x, b.y - a.y) };
    }).filter((t) => t.len > 1.2);
    // A soft white curtain rising from the pad edge.
    const pos: number[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const y0 = type.pads.top;
      pos.push(a.x, y0, -a.y, b.x, y0, -b.y, b.x, y, -b.y, a.x, y0, -a.y, b.x, y, -b.y, a.x, y, -a.y);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return { pts, tags, curtain: g };
  }, [sel, type]);
  useEffect(() => () => outline?.curtain.dispose(), [outline]);

  return (
    <>
      <primitive object={type.pads.mesh} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')} />
      {type.ghosts && <primitive object={type.ghosts} />}
      {outline && (
        <>
          <Line points={outline.pts} color="#ffffff" lineWidth={3.5} />
          <mesh geometry={outline.curtain}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {outline.tags.map((t, i) => (
            <Html key={i} position={t.p} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className="rv-tag">{t.len.toFixed(1)} m</div>
            </Html>
          ))}
        </>
      )}
    </>
  );
}
