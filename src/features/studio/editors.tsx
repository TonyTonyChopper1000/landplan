import { useProject, setSection, setParam } from '@/state/project';
import { useUi } from '@/state/ui';
import { newId } from '@/state/scenarios';
import type { Pt } from '@/engine/geometry';
import type { ConstraintKind } from '@/engine/types';

const snap = (p: Pt): Pt => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Vertex handles for the drawn parcel. Drag to move, click a midpoint to add, Alt-click to delete. */
export function ParcelEditor({ s, toWorld }: { s: number; toWorld: (x: number, y: number) => Pt }) {
  const poly = useProject((st) => st.params.site.polygon);
  if (!poly) return null;
  const r = 6 / s;
  const startDrag = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.altKey) {
      if (poly.length > 3) setSection('site', { polygon: poly.filter((_, j) => j !== i), bearings: [] });
      return;
    }
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const w = snap(toWorld(ev.clientX - rect.left, ev.clientY - rect.top));
      const cur = useProject.getState().params.site.polygon ?? poly;
      setSection('site', { polygon: cur.map((q, j) => (j === i ? w : q)), bearings: [] });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <g>
      {poly.map((q, i) => {
        const n = poly[(i + 1) % poly.length];
        const m = { x: (q.x + n.x) / 2, y: (q.y + n.y) / 2 };
        return (
          <circle
            key={`m${i}`}
            cx={m.x}
            cy={-m.y}
            r={r * 0.7}
            fill="var(--asphalt)"
            stroke="var(--blueprint)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className="cursor-copy"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = [...poly];
              next.splice(i + 1, 0, snap(m));
              setSection('site', { polygon: next, bearings: [] });
            }}
          >
            <title>Add vertex</title>
          </circle>
        );
      })}
      {poly.map((q, i) => (
        <rect
          key={`v${i}`}
          x={q.x - r}
          y={-q.y - r}
          width={2 * r}
          height={2 * r}
          fill="var(--signal)"
          stroke="var(--asphalt)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className="cursor-move"
          onPointerDown={startDrag(i)}
        >
          <title>{`Vertex ${i + 1} — drag; Alt-click deletes`}</title>
        </rect>
      ))}
    </g>
  );
}

export function finishConstraint(kind: ConstraintKind, pts: Pt[]) {
  const min = kind === 'lake' ? 3 : kind === 'heritage' ? 1 : 2;
  if (pts.length < min) return;
  const cs = useProject.getState().params.constraints;
  const extra = kind === 'nala' ? { widthM: 6 } : kind === 'ht' ? { voltageKv: 132, towerBase: 8 } : {};
  setParam('constraints', [...cs, { id: newId('c'), kind, pts: pts.map(snap), ...extra }]);
  useUi.setState({ tool: 'select', panel: 'constraints' });
}

export function DraftShape({ kind, pts, cursor }: { kind: ConstraintKind; pts: Pt[]; cursor: Pt | null }) {
  const all = cursor ? [...pts, cursor] : pts;
  if (!all.length) return null;
  return (
    <g pointerEvents="none">
      <polyline
        points={all.map((q) => `${q.x},${-q.y}`).join(' ') + (kind === 'lake' && all.length > 2 ? ` ${all[0].x},${-all[0].y}` : '')}
        fill={kind === 'lake' ? 'var(--blueprint)' : 'none'}
        fillOpacity={0.15}
        stroke="var(--blueprint)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
      {pts.map((q, i) => (
        <circle key={i} cx={q.x} cy={-q.y} r={3} fill="var(--blueprint)" vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}
