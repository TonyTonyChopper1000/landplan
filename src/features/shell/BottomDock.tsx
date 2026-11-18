import { motion, useReducedMotion } from 'motion/react';
import { useDerived } from '@/state/derived';
import { useUi } from '@/state/ui';
import { line, roadsTotal } from '@/engine/areas';
import { ACRE, SQYD } from '@/engine/geometry';
import { Ticker } from '@/components/ui/Ticker';
import { area as fmtArea, fmtInt } from '@/lib/format';
import { t } from '@/i18n';

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const int = (n: number) => fmtInt(n);
const cr = (n: number) => `₹${(n / 1e7).toFixed(2)}`;

export const LAND_SEGMENTS = [
  { key: 'plots', label: 'Plots', color: 'var(--blueprint)' },
  { key: 'roads', label: 'Roads', color: 'var(--road-edge)' },
  { key: 'park', label: 'Open space', color: 'var(--sign-green)' },
  { key: 'util', label: 'Utilities', color: 'var(--band-1)' },
  { key: 'social', label: 'Social infra', color: 'var(--band-3)' },
  { key: 'buffers', label: 'Buffers', color: 'color-mix(in srgb, var(--conflict) 45%, transparent)' },
  { key: 'slivers', label: 'Slivers', color: 'var(--unk)' },
] as const;

export function landShares(l: NonNullable<ReturnType<typeof useDerived.getState>['layout']>) {
  const v: Record<string, number> = {
    plots: line(l, 'plots'),
    roads: l.params.mode === 'parity' && !l.buffers.length ? line(l, 'roads') : roadsTotal(l),
    park: line(l, 'park'),
    util: line(l, 'util'),
    social: line(l, 'social'),
    buffers: line(l, 'buffers'),
    slivers: line(l, 'slivers'),
  };
  return v;
}

export function LandBar() {
  const layout = useDerived((s) => s.layout);
  const reduce = useReducedMotion();
  if (!layout) return <div className="skeleton h-2 rounded-[2px]" />;
  const v = landShares(layout);
  const total = layout.gross || 1;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-[2px] bg-asphalt" role="img" aria-label={LAND_SEGMENTS.map((s) => `${s.label} ${((v[s.key] / total) * 100).toFixed(1)}%`).join(', ')}>
        {LAND_SEGMENTS.map((s) => (
          <motion.div
            key={s.key}
            className="h-full"
            style={{ background: s.color }}
            initial={false}
            animate={{ width: `${(Math.max(0, v[s.key]) / total) * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          />
        ))}
      </div>
      <div className="mt-1 hidden flex-wrap gap-x-3 gap-y-0.5 md:flex">
        {LAND_SEGMENTS.filter((s) => v[s.key] > 0.5).map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[10.5px] text-lane-dim">
            <i className="inline-block h-2 w-2 rounded-[1px]" style={{ background: s.color }} />
            {s.label} <span className="num text-lane">{((v[s.key] / total) * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, format, unit, tone }: { label: string; value: number; format: (n: number) => string; unit?: string; tone?: string }) {
  return (
    <div className="flex min-w-[96px] shrink-0 snap-start flex-col rounded-[4px] px-2 py-1 max-md:min-w-[128px] max-md:border max-md:border-line">
      <span className="caps text-[10px] text-lane-dim">{label}</span>
      <span className={`text-[15px] leading-tight ${tone ?? ''}`}>
        <Ticker value={value} format={format} />
        {unit && <span className="ml-0.5 text-[11px] text-lane-dim">{unit}</span>}
      </span>
    </div>
  );
}

export function BottomDock() {
  const layout = useDerived((s) => s.layout);
  const fin = useDerived((s) => s.fin);
  const ms = useDerived((s) => s.ms);
  const units = useUi((s) => s.units);
  if (!layout || !fin) return <div className="h-[74px] border-t border-line bg-asphalt-2" />;
  const g = layout.gross || 1;
  const v = landShares(layout);
  const avg = layout.plots.length ? layout.plotted / layout.plots.length : 0;
  return (
    <footer className="border-t border-line bg-asphalt-2 px-3 pt-1.5 pb-2">
      <div className="flex snap-x snap-mandatory items-stretch gap-1 overflow-x-auto pb-1 md:gap-0 md:divide-x md:divide-line">
        <Kpi label={t('kpi.gross')} value={layout.gross / ACRE} format={f2} unit="ac" />
        <Kpi label={t('kpi.plots')} value={layout.plots.length} format={int} />
        <Kpi label={t('kpi.saleable')} value={(layout.plotted / g) * 100} format={f1} unit="%" tone="text-blueprint" />
        <Kpi label={t('kpi.roads')} value={(v.roads / g) * 100} format={f1} unit="%" />
        <Kpi label={t('kpi.open')} value={((v.park + v.util + v.social) / g) * 100} format={f1} unit="%" tone="text-green-ink" />
        <Kpi label={t('kpi.avg')} value={units === 'sqyd' ? avg / SQYD : avg} format={int} unit={units === 'sqyd' ? 'yd²' : 'm²'} />
        <Kpi label={t('kpi.sellable')} value={fin.sellableNow} format={cr} unit="Cr" tone="text-signal-ink" />
        <Kpi label={t('kpi.mortgaged')} value={fin.mortgagedValue} format={cr} unit="Cr" />
        <Kpi label={t('kpi.margin')} value={fin.marginPct} format={f1} unit="%" tone={fin.marginPct < 0 ? 'text-brake-ink' : 'text-green-ink'} />
        <div className="ml-auto hidden flex-col items-end justify-center px-2 text-[10px] text-lane-dim xl:flex">
          <span className="num">{ms.toFixed(1)} ms regen</span>
          <span className="num">{fmtArea(layout.plotted, units)} plotted</span>
        </div>
      </div>
      <LandBar />
    </footer>
  );
}
