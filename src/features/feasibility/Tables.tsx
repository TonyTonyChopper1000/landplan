import type { Layout } from '@/engine/types';
import { DIRS } from '@/engine/types';
import { SQYD } from '@/engine/geometry';
import { useUi } from '@/state/ui';
import { area as fmtArea, fmtInt } from '@/lib/format';

const th = 'px-2 py-1.5 text-left font-normal text-lane-dim';
const td = 'px-2 py-1';

export function RoadRuns({ layout }: { layout: Layout }) {
  return (
    <div className="overflow-x-auto rounded-[4px] border border-line">
      <table className="num w-full text-[11.5px]">
        <caption className="sr-only">Road runs</caption>
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Run</th>
            <th className={th}>Type</th>
            <th className={`${th} text-right`}>Length</th>
            <th className={`${th} text-right`}>Width</th>
            <th className={`${th} text-right`}>Req. ROW</th>
            <th className={`${th} text-right`}>Splay</th>
            <th className={th}>C/way</th>
          </tr>
        </thead>
        <tbody>
          {layout.roadRuns.map((r) => {
            const bad = r.requiredRow !== null && r.width + 0.01 < r.requiredRow;
            return (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className={`${td} mono`}>{r.id}</td>
                <td className={td}>{r.axis}</td>
                <td className={`${td} text-right`}>{r.length.toFixed(1)} m</td>
                <td className={`${td} text-right ${bad ? 'text-brake-ink' : ''}`}>{r.width.toFixed(1)} m</td>
                <td className={`${td} text-right`}>{r.requiredRow ?? '—'} m</td>
                <td className={`${td} text-right`}>{r.splay ?? '—'} m</td>
                <td className={td}>{r.carriageway}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AreaStatement({ layout }: { layout: Layout }) {
  const units = useUi((s) => s.units);
  const sum = layout.areaLines.reduce((s, l) => s + l.m2, 0);
  return (
    <div className="rounded-[4px] border border-line">
      <table className="num w-full text-[12px]">
        <caption className="sr-only">Area statement</caption>
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Use</th>
            <th className={`${th} text-right`}>Area</th>
            <th className={`${th} text-right`}>m²</th>
            <th className={`${th} text-right`}>% gross</th>
          </tr>
        </thead>
        <tbody>
          {layout.areaLines.map((l) => (
            <tr key={l.key} className="border-b border-line/60">
              <td className={td}>{l.label}</td>
              <td className={`${td} text-right`}>{fmtArea(l.m2, units)}</td>
              <td className={`${td} text-right`}>{fmtInt(l.m2)}</td>
              <td className={`${td} text-right`}>{((l.m2 / layout.gross) * 100).toFixed(2)}%</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td}>Gross</td>
            <td className={`${td} text-right`}>{fmtArea(layout.gross, units)}</td>
            <td className={`${td} text-right`}>{fmtInt(sum)}</td>
            <td className={`${td} text-right`}>{((sum / layout.gross) * 100).toFixed(2)}%</td>
          </tr>
          {layout.netLayout !== layout.gross && (
            <tr className="text-lane-dim">
              <td className={td}>Net layout (after MP give-up)</td>
              <td className={`${td} text-right`}>{fmtArea(layout.netLayout, units)}</td>
              <td className={`${td} text-right`}>{fmtInt(layout.netLayout)}</td>
              <td className={td} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PlotMix({ layout }: { layout: Layout }) {
  const bySize = new Map<number, { n: number; a: number }>();
  for (const p of layout.plots) {
    const e = bySize.get(p.sizeSqYd) ?? { n: 0, a: 0 };
    e.n++;
    e.a += p.area;
    bySize.set(p.sizeSqYd, e);
  }
  const byFacing = DIRS.map((d) => ({ d, n: layout.plots.filter((p) => p.facing === d).length }));
  const max = Math.max(1, ...byFacing.map((f) => f.n));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <table className="num w-full rounded-[4px] border border-line text-[12px]">
        <caption className="sr-only">Plot mix by size</caption>
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Size</th>
            <th className={`${th} text-right`}>Plots</th>
            <th className={`${th} text-right`}>Actual sq yd</th>
          </tr>
        </thead>
        <tbody>
          {[...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([s, e]) => (
            <tr key={s} className="border-b border-line/60 last:border-0">
              <td className={td}>{s} sq yd</td>
              <td className={`${td} text-right`}>{e.n}</td>
              <td className={`${td} text-right`}>{fmtInt(e.a / SQYD)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded-[4px] border border-line p-2">
        <div className="caps pb-1 text-[10.5px] text-lane-dim">Facing</div>
        {byFacing.map((f) => (
          <div key={f.d} className="num grid grid-cols-[28px_1fr_32px] items-center gap-2 text-[11.5px]">
            <span className="mono">{f.d}</span>
            <span className="h-2 rounded-[1px] bg-blueprint/70" style={{ width: `${(f.n / max) * 100}%` }} />
            <span className="text-right">{f.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
