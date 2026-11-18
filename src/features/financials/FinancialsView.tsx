import { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDerived } from '@/state/derived';
import { useProject } from '@/state/project';
import { tornado } from '@/engine/finance';
import { Caps } from '@/components/ui/controls';
import { Ticker } from '@/components/ui/Ticker';
import { crore, money, pct, rupees } from '@/lib/format';

const cr = (n: number) => `${(n / 1e7).toFixed(1)}`;

function Kpi({ label, value, fmt, tone }: { label: string; value: number; fmt: (n: number) => string; tone?: string }) {
  return (
    <div className="rounded-[4px] border border-line bg-asphalt-2 p-3">
      <Caps>{label}</Caps>
      <div className={`mt-1 text-xl font-semibold ${tone ?? ''}`}>
        <Ticker value={value} format={fmt} />
      </div>
    </div>
  );
}

function CashFlow() {
  const fin = useDerived((s) => s.fin);
  const release = useProject((s) => s.params.money.releaseMonths);
  const data = useMemo(() => (fin?.months ?? []).map((m) => ({ m: m.m, sales: m.sales, spend: -m.spend, cumulative: m.cumulative })), [fin]);
  if (!fin) return null;
  return (
    <figure>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="m" tick={{ fill: 'var(--lane-dim)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: 'var(--lane-dim)', fontSize: 10 }} tickFormatter={cr} width={40} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--asphalt-2)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 11 }}
            labelFormatter={(m) => `Month ${m}`}
            formatter={(v, n) => [money(Number(v)), String(n)]}
          />
          <ReferenceLine y={0} stroke="var(--line)" />
          <ReferenceLine x={release + 1} stroke="var(--signal)" strokeDasharray="4 4" label={{ value: 'mortgage release', fill: 'var(--signal-ink)', fontSize: 10, position: 'insideTopRight' }} />
          <Bar dataKey="sales" name="Sales" fill="var(--blueprint)" fillOpacity={0.75} isAnimationActive={false} />
          <Bar dataKey="spend" name="Development spend" fill="var(--brake)" fillOpacity={0.7} isAnimationActive={false} />
          <Line dataKey="cumulative" name="Cumulative cash" stroke="var(--signal)" dot={false} strokeWidth={2} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <figcaption className="flex flex-wrap gap-3 text-[10.5px] text-lane-dim">
        <span>₹ Cr by month</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 bg-blueprint" />Sales</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 bg-brake" />Development spend</span>
        <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-signal" />Cumulative</span>
      </figcaption>
      <details className="mt-2 text-[11.5px]">
        <summary className="cursor-pointer text-lane-dim">Data table</summary>
        <div className="max-h-56 overflow-y-auto">
          <table className="num w-full">
            <thead className="text-lane-dim">
              <tr><th className="text-left font-normal">Month</th><th className="text-right font-normal">Sales</th><th className="text-right font-normal">Spend</th><th className="text-right font-normal">Release</th><th className="text-right font-normal">Cumulative</th></tr>
            </thead>
            <tbody>
              {fin.months.map((m) => (
                <tr key={m.m} className="border-t border-line/50"><td>{m.m}</td><td className="text-right">{rupees(m.sales)}</td><td className="text-right">{rupees(m.spend)}</td><td className="text-right">{m.release ? rupees(m.release) : ''}</td><td className="text-right">{rupees(m.cumulative)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function Tornado() {
  const layout = useDerived((s) => s.layout);
  const t = useMemo(() => (layout ? tornado(layout) : null), [layout]);
  if (!t) return null;
  const max = Math.max(1, ...t.bars.flatMap((b) => [Math.abs(b.low), Math.abs(b.high)]));
  return (
    <figure>
      <div className="space-y-2" role="img" aria-label="Sensitivity of NPV to rate, cost, velocity and mortgage">
        {t.bars.map((b) => {
          const lo = Math.min(b.low, b.high);
          const hi = Math.max(b.low, b.high);
          return (
            <div key={b.factor} className="grid grid-cols-[110px_1fr] items-center gap-2 text-[11.5px]">
              <span>{b.factor}</span>
              <div className="relative h-6 rounded-[2px] bg-asphalt">
                <span className="absolute top-0 bottom-0 left-1/2 w-px bg-line" />
                <span className="absolute top-1 bottom-1 bg-brake/70" style={{ left: `${50 + (lo / max) * 50}%`, width: `${(Math.max(0, -lo) / max) * 50}%` }} />
                <span className="absolute top-1 bottom-1 bg-sign-green/80" style={{ left: '50%', width: `${(Math.max(0, hi) / max) * 50}%` }} />
                <span className="num absolute top-1/2 left-1 -translate-y-1/2 text-[10px] text-lane-dim">{b.low < b.high ? b.lowLabel : b.highLabel}</span>
                <span className="num absolute top-1/2 right-1 -translate-y-1/2 text-[10px] text-lane-dim">{b.low < b.high ? b.highLabel : b.lowLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="num mt-2 text-[10.5px] text-lane-dim">Change in NPV vs base {crore(t.base)}; full bar width = ±{crore(max)}</figcaption>
      <details className="mt-2 text-[11.5px]">
        <summary className="cursor-pointer text-lane-dim">Data table</summary>
        <table className="num w-full">
          <tbody>
            {t.bars.map((b) => (
              <tr key={b.factor} className="border-t border-line/50"><td>{b.factor}</td><td className="text-right">{b.lowLabel}: {crore(b.low)}</td><td className="text-right">{b.highLabel}: {crore(b.high)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function FinancialsView() {
  const fin = useDerived((s) => s.fin);
  const m = useProject((s) => s.params.money);
  if (!fin) return null;
  const crf = (n: number) => crore(n);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1200px] space-y-5 p-4 md:p-6">
        <h1 className="text-xl font-semibold">Financials</h1>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Revenue" value={fin.revenue} fmt={crf} tone="text-blueprint" />
          <Kpi label="Total cost" value={fin.totalCost} fmt={crf} />
          <Kpi label="Profit" value={fin.profit} fmt={crf} tone={fin.profit < 0 ? 'text-brake-ink' : 'text-green-ink'} />
          <Kpi label="Margin" value={fin.marginPct} fmt={(n) => pct(n)} />
          <Kpi label="IRR (annual)" value={fin.irr ?? 0} fmt={(n) => (fin.irr === null ? 'n/a' : pct(n))} />
          <Kpi label={`NPV @ ${m.discount}%`} value={fin.npv} fmt={crf} />
          <Kpi label="Peak funding need" value={fin.peakFunding} fmt={crf} tone="text-signal-ink" />
          <Kpi label="Sell-out" value={fin.salesMonths} fmt={(n) => `${Math.round(n)} mo`} />
        </div>
        {fin.irr === null && <p className="text-[11.5px] text-lane-dim">IRR is undefined when cash flow never goes negative (e.g. zero land cost). Enter a land cost in Commercials for a meaningful IRR.</p>}
        <section className="rounded-[4px] border border-line p-3">
          <Caps className="pb-2">Monthly cash flow</Caps>
          <CashFlow />
        </section>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[4px] border border-line p-3">
            <Caps className="pb-2">Sensitivity — NPV tornado</Caps>
            <Tornado />
          </section>
          <section className="rounded-[4px] border border-line p-3">
            <Caps className="pb-2">Assumptions</Caps>
            <dl className="num grid grid-cols-[1fr_auto] gap-y-1 text-[12px]">
              <dt className="text-lane-dim">Base rate</dt><dd>{rupees(m.baseRate)}/sq yd</dd>
              <dt className="text-lane-dim">Development cost</dt><dd>{rupees(m.devCost)}/sq yd gross</dd>
              <dt className="text-lane-dim">Land cost</dt><dd>{rupees(m.landCost)}/acre</dd>
              <dt className="text-lane-dim">Approval fees</dt><dd>{rupees(fin.fees)}</dd>
              <dt className="text-lane-dim">Road impact fee</dt><dd>{rupees(fin.roadImpact)}</dd>
              <dt className="text-lane-dim">Mortgage / release</dt><dd>{m.mortPct}% after {m.releaseMonths} mo</dd>
              <dt className="text-lane-dim">Velocity</dt><dd>{m.velocity} plots/mo</dd>
              <dt className="text-lane-dim">Escalation</dt><dd>{m.escalation}%/yr</dd>
              <dt className="text-lane-dim">Discount rate</dt><dd>{m.discount}%</dd>
            </dl>
            <p className="mt-2 text-[11px] text-lane-dim">Development spend is spread over min(24, release months). Mortgaged plots enter the sales queue after release. Escalation compounds monthly.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
