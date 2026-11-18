import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { bbox, regionToPath, polyToPath } from '@/engine/geometry';
import type { Layout } from '@/engine/types';
import { bandColor } from '@/features/studio/style';

/**
 * The live layout laid on a tilted drafting table: plots extrude upward in a ripple, roads pulse,
 * and the table follows the cursor. Pure SVG + CSS 3D.
 */
export function IsoTable({ layout, sceneKey }: { layout: Layout; sceneKey: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (reduce) return;
    const m = (e: PointerEvent) => setTilt({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 });
    window.addEventListener('pointermove', m);
    return () => window.removeEventListener('pointermove', m);
  }, [reduce]);
  const b = bbox(layout.parcel);
  const pad = 40;
  const vb = `${b.x0 - pad} ${-b.y1 - pad} ${b.x1 - b.x0 + 2 * pad} ${b.y1 - b.y0 + 2 * pad}`;
  const maxD = Math.max(1, ...layout.plots.map((p) => Math.hypot(p.centroid.x, p.centroid.y)));
  const delay = (x: number, y: number) => Math.round(250 + (Math.hypot(x, y) / maxD) * 1400);
  const layers = reduce ? [0] : [0, 1, 2, 3];
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 flex items-center justify-center [perspective:1600px]" aria-hidden>
      <div
        className="relative aspect-square w-[min(1500px,175vw)] transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${58 - tilt.y * 4}deg) rotateZ(${-28 + tilt.x * 6}deg) translateY(4%)` }}
      >
        {/* glow under the table */}
        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(255,107,26,.28),rgba(63,193,217,.12)_45%,transparent_70%)] blur-2xl" />
        {layers.map((li) => (
          <svg
            key={`${sceneKey}-${li}`}
            viewBox={vb}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
            style={{ transform: `translateZ(${li * 9}px)`, opacity: li === 0 ? 1 : 0.55 - li * 0.1 }}
          >
            {li === 0 && (
              <>
                <path d={polyToPath(layout.parcel)} fill="color-mix(in srgb, var(--asphalt-2) 92%, transparent)" stroke="var(--blueprint)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                {layout.roadRuns.map((r, i) => (
                  <line key={r.id} className={reduce ? undefined : 'pulse-road'} style={{ animationDelay: `${i * 160}ms` }} x1={r.a.x} y1={-r.a.y} x2={r.b.x} y2={-r.b.y} stroke="var(--signal)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
                ))}
                {layout.open.map((o) => (
                  <path key={o.id} d={regionToPath(o.region)} fill="color-mix(in srgb, var(--sign-green) 35%, transparent)" stroke="var(--sign-green)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ))}
              </>
            )}
            {layout.plots.map((p) => {
              const c = bandColor(p);
              return (
                <path
                  key={p.no}
                  className={reduce ? undefined : 'plot-in'}
                  style={{ animationDelay: `${delay(p.centroid.x, p.centroid.y) + li * 90}ms`, animationDuration: '520ms' }}
                  d={regionToPath(p.region)}
                  fill={li === layers.length - 1 ? `color-mix(in srgb, ${c} 55%, transparent)` : `color-mix(in srgb, ${c} ${li === 0 ? 22 : 12}%, transparent)`}
                  stroke={c}
                  strokeWidth={li === 0 ? 0.9 : 0.6}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        ))}
      </div>
    </div>
  );
}
