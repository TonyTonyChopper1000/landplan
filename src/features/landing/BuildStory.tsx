import { useMemo, useRef, useState } from 'react';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { bbox, regionToPath, polyToPath } from '@/engine/geometry';
import type { Layout } from '@/engine/types';
import { bandColor } from '@/features/studio/style';
import { roadsTotal } from '@/engine/areas';

const STAGES = [
  { k: 'Parcel', t: 'Your boundary', d: 'A preset, a traced satellite outline, a bearings traverse or a GeoJSON / KML / DXF import — cleaned, projected to UTM 44N and reconciled with the title area.' },
  { k: 'Roads', t: 'A road network that passes', d: 'Frontage and spine roads on the best of 486 grid orientations, widths checked against GO 105 Table I, junction splays cut at every corner.' },
  { k: 'Open space', t: 'Parks that count', d: 'Ten percent of the net area carved as road-bounded parks, a utility strip on a road, buffers deducted around lakes, nalas and HT lines.' },
  { k: 'Plots', t: 'Every foot sold', d: 'Whole-foot plot widths packed by dynamic programming to your size mix, numbered serpentine from the entry, faced and priced.' },
  { k: 'Numbers', t: 'A decision, not a drawing', d: 'Area statement, cited compliance, mortgaged plot ranges, cash flow, IRR and NPV — updated the instant you move a slider.' },
];

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function BuildStory({ layout }: { layout: Layout }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [p, setP] = useState(reduce ? 1 : 0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => !reduce && setP(Math.round(v * 200) / 200));
  const stage = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
  const local = (i: number) => clamp(p * STAGES.length - i);
  const b = bbox(layout.parcel);
  const pad = 30;
  const sorted = useMemo(() => [...layout.plots].sort((a, b2) => Math.hypot(a.centroid.x, a.centroid.y) - Math.hypot(b2.centroid.x, b2.centroid.y)), [layout]);
  const shown = Math.round(sorted.length * local(3));
  const kpi = local(4);
  const roads = roadsTotal(layout);
  return (
    <section ref={ref} className="relative h-[480vh] max-md:h-auto" aria-label="How a layout is built">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden max-md:relative max-md:h-auto max-md:py-20">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-10 px-4 md:grid-cols-[0.9fr_1.1fr] md:px-6">
          <div>
            <div className="caps text-[11px] text-blueprint">Watch it think</div>
            <h2 className="mt-2 text-[clamp(30px,4.2vw,56px)] leading-[1] font-semibold tracking-tight">Five passes. Under two seconds.</h2>
            <ol className="mt-10 space-y-1">
              {STAGES.map((s, i) => {
                const on = i === stage;
                return (
                  <li key={s.k} className={`relative border-l-2 py-3 pl-5 transition-all duration-300 ${on ? 'border-signal' : i < stage ? 'border-blueprint/50' : 'border-line'}`}>
                    <div className="flex items-baseline gap-3">
                      <span className={`mono text-[11px] ${on ? 'text-signal' : 'text-lane-dim'}`}>0{i + 1}</span>
                      <span className={`text-[18px] font-semibold transition-colors ${on ? 'text-lane' : 'text-lane-dim'}`}>{s.t}</span>
                    </div>
                    <p className={`overflow-hidden text-[13.5px] leading-relaxed text-lane-dim transition-all duration-300 ${on || reduce ? 'mt-2 max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>{s.d}</p>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="relative">
            <div className="noise drafting-grid relative aspect-square overflow-hidden rounded-[12px] border border-line shadow-[0_40px_120px_-40px_rgba(63,193,217,.35)]">
              <svg viewBox={`${b.x0 - pad} ${-b.y1 - pad} ${b.x1 - b.x0 + 2 * pad} ${b.y1 - b.y0 + 2 * pad}`} className="absolute inset-0 h-full w-full" aria-hidden>
                <path d={polyToPath(layout.parcel)} fill="var(--road)" fillOpacity={0.35 + 0.5 * local(0)} stroke="var(--blueprint)" strokeWidth={2} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - local(0)} />
                {layout.roadRuns.map((r) => (
                  <line key={r.id} x1={r.a.x} y1={-r.a.y} x2={r.b.x} y2={-r.b.y} stroke="var(--signal)" strokeWidth={2.2} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - local(1)} />
                ))}
                {layout.splays.length > 0 && <path d={regionToPath(layout.splays)} fill="var(--signal)" opacity={local(1) * 0.5} />}
                {layout.open.map((o) => (
                  <path key={o.id} d={regionToPath(o.region)} fill="var(--park)" stroke="var(--sign-green)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={local(2)} />
                ))}
                {sorted.slice(0, shown).map((pl) => {
                  const c = bandColor(pl);
                  return <path key={pl.no} d={regionToPath(pl.region)} fill={`color-mix(in srgb, ${c} 28%, transparent)`} stroke={c} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />;
                })}
                {kpi > 0 &&
                  layout.plots
                    .filter((pl) => pl.mortgaged)
                    .map((pl) => <path key={`m${pl.no}`} d={regionToPath(pl.region)} fill="var(--signal)" fillOpacity={0.22 * kpi} />)}
              </svg>
              <div className="absolute top-3 left-3 rounded-[4px] bg-asphalt/80 px-2 py-1 text-[11px] backdrop-blur">
                <span className="mono text-signal">0{stage + 1}</span> <span className="text-lane-dim">/ {STAGES[stage].k}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 transition-opacity duration-300" style={{ opacity: 0.25 + 0.75 * kpi }}>
              {[
                { l: 'Plots', v: String(Math.round(layout.plots.length * kpi)) },
                { l: 'Saleable', v: `${((layout.plotted / layout.gross) * 100 * kpi).toFixed(1)}%` },
                { l: 'Roads', v: `${((roads / layout.gross) * 100 * kpi).toFixed(1)}%` },
                { l: 'Open', v: `${((layout.openArea / layout.gross) * 100 * kpi).toFixed(1)}%` },
              ].map((k) => (
                <div key={k.l} className="rounded-[6px] border border-line bg-asphalt-2 px-3 py-2">
                  <div className="caps text-[9.5px] text-lane-dim">{k.l}</div>
                  <div className="mono text-[17px] font-semibold">{k.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
