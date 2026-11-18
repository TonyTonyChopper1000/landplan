import { useMemo, useRef, useState } from 'react';
import { useScenarios } from '@/state/scenarios';
import { useProject } from '@/state/project';
import { computeCached } from '@/state/derived';
import { bbox } from '@/engine/geometry';
import { roadsTotal } from '@/engine/areas';
import { Button, Caps, Select } from '@/components/ui/controls';
import { fmtInt } from '@/lib/format';
import { t } from '@/i18n';
import { StaticPlan } from './StaticPlan';

type K = { label: string; get: (d: ReturnType<typeof computeCached>) => number; fmt: (n: number) => string; better: 'up' | 'down' };
const KPIS: K[] = [
  { label: 'Plots', get: (d) => d.layout?.plots.length ?? 0, fmt: (n) => fmtInt(n), better: 'up' },
  { label: 'Plotted m²', get: (d) => d.layout?.plotted ?? 0, fmt: (n) => fmtInt(n), better: 'up' },
  { label: 'Saleable %', get: (d) => (d.layout ? (d.layout.plotted / d.layout.gross) * 100 : 0), fmt: (n) => n.toFixed(2), better: 'up' },
  { label: 'Roads %', get: (d) => (d.layout ? (roadsTotal(d.layout) / d.layout.gross) * 100 : 0), fmt: (n) => n.toFixed(2), better: 'down' },
  { label: 'Open %', get: (d) => (d.layout ? (d.layout.openArea / d.layout.gross) * 100 : 0), fmt: (n) => n.toFixed(2), better: 'up' },
  { label: 'Revenue', get: (d) => d.fin?.revenue ?? 0, fmt: (n) => `${(n / 1e7).toFixed(2)} Cr`, better: 'up' },
  { label: 'Margin %', get: (d) => d.fin?.marginPct ?? 0, fmt: (n) => n.toFixed(1), better: 'up' },
  { label: 'NPV', get: (d) => d.fin?.npv ?? 0, fmt: (n) => `${(n / 1e7).toFixed(2)} Cr`, better: 'up' },
  { label: 'Failing checks', get: (d) => d.tally.failing, fmt: (n) => String(n), better: 'down' },
];

export function CompareView() {
  const { scenarios, activeId, compare, setCompare, duplicate } = useScenarios();
  const live = useProject((s) => s.params);
  const paramsOf = (id: string) => (id === activeId ? live : scenarios.find((s) => s.id === id)?.params ?? live);
  const a = computeCached(paramsOf(compare[0]));
  const b = computeCached(paramsOf(compare[1]));
  const [split, setSplit] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const view = useMemo(() => (a.layout && b.layout ? bbox([...a.layout.parcel, ...b.layout.parcel]) : null), [a.layout, b.layout]);
  const opts = scenarios.map((s) => ({ value: s.id, label: s.name }));
  const drag = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative min-h-[320px] flex-1">
        <div className="absolute top-2 right-2 left-2 z-10 flex flex-wrap items-center gap-2">
          <div className="w-44"><Select label={t('compare.pickA')} value={compare[0]} options={opts} onChange={(v) => setCompare(v, compare[1])} /></div>
          <span className="caps text-[10px] text-lane-dim">vs</span>
          <div className="w-44"><Select label={t('compare.pickB')} value={compare[1]} options={opts} onChange={(v) => setCompare(compare[0], v)} /></div>
          {scenarios.length < 2 && (
            <Button size="sm" variant="blue" onClick={() => duplicate()}>
              Duplicate current to compare
            </Button>
          )}
        </div>
        <div ref={box} className="drafting-grid absolute inset-0 top-12 select-none" onPointerMove={(e) => e.buttons === 1 && drag(e)} onPointerDown={drag}>
          {a.layout && b.layout && view && (
            <>
              <div className="absolute inset-0">
                <StaticPlan layout={b.layout} view={view} label="Scenario B plan" />
              </div>
              <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                <div className="absolute inset-0 bg-asphalt" />
                <div className="drafting-grid absolute inset-0">
                  <StaticPlan layout={a.layout} view={view} label="Scenario A plan" />
                </div>
              </div>
              <div
                role="slider"
                aria-label="Swipe divider"
                aria-valuenow={Math.round(split)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - 5));
                  if (e.key === 'ArrowRight') setSplit((s) => Math.min(100, s + 5));
                }}
                className="absolute top-0 bottom-0 w-[2px] cursor-ew-resize bg-signal shadow-[var(--glow-signal)]"
                style={{ left: `${split}%` }}
              >
                <span className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-signal bg-asphalt-2 text-[10px] text-signal">⇆</span>
              </div>
              <span className="caps absolute bottom-2 left-3 text-[10px] text-lane-dim">A · {scenarios.find((s) => s.id === compare[0])?.name}</span>
              <span className="caps absolute right-3 bottom-2 text-[10px] text-lane-dim">B · {scenarios.find((s) => s.id === compare[1])?.name}</span>
            </>
          )}
        </div>
      </div>
      <aside className="w-full shrink-0 border-t border-line bg-asphalt-2 p-3 lg:w-[400px] lg:border-t-0 lg:border-l">
        <Caps className="pb-2">KPI deltas (B − A)</Caps>
        <table className="num w-full text-[11.5px] [&_td]:whitespace-nowrap [&_td]:pl-2">
          <thead className="text-lane-dim">
            <tr><th className="text-left font-normal" /><th className="text-right font-normal">A</th><th className="text-right font-normal">B</th><th className="text-right font-normal">Δ</th></tr>
          </thead>
          <tbody>
            {KPIS.map((k) => {
              const va = k.get(a);
              const vb = k.get(b);
              const d = vb - va;
              const good = Math.abs(d) < 1e-9 ? 'text-lane-dim' : (d > 0) === (k.better === 'up') ? 'text-green-ink' : 'text-brake-ink';
              return (
                <tr key={k.label} className="border-t border-line/60">
                  <td className="py-1">{k.label}</td>
                  <td className="text-right">{k.fmt(va)}</td>
                  <td className="text-right">{k.fmt(vb)}</td>
                  <td className={`text-right ${good}`}>{d > 0 ? '+' : ''}{k.fmt(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-lane-dim">Drag the orange divider (or use ←/→) to swipe between the two plans.</p>
      </aside>
    </div>
  );
}
