import { useMemo } from 'react';
import { useDerived } from '@/state/derived';
import { useWorkspace } from '@/state/workspace';
import { useUi } from '@/state/ui';
import { bbox } from '@/engine/geometry';
import { ACRE } from '@/engine/geometry';
import { Badge, Caps } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { Ticker } from '@/components/ui/Ticker';
import { StaticPlan } from '@/features/compare/StaticPlan';
import { ComplianceRing } from '@/features/shell/ComplianceRing';
import { LAND_SEGMENTS, landShares } from '@/features/shell/BottomDock';
import { TypeGlyph } from '@/features/projects/TypeGlyph';
import { TYPE_INFO } from '@/features/projects/types';
import { crore } from '@/lib/format';
import { TypeDetails } from './TypeDetails';

function Donut({ values }: { values: { key: string; label: string; color: string; v: number }[] }) {
  const total = values.reduce((s, x) => s + x.v, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <figure className="flex items-center gap-5">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={values.map((x) => `${x.label} ${((x.v / total) * 100).toFixed(1)}%`).join(', ')}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        {values.map((x) => {
          const len = (x.v / total) * c;
          const off = acc;
          acc += len;
          return len > 0.5 ? <circle key={x.key} cx="66" cy="66" r={r} fill="none" stroke={x.color} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1)} ${c}`} strokeDashoffset={-off} transform="rotate(-90 66 66)" /> : null;
        })}
        <text x="66" y="62" textAnchor="middle" className="mono" fontSize="20" fill="var(--lane)">
          {((values[0].v / total) * 100).toFixed(1)}%
        </text>
        <text x="66" y="80" textAnchor="middle" fontSize="10" fill="var(--lane-dim)">
          saleable
        </text>
      </svg>
      <figcaption className="space-y-1 text-[11.5px]">
        {values
          .filter((x) => x.v > 0.5)
          .map((x) => (
            <div key={x.key} className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-[1px]" style={{ background: x.color }} />
              <span className="text-lane-dim">{x.label}</span>
              <span className="num ml-auto pl-3">{((x.v / total) * 100).toFixed(1)}%</span>
            </div>
          ))}
      </figcaption>
    </figure>
  );
}

export function OverviewView() {
  const layout = useDerived((s) => s.layout);
  const fin = useDerived((s) => s.fin);
  const params = useDerived((s) => s.params);
  const tally = useDerived((s) => s.tally);
  const checks = useDerived((s) => s.checks);
  const meta = useWorkspace((s) => s.meta);
  const view = useMemo(() => (layout ? bbox(layout.parcel) : null), [layout]);
  if (!layout || !fin || !params || !meta) return null;
  const info = TYPE_INFO[meta.type] ?? TYPE_INFO.plots;
  const shares = landShares(layout);
  const d = meta.details;
  const failing = checks.filter((c) => c.status === 'fail' || c.status === 'warn' || c.status === 'conflict').slice(0, 4);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1240px] space-y-5 p-4 md:p-6">
        <header className="flex flex-wrap items-center gap-4">
          <TypeGlyph type={meta.type} size={56} />
          <div className="min-w-0 flex-1">
            <div className="caps text-[10.5px]" style={{ color: info.accent }}>
              {info.title}
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{params.site.projectName || meta.name}</h1>
            <p className="text-[12.5px] text-lane-dim">{[d?.location, d?.village, d?.surveyNos && `Sy. ${d.surveyNos}`, params.site.authority].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={() => useUi.setState({ tab: 'studio' })} className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-signal px-4 text-[13px] font-medium text-[#140800] shadow-[var(--glow-signal)]">
            <Icon name="grid" size={15} /> Open studio
          </button>
        </header>

        <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            { label: 'Gross', v: layout.gross / ACRE, f: (n: number) => `${n.toFixed(2)} ac` },
            { label: 'Plots', v: layout.plots.length, f: (n: number) => String(Math.round(n)) },
            { label: 'Saleable', v: (layout.plotted / layout.gross) * 100, f: (n: number) => `${n.toFixed(1)}%` },
            { label: 'Revenue', v: fin.revenue, f: crore },
            { label: 'Margin', v: fin.marginPct, f: (n: number) => `${n.toFixed(1)}%` },
          ].map((k) => (
            <div key={k.label} className="rounded-[6px] border border-line bg-asphalt-2 p-4">
              <Caps>{k.label}</Caps>
              <div className="mt-1 text-[24px] leading-tight font-semibold">
                <Ticker value={k.v} format={k.f} />
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <button type="button" onClick={() => useUi.setState({ tab: 'studio' })} className="drafting-grid group relative aspect-[16/10] overflow-hidden rounded-[6px] border border-line text-left" aria-label="Open the plan in Studio">
            {view && <StaticPlan layout={layout} view={view} label="Generated layout" />}
            <span className="absolute top-3 left-3">
              <Badge tone="signal" className="bg-asphalt/80">
                Yield study only
              </Badge>
            </span>
            <span className="absolute right-3 bottom-3 rounded-[4px] bg-asphalt/85 px-2.5 py-1.5 text-[12px] opacity-0 transition-opacity group-hover:opacity-100">Edit in Studio →</span>
          </button>
          <div className="space-y-5">
            <div className="rounded-[6px] border border-line bg-asphalt-2 p-4">
              <Caps className="pb-3">Land use</Caps>
              <Donut values={LAND_SEGMENTS.map((s) => ({ key: s.key, label: s.label, color: s.color, v: shares[s.key] ?? 0 }))} />
            </div>
            <div className="rounded-[6px] border border-line bg-asphalt-2 p-4">
              <div className="flex items-center justify-between">
                <Caps>Compliance</Caps>
                <button type="button" onClick={() => useUi.setState({ tab: 'feasibility' })} className="text-[11.5px] text-blueprint hover:underline">
                  Feasibility →
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <ComplianceRing size={44} />
                <div className="num text-[12px] text-lane-dim">
                  <span className="text-green-ink">{tally.verified} verified</span> · <span className="text-brake-ink">{tally.failing} failing</span> · <span className="text-blueprint">{tally.conflict} conflict</span>
                </div>
              </div>
              {failing.length > 0 && (
                <ul className="mt-3 space-y-1 text-[12px]">
                  {failing.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <i className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.status === 'conflict' ? 'var(--conflict)' : 'var(--brake)' }} />
                      {c.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[6px] border border-line bg-asphalt-2 p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <i className="h-2 w-2 rounded-full" style={{ background: info.accent }} />
            <h2 className="text-[15px] font-semibold">{info.title} details</h2>
          </div>
          <TypeDetails type={meta.type} layout={layout} params={params} fin={fin} plantation={d?.plantation} />
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-[6px] border border-line bg-asphalt-2 p-4 md:col-span-2">
            <Caps className="pb-2">Finance</Caps>
            <dl className="num grid grid-cols-2 gap-y-1.5 text-[12.5px] md:grid-cols-4">
              <dt className="text-lane-dim">Total cost</dt>
              <dd>{crore(fin.totalCost)}</dd>
              <dt className="text-lane-dim">Profit</dt>
              <dd className={fin.profit < 0 ? 'text-brake-ink' : 'text-green-ink'}>{crore(fin.profit)}</dd>
              <dt className="text-lane-dim">NPV</dt>
              <dd>{crore(fin.npv)}</dd>
              <dt className="text-lane-dim">IRR</dt>
              <dd>{fin.irr === null ? 'n/a (no land cost)' : `${fin.irr.toFixed(1)}%`}</dd>
              <dt className="text-lane-dim">Peak funding</dt>
              <dd>{crore(fin.peakFunding)}</dd>
              <dt className="text-lane-dim">Sell-out</dt>
              <dd>{fin.salesMonths} months</dd>
            </dl>
          </div>
          <div className="rounded-[6px] border border-line bg-asphalt-2 p-4">
            <Caps className="pb-2">Project</Caps>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
              <dt className="text-lane-dim">Record area</dt>
              <dd className="num">
                {d?.acres ?? '—'} ac {d?.guntas ?? 0} gn
              </dd>
              <dt className="text-lane-dim">Approach</dt>
              <dd className="num">
                {params.site.approachExisting} m → {params.site.approachMP} m
              </dd>
              <dt className="text-lane-dim">Engine</dt>
              <dd>{params.mode === 'rules' ? 'Rule-aware' : 'v1 parity'}</dd>
              <dt className="text-lane-dim">Created</dt>
              <dd>{new Date(meta.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
