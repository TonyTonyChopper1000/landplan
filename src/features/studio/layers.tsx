import { memo } from 'react';
import { useReducedMotion } from 'motion/react';
import { regionToPath, polyToPath, rotate, type Poly, type Pt, type Region } from '@/engine/geometry';
import type { Constraint, Layout, Plot } from '@/engine/types';
import { bandColor, OPEN_FILL, OPEN_LABEL } from './style';

export function Defs() {
  const reduce = useReducedMotion();
  return (
    <defs>
      <pattern id="hatch-mort" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--signal)" strokeWidth="1.4" strokeOpacity="0.75" />
        {!reduce && <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="6 0" dur="1.6s" repeatCount="indefinite" additive="sum" />}
      </pattern>
      <pattern id="hatch-buffer" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <rect width="7" height="7" fill="var(--conflict)" fillOpacity="0.06" />
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--conflict)" strokeWidth="1" strokeOpacity="0.45" />
      </pattern>
      <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <marker id="dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 2 10 5 0 8z" fill="var(--signal)" />
      </marker>
    </defs>
  );
}

const shrink = (ring: Poly, c: Pt, by: number): Poly => {
  return ring.map((q) => {
    const dx = q.x - c.x;
    const dy = q.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, (d - by) / d);
    return { x: c.x + dx * k, y: c.y + dy * k };
  });
};

export const ParcelLayer = memo(function ParcelLayer({ layout }: { layout: Layout }) {
  return (
    <g>
      <path d={polyToPath(layout.parcel)} fill="var(--road)" stroke="var(--blueprint)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      {layout.params.roads.boundary > 0 && (
        <path d={regionToPath(layout.inset)} fill="none" stroke="var(--road-edge)" strokeDasharray="6 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
    </g>
  );
});

