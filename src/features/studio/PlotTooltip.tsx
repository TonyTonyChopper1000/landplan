import { useProject } from '@/state/project';
import { plotPrice } from '@/engine/finance';
import { SQYD } from '@/engine/geometry';
import type { Plot } from '@/engine/types';
import { fmtInt, money } from '@/lib/format';
import { bandColor } from './style';

export function PlotTooltip({ plot, x, y, w }: { plot: Plot; x: number; y: number; w: number }) {
  const params = useProject((s) => s.params);
  const left = x + 220 > w ? x - 212 : x + 16;
  return (
    <div className="pointer-events-none absolute z-10 w-[196px] rounded-[4px] border border-line bg-asphalt-2/95 p-2 text-[11.5px] shadow-xl backdrop-blur" style={{ left, top: Math.max(8, y - 20) }} role="tooltip">
      <div className="flex items-center justify-between">
        <span className="mono text-[13px] font-semibold">Plot {plot.no}</span>
        <span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: bandColor(plot) }} />
      </div>
      <dl className="num mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-lane-dim">Size</dt>
        <dd className="text-right">
          {fmtInt(plot.area / SQYD)} yd² · {fmtInt(plot.area)} m²
        </dd>
        <dt className="text-lane-dim">Dims</dt>
        <dd className="text-right">
          {plot.width.toFixed(2)} × {plot.depth.toFixed(2)} m
        </dd>
        <dt className="text-lane-dim">Facing</dt>
        <dd className="text-right">
          {plot.facing}
          {plot.corner ? ' · corner' : ''}
          {plot.irregular ? ' · irregular' : ''}
        </dd>
        <dt className="text-lane-dim">Price</dt>
        <dd className="text-right text-signal-ink">{money(plotPrice(plot, params))}</dd>
      </dl>
      {plot.mortgaged && <div className="caps mt-1 text-[10px] text-signal-ink">Mortgaged</div>}
    </div>
  );
}
