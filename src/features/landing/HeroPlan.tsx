import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { applyGo105, defaultParams } from '@/engine/defaults';
import { generate } from '@/engine/layout';
import { bbox, regionToPath, polyToPath } from '@/engine/geometry';
import type { Layout, PresetId } from '@/engine/types';
import { bandColor } from '@/features/studio/style';

const SCENES: { preset: PresetId; acres: number; theta: number; offX: number }[] = [
  { preset: 'L', acres: 17, theta: 0, offX: 0 },
  { preset: 'irr', acres: 24, theta: 20, offX: 1 / 3 },
  { preset: 'trap', acres: 14, theta: 0, offX: 2 / 3 },
  { preset: 'tri', acres: 20, theta: 35, offX: 0 },
];

export function useHeroLayouts(): Layout[] {
  return useMemo(
    () =>
      SCENES.map((s) => {
        const p = applyGo105(defaultParams());
        return generate({ ...p, site: { ...p.site, preset: s.preset, acres: s.acres }, grid: { ...p.grid, theta: s.theta, offX: s.offX } });
      }),
    [],
  );
}

/** Live engine layouts, cycling, drawing themselves in. */
export function HeroPlan({ layouts, onScene }: { layouts: Layout[]; onScene?: (l: Layout) => void }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % layouts.length), 5200);
    return () => window.clearInterval(t);
  }, [layouts.length, reduce]);
  const l = layouts[i];
  useEffect(() => onScene?.(l), [l, onScene]);
  const b = bbox(l.parcel);
  const pad = 30;
  const maxD = Math.max(1, ...l.plots.map((p) => Math.hypot(p.centroid.x, p.centroid.y)));
  return (
    <svg key={i} viewBox={`${b.x0 - pad} ${-b.y1 - pad} ${b.x1 - b.x0 + 2 * pad} ${b.y1 - b.y0 + 2 * pad}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden>
      <defs>
        <filter id="hero-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={polyToPath(l.parcel)} fill="var(--road)" fillOpacity={0.6} stroke="var(--blueprint)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" filter="url(#hero-glow)" />
      {l.roadRuns.map((r) => (
        <line key={r.id} className="road-draw" pathLength={1} x1={r.a.x} y1={-r.a.y} x2={r.b.x} y2={-r.b.y} stroke="var(--signal)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
      <g className="block-in">
        {l.open.map((o) => (
          <path key={o.id} d={regionToPath(o.region)} fill="var(--park)" stroke="var(--sign-green)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {l.plots.map((p) => {
        const c = bandColor(p);
        return (
          <path
            key={p.no}
            className="plot-in"
            style={{ animationDelay: `${Math.round(180 + (Math.hypot(p.centroid.x, p.centroid.y) / maxD) * 900)}ms`, animationDuration: '420ms' }}
            d={regionToPath(p.region)}
            fill={`color-mix(in srgb, ${c} 30%, transparent)`}
            stroke={c}
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