export const ConstraintLayer = memo(function ConstraintLayer({ layout, constraints }: { layout: Layout; constraints: Constraint[] }) {
  return (
    <g>
      {layout.buffers.map((b) => (
        <g key={b.id}>
          <path d={regionToPath(b.region)} fill="var(--conflict)" opacity={0.18} filter="url(#soft-glow)" />
          <path d={regionToPath(b.region)} fill="url(#hatch-buffer)" stroke="var(--conflict)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {constraints.map((c) => {
        if (c.kind === 'lake' && c.pts.length >= 3)
          return <path key={c.id} d={polyToPath(c.pts)} fill="var(--blueprint)" fillOpacity={0.28} stroke="var(--blueprint)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
        if (c.kind === 'heritage' && c.pts[0])
          return (
            <g key={c.id}>
              <circle cx={c.pts[0].x} cy={-c.pts[0].y} r={200} fill="none" stroke="var(--band-3)" strokeDasharray="8 6" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <circle cx={c.pts[0].x} cy={-c.pts[0].y} r={4} fill="var(--band-3)" />
            </g>
          );
        const color = c.kind === 'ht' ? 'var(--band-1)' : c.kind === 'rail' ? 'var(--lane-dim)' : 'var(--blueprint)';
        return (
          <polyline
            key={c.id}
            points={c.pts.map((q) => `${q.x},${-q.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={c.kind === 'rail' ? 3 : 2}
            strokeDasharray={c.kind === 'ht' ? '10 4 2 4' : c.kind === 'rail' ? '2 6' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
});

export const RoadsLayer = memo(function RoadsLayer({ layout, genKey }: { layout: Layout; genKey: number }) {
  return (
    <g key={genKey}>
      {layout.roadRuns.map((r) => (
        <g key={r.id}>
          <line x1={r.a.x} y1={-r.a.y} x2={r.b.x} y2={-r.b.y} stroke="var(--road-edge)" strokeWidth={1} strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
          <line className="road-draw" pathLength={1} x1={r.a.x} y1={-r.a.y} x2={r.b.x} y2={-r.b.y} stroke="var(--blueprint)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {layout.splays.length > 0 && <path d={regionToPath(layout.splays)} fill="var(--signal)" fillOpacity={0.35} />}
    </g>
  );
});

export const OpenLayer = memo(function OpenLayer({ layout, genKey }: { layout: Layout; genKey: number }) {
  return (
    <g key={genKey} className="block-in">
      {layout.open.map((o) => (
        <path key={o.id} d={regionToPath(o.region)} fill={OPEN_FILL[o.use]} stroke={o.use === 'park' ? 'var(--sign-green)' : 'var(--lane-dim)'} strokeWidth={1} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
      ))}
    </g>
  );
});

export const OpenLabels = memo(function OpenLabels({ layout, s }: { layout: Layout; s: number }) {
  if (s < 0.35) return null;
  return (
    <g pointerEvents="none">
      {layout.open.map((o) => {
        const ring = o.region[0];
        if (!ring) return null;
        const c = ring.reduce((a, q) => ({ x: a.x + q.x / ring.length, y: a.y + q.y / ring.length }), { x: 0, y: 0 });
        return (
          <text key={o.id} x={c.x} y={-c.y} textAnchor="middle" dominantBaseline="middle" fontSize={10 / s} className="mono" fill="var(--lane)" fillOpacity={0.75} letterSpacing={1 / s}>
            {OPEN_LABEL[o.use]}
          </text>
        );
      })}
    </g>
  );
});

function plotDelay(p: Plot, maxD: number) {
  return Math.round((Math.hypot(p.centroid.x, p.centroid.y) / (maxD || 1)) * 220 + 150);
}

export const PlotsLayer = memo(function PlotsLayer({ layout, genKey }: { layout: Layout; genKey: number }) {
  const maxD = Math.max(1, ...layout.plots.map((p) => Math.hypot(p.centroid.x, p.centroid.y)));
  return (
    <g key={genKey}>
      {layout.plots.map((p) => {
        const col = bandColor(p);
        const d = regionToPath(p.region);
        return (
          <g key={p.no} className="plot-in" style={{ animationDelay: `${plotDelay(p, maxD)}ms` }} data-no={p.no}>
            <path d={d} fill={`color-mix(in srgb, ${col} 26%, transparent)`} stroke={col} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
            {p.mortgaged && <path d={d} fill="url(#hatch-mort)" pointerEvents="none" />}
            {p.corner && p.region[0] && <path d={polyToPath(shrink(p.region[0], p.centroid, 0.9))} fill="none" stroke={col} strokeWidth={0.6} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          </g>
        );
      })}
    </g>
  );
});

export const NumbersLayer = memo(function NumbersLayer({ layout, s }: { layout: Layout; s: number }) {
  const op = Math.max(0, Math.min(1, (s - 0.9) / 0.8));
  if (op <= 0) return null;
  return (
    <g pointerEvents="none" opacity={op}>
      {layout.plots.map((p) => (
        <text key={p.no} x={p.centroid.x} y={-p.centroid.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(11, p.width * s * 0.42) / s} className="mono" fill="var(--lane)">
          {p.no}
        </text>
      ))}
    </g>
  );
});

export function regionsOf(layout: Layout, h: { plots?: number[]; open?: string[]; buffers?: string[] }): Region {
  const out: Region = [];
  const ps = new Set(h.plots ?? []);
  for (const p of layout.plots) if (ps.has(p.no)) out.push(...p.region);
  const os = new Set(h.open ?? []);
  for (const o of layout.open) if (os.has(o.id)) out.push(...o.region);
  const bs = new Set(h.buffers ?? []);
  for (const b of layout.buffers) if (bs.has(b.id)) out.push(...b.region);
  return out;
}

/** Dimension lines with arrowheads for a hovered plot. */
export function Dimensions({ p, theta, origin, s }: { p: Plot; theta: number; origin: Pt; s: number }) {
  const th = (theta * Math.PI) / 180;
  const off = 2.2;
  const r = p.rect;
  const ya = p.row === -1 ? r.y0 - off : r.y1 + off;
  const xa = r.x1 + off;
  const a1 = rotate({ x: r.x0, y: ya }, th, origin);
  const a2 = rotate({ x: r.x1, y: ya }, th, origin);
  const b1 = rotate({ x: xa, y: r.y0 }, th, origin);
  const b2 = rotate({ x: xa, y: r.y1 }, th, origin);
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const fs = 10 / s;
  const lbl = (a: Pt, b: Pt, txt: string) => {
    const m = mid(a, b);
    return (
      <text x={m.x} y={-m.y} fontSize={fs} textAnchor="middle" dominantBaseline="central" className="mono" fill="var(--signal-ink)" stroke="var(--asphalt)" strokeWidth={3 / s} paintOrder="stroke">
        {txt}
      </text>
    );
  };
  return (
    <g pointerEvents="none">
      <line x1={a1.x} y1={-a1.y} x2={a2.x} y2={-a2.y} stroke="var(--signal)" strokeWidth={1} vectorEffect="non-scaling-stroke" markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
      <line x1={b1.x} y1={-b1.y} x2={b2.x} y2={-b2.y} stroke="var(--signal)" strokeWidth={1} vectorEffect="non-scaling-stroke" markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
      {lbl(a1, a2, `${p.width.toFixed(2)} m`)}
      {lbl(b1, b2, `${p.depth.toFixed(2)} m`)}
    </g>
  );
}
