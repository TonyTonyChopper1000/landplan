import type { Pt } from '@/engine/geometry';
import { useUi, type Tool } from '@/state/ui';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/controls';
import { t } from '@/i18n';
import { BAND_LEGEND } from './style';

export function NorthArrow({ offset }: { offset: number }) {
  return (
    <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-center" aria-label={`North arrow, ${offset}° offset`}>
      <svg width="44" height="56" viewBox="-22 -30 44 56" style={{ transform: `rotate(${-offset}deg)` }}>
        <circle r="16" fill="none" stroke="var(--line)" />
        <path d="M0 -24 7 10 0 4 -7 10z" fill="var(--lane)" fillOpacity="0.15" stroke="var(--lane)" strokeWidth="1" />
        <path d="M0 -24 0 4 -7 10z" fill="var(--lane)" />
        <text y="22" textAnchor="middle" fontSize="9" className="mono" fill="var(--lane)">N</text>
      </svg>
    </div>
  );
}

const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
export function ScaleBar({ s }: { s: number }) {
  const target = 120 / s;
  const m = NICE.find((n) => n >= target * 0.6) ?? 1000;
  const px = m * s;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-[3px] bg-asphalt/70 px-2 py-1 backdrop-blur" aria-label={`Scale bar ${m} metres`}>
      <svg width={px + 2} height="14">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={1 + (i * px) / 4} y="2" width={px / 4} height="4" fill={i % 2 ? 'var(--asphalt)' : 'var(--lane)'} stroke="var(--lane)" strokeWidth="0.75" />
        ))}
      </svg>
      <div className="num flex justify-between text-[10px] text-lane-dim">
        <span>0</span>
        <span>{m} m</span>
      </div>
    </div>
  );
}

export function Coords({ p }: { p: Pt | null }) {
  return (
    <div className="num pointer-events-none absolute right-3 bottom-3 rounded-[3px] bg-asphalt/70 px-2 py-1 text-[10.5px] text-lane-dim backdrop-blur">
      X {p ? p.x.toFixed(1).padStart(7) : '      —'} m · Y {p ? p.y.toFixed(1).padStart(7) : '      —'} m
    </div>
  );
}

export function Stamp() {
  return (
    <div className="caps pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-[2px] border border-signal/60 px-2 py-0.5 text-[10px] text-signal-ink">
      {t('app.disclaimer')}
    </div>
  );
}

export function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-14 left-3 hidden flex-col gap-0.5 rounded-[3px] bg-asphalt/70 px-2 py-1.5 text-[10px] text-lane-dim backdrop-blur md:flex">
      <span className="caps text-[9.5px]">Plot size · sq yd</span>
      {BAND_LEGEND.map((b) => (
        <span key={b.label} className="flex items-center gap-1.5">
          <i className="inline-block h-2 w-3 rounded-[1px] border" style={{ borderColor: b.color, background: `color-mix(in srgb, ${b.color} 30%, transparent)` }} />
          {b.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <svg width="12" height="8"><rect width="12" height="8" fill="url(#hatch-mort)" stroke="var(--signal)" strokeWidth=".5" /></svg>
        Mortgaged
      </span>
    </div>
  );
}

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'select', icon: 'cursor', label: 'Select (V)' },
  { id: 'lasso', icon: 'lasso', label: 'Lasso select (L or Shift-drag)' },
  { id: 'parcel', icon: 'edit', label: 'Edit parcel vertices' },
];

export function Toolbar({ onZoom, onFit }: { onZoom: (f: number) => void; onFit: () => void }) {
  const tool = useUi((s) => s.tool);
  return (
    <div className="absolute top-12 right-3 flex flex-col gap-1 rounded-[4px] border border-line bg-asphalt-2/90 p-1 backdrop-blur" role="toolbar" aria-label="Plan tools">
      {TOOLS.map((x) => (
        <button
          key={x.id}
          type="button"
          title={x.label}
          aria-label={x.label}
          aria-pressed={tool === x.id}
          onClick={() => useUi.setState({ tool: x.id })}
          className={cx('flex h-7 w-7 items-center justify-center rounded-[3px]', tool === x.id ? 'bg-asphalt-3 text-signal' : 'text-lane-dim hover:text-lane')}
        >
          <Icon name={x.icon} size={15} />
        </button>
      ))}
      <span className="my-0.5 h-px bg-line" />
      <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => onZoom(1.3)} className="flex h-7 w-7 items-center justify-center text-lane-dim hover:text-lane">
        <Icon name="plus" size={15} />
      </button>
      <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => onZoom(1 / 1.3)} className="flex h-7 w-7 items-center justify-center text-lane-dim hover:text-lane">
        <span className="h-px w-3 bg-current" />
      </button>
      <button type="button" title="Fit to parcel" aria-label="Fit to parcel" onClick={onFit} className="flex h-7 w-7 items-center justify-center text-lane-dim hover:text-lane">
        <Icon name="target" size={15} />
      </button>
    </div>
  );
}
