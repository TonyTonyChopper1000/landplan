import { useDerived } from '@/state/derived';
import { useProject, setParam } from '@/state/project';
import { useUi } from '@/state/ui';
import { rotateGrid } from '@/state/actions';
import { plotPrice } from '@/engine/finance';
import { SQYD } from '@/engine/geometry';
import type { Plot, PlotStatus } from '@/engine/types';
import { Button, Caps, NumberInput, Badge } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { area as fmtArea, fmtInt, money } from '@/lib/format';
import { t } from '@/i18n';
import { bandColor } from './style';

export const STATUSES: PlotStatus[] = ['Available', 'Held', 'Booked', 'Sold', 'Mortgaged'];
export const statusOf = (p: Plot, inv: Record<number, { status?: PlotStatus }>): PlotStatus => inv[p.no]?.status ?? (p.mortgaged ? 'Mortgaged' : 'Available');

function setStatus(nos: number[], status: PlotStatus) {
  const inv = { ...useProject.getState().params.inventory };
  for (const n of nos) inv[n] = { ...inv[n], status };
  setParam('inventory', inv);
}

function PlotCard({ p }: { p: Plot }) {
  const params = useProject((s) => s.params);
  const units = useUi((s) => s.units);
  const inv = params.inventory[p.no];
  const status = statusOf(p, params.inventory);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="mono text-2xl font-semibold">
          <span className="text-lane-dim">#</span>
          {p.no}
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] text-lane-dim">
          <i className="h-2.5 w-2.5 rounded-[1px]" style={{ background: bandColor(p) }} />
          {p.sizeSqYd} sq yd nominal
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone="blue">{p.facing} facing</Badge>
        {p.corner && <Badge tone="signal">Corner +{Math.round(params.money.corner * 100)}%</Badge>}
        {p.irregular && <Badge tone="unk">Irregular −{Math.round(params.money.irregular * 100)}%</Badge>}
        {p.mortgaged && <Badge tone="signal">Mortgaged</Badge>}
      </div>
      <dl className="num grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        <dt className="text-lane-dim">Area</dt>
        <dd className="text-right">{fmtArea(p.area, units)}</dd>
        <dt className="text-lane-dim">m²</dt>
        <dd className="text-right">{p.area.toFixed(2)}</dd>
        <dt className="text-lane-dim">Width × depth</dt>
        <dd className="text-right">
          {p.width.toFixed(2)} × {p.depth.toFixed(2)} m
        </dd>
        <dt className="text-lane-dim">Multiplier</dt>
        <dd className="text-right">×{p.multiplier.toFixed(3)}</dd>
        <dt className="text-lane-dim">Price</dt>
        <dd className="text-right text-signal-ink">{money(plotPrice(p, params))}</dd>
      </dl>
      <div>
        <Caps className="pb-1">Status</Caps>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={status === s ? 'blue' : 'outline'} aria-pressed={status === s} onClick={() => setStatus([p.no], s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>
      <label className="block">
        <Caps className="pb-1">Price override (₹)</Caps>
        <NumberInput
          label="Price override"
          value={inv?.price ?? 0}
          step={10000}
          min={0}
          onChange={(v) => setParam('inventory', { ...params.inventory, [p.no]: { ...inv, price: v || undefined } })}
        />
        <span className="text-[10.5px] text-lane-dim">0 uses rate × size × multiplier</span>
      </label>
    </div>
  );
}

function Bulk({ plots }: { plots: Plot[] }) {
  const params = useProject((s) => s.params);
  const units = useUi((s) => s.units);
  const area = plots.reduce((s, p) => s + p.area, 0);
  const value = plots.reduce((s, p) => s + plotPrice(p, params), 0);
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">
        <span className="num">{plots.length}</span> plots selected
      </h3>
      <dl className="num grid grid-cols-2 gap-1.5 text-[12px]">
        <dt className="text-lane-dim">Total area</dt>
        <dd className="text-right">{fmtArea(area, units)}</dd>
        <dt className="text-lane-dim">Value</dt>
        <dd className="text-right text-signal-ink">{money(value)}</dd>
      </dl>
      <Caps>Set status for all</Caps>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => setStatus(plots.map((p) => p.no), s)}>
            {s}
          </Button>
        ))}
      </div>
      <Button size="sm" onClick={() => useUi.setState({ selected: [] })}>
        Clear selection
      </Button>
    </div>
  );
}

function LayoutSummary() {
  const layout = useDerived((s) => s.layout);
  const grid = useProject((s) => s.params.grid);
  if (!layout) return null;
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-lane-dim">{t('inspector.empty')}</p>
      <Caps>Grid</Caps>
      <dl className="num grid grid-cols-2 gap-1.5 text-[12px]">
        <dt className="text-lane-dim">Angle θ</dt>
        <dd className="text-right">{grid.theta}°</dd>
        <dt className="text-lane-dim">Block length</dt>
        <dd className="text-right">{layout.blockLen.toFixed(1)} m</dd>
        <dt className="text-lane-dim">Offsets</dt>
        <dd className="text-right">
          {grid.offX.toFixed(2)} / {grid.offY.toFixed(2)}
        </dd>
        <dt className="text-lane-dim">Roads</dt>
        <dd className="text-right">
          {layout.frontage} / {layout.spine} m
        </dd>
        <dt className="text-lane-dim">Blocks</dt>
        <dd className="text-right">{layout.blocks.length}</dd>
        <dt className="text-lane-dim">Road runs</dt>
        <dd className="text-right">{layout.roadRuns.length}</dd>
      </dl>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => rotateGrid(-5)} title="Rotate −5° ([)">
          <Icon name="rotate" size={13} className="-scale-x-100" /> −5°
        </Button>
        <Button size="sm" variant="outline" onClick={() => rotateGrid(5)} title="Rotate +5° (])">
          <Icon name="rotate" size={13} /> +5°
        </Button>
      </div>
      <Caps>Area statement</Caps>
      <dl className="num grid grid-cols-[1fr_auto] gap-1 text-[11.5px]">
        {layout.areaLines.filter((l) => l.m2 > 0.5).map((l) => (
          <div key={l.key} className="contents">
            <dt className="text-lane-dim">{l.label}</dt>
            <dd className="text-right">{fmtInt(l.m2)} m²</dd>
          </div>
        ))}
      </dl>
      <p className="num text-[10.5px] text-lane-dim">{fmtInt(layout.plotted / SQYD)} sq yd plotted</p>
    </div>
  );
}

export function Inspector() {
  const layout = useDerived((s) => s.layout);
  const selected = useUi((s) => s.selected);
  const hover = useUi((s) => s.hover);
  if (!layout) return null;
  const sel = layout.plots.filter((p) => selected.includes(p.no));
  const hov = hover !== null && !sel.length ? layout.plots.find((p) => p.no === hover) : undefined;
  return (
    <div className="p-3">
      <Caps className="pb-2">Inspector</Caps>
      {sel.length === 1 ? <PlotCard p={sel[0]} /> : sel.length > 1 ? <Bulk plots={sel} /> : hov ? <PlotCard p={hov} /> : <LayoutSummary />}
    </div>
  );
}
