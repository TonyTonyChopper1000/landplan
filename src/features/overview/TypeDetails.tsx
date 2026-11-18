import type { Layout, Params } from '@/engine/types';
import { DIRS } from '@/engine/types';
import { ACRE, FT, GUNTA, SQYD } from '@/engine/geometry';
import { footprint } from '@/engine/massing';
import { plotPrice, type Finance } from '@/engine/finance';
import { plotRanges } from '@/engine/mortgage';
import { line } from '@/engine/areas';
import { useUi } from '@/state/ui';
import { Caps } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { crore, fmtInt, lakh } from '@/lib/format';
import type { ProjectType } from '@/features/projects/types';

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-[4px] border border-line bg-asphalt p-3">
      <div className="caps text-[10px] text-lane-dim">{label}</div>
      <div className={`num mt-1 text-[20px] leading-tight font-semibold ${tone ?? ''}`}>{value}</div>
      {sub && <div className="num mt-0.5 text-[11px] text-lane-dim">{sub}</div>}
    </div>
  );
}

function Bars({ rows, color }: { rows: { label: string; n: number; extra?: string }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="num grid grid-cols-[84px_1fr_56px] items-center gap-2 text-[11.5px]">
          <span className="truncate text-lane-dim">{r.label}</span>
          <span className="h-2.5 rounded-[1px]" style={{ width: `${(r.n / max) * 100}%`, background: color, minWidth: r.n ? 3 : 0 }} />
          <span className="text-right">{r.extra ?? r.n}</span>
        </div>
      ))}
    </div>
  );
}

function PlotsDetails({ layout, params, fin }: { layout: Layout; params: Params; fin: Finance }) {
  const sizes = [...new Set(layout.plots.map((p) => p.sizeSqYd))].sort((a, b) => a - b);
  const prices = layout.plots.map((p) => plotPrice(p, params));
  const mort = layout.plots.filter((p) => p.mortgaged).map((p) => p.no);
  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Sellable now" value={crore(fin.sellableNow)} tone="text-signal-ink" sub={`${layout.plots.length - mort.length} plots`} />
        <Stat label="Mortgaged stock" value={crore(fin.mortgagedValue)} sub={`${mort.length} plots`} />
        <Stat label="Price band" value={`${lakh(Math.min(...prices))} – ${lakh(Math.max(...prices))}`} sub={`avg ${lakh(prices.reduce((s, x) => s + x, 0) / Math.max(1, prices.length))}`} />
        <Stat label="Corner plots" value={String(layout.plots.filter((p) => p.corner).length)} sub={`+${Math.round(params.money.corner * 100)}% premium`} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Caps className="pb-2">Plot mix</Caps>
          <Bars color="var(--blueprint)" rows={sizes.map((s) => ({ label: `${s} sq yd`, n: layout.plots.filter((p) => p.sizeSqYd === s).length }))} />
        </div>
        <div>
          <Caps className="pb-2">Facing</Caps>
          <Bars color="var(--band-1)" rows={DIRS.map((d) => ({ label: d, n: layout.plots.filter((p) => p.facing === d).length }))} />
        </div>
      </div>
      {mort.length > 0 && (
        <p className="num mt-4 text-[12px]">
          <span className="text-lane-dim">Mortgaged plots ({params.money.mortPct}%): </span>
          {plotRanges(mort)}
        </p>
      )}
    </>
  );
}

function VillaDetails({ layout, params }: { layout: Layout; params: Params }) {
  const villas = layout.plots.filter((p) => !p.irregular);
  const storeys = params.built.floors + 1;
  const builtUp = villas.reduce((s, p) => {
    const f = footprint(p, params.built.setbacks);
    return s + f.w * f.d * storeys;
  }, 0);
  const sqft = (m2: number) => m2 / (FT * FT);
  const clubhouse = line(layout, 'social');
  const premium = layout.plots.filter((p) => p.corner || p.facing === 'E' || p.facing === 'NE').length;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Villas" value={String(villas.length)} sub={`${layout.plots.length - villas.length} irregular plots as pads`} tone="text-band-3" />
        <Stat label="Total built-up" value={`${fmtInt(sqft(builtUp) / 1000)}k sq ft`} sub={`${fmtInt(builtUp)} m² · G+${params.built.floors}`} />
        <Stat label="Avg villa" value={`${fmtInt(sqft(builtUp / Math.max(1, villas.length)))} sq ft`} sub={`${storeys} storeys × ${params.built.floorHeight} m`} />
        <Stat label="Clubhouse parcel" value={clubhouse ? `${fmtInt(clubhouse)} m²` : '—'} sub={clubhouse ? `${fmtInt(clubhouse / SQYD)} sq yd` : 'Enable in Open space'} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Caps className="pb-2">Villa plot sizes</Caps>
          <Bars color="var(--band-3)" rows={[...new Set(villas.map((p) => p.sizeSqYd))].sort((a, b) => a - b).map((s) => ({ label: `${s} sq yd`, n: villas.filter((p) => p.sizeSqYd === s).length }))} />
        </div>
        <div className="flex flex-col justify-between rounded-[4px] border border-line bg-asphalt p-3 text-[12.5px]">
          <div>
            <div className="text-lane-dim">Premium villas (corner, east, north-east)</div>
            <div className="num mt-1 text-[20px] font-semibold">{premium}</div>
          </div>
          <button type="button" onClick={() => useUi.setState({ tab: '3d' })} className="mt-3 inline-flex items-center gap-1.5 self-start rounded-[4px] border border-band-3/60 px-3 py-1.5 text-[12px] hover:bg-asphalt-3" style={{ borderColor: 'color-mix(in srgb, var(--band-3) 60%, transparent)' }}>
            <Icon name="cube" size={14} /> Open 3D massing & sun path
          </button>
        </div>
      </div>
    </>
  );
}

function FarmDetails({ layout, params, fin, plantation }: { layout: Layout; params: Params; fin: Finance; plantation?: string }) {
  const gn = (m2: number) => m2 / GUNTA;
  const roads = layout.roadRuns.reduce((s, r) => s + r.length, 0);
  const green = line(layout, 'park') + line(layout, 'buffers');
  const perAcre = params.money.baseRate * (ACRE / SQYD);
  const bands = [
    { label: '< 15 gn', test: (g: number) => g < 15 },
    { label: '15–25 gn', test: (g: number) => g >= 15 && g < 25 },
    { label: '25–35 gn', test: (g: number) => g >= 25 && g < 35 },
    { label: '≥ 35 gn', test: (g: number) => g >= 35 },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Farm plots" value={String(layout.plots.length)} tone="text-green-ink" sub={`avg ${gn(layout.plotted / Math.max(1, layout.plots.length)).toFixed(1)} guntas`} />
        <Stat label="Price per acre" value={lakh(perAcre)} sub={`₹${fmtInt(params.money.baseRate)}/sq yd`} />
        <Stat label="Farm roads" value={`${(roads / 1000).toFixed(2)} km`} sub={`${layout.frontage} / ${layout.spine} m wide`} />
        <Stat label="Green cover" value={`${((green / layout.gross) * 100).toFixed(1)}%`} sub={plantation ? plantation : `${fmtInt(gn(green))} guntas`} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Caps className="pb-2">Plots by size</Caps>
          <Bars color="var(--sign-green)" rows={bands.map((b) => ({ label: b.label, n: layout.plots.filter((p) => b.test(gn(p.area))).length }))} />
        </div>
        <div className="rounded-[4px] border border-line bg-asphalt p-3 text-[12.5px]">
          <div className="text-lane-dim">Total saleable land</div>
          <div className="num mt-1 text-[20px] font-semibold">
            {(layout.plotted / ACRE).toFixed(2)} ac <span className="text-[13px] text-lane-dim">({fmtInt(gn(layout.plotted))} gn)</span>
          </div>
          <div className="num mt-2 text-lane-dim">Revenue {crore(fin.revenue)} · sell-out in {fin.salesMonths} months at {params.money.velocity}/month</div>
        </div>
      </div>
    </>
  );
}

export function TypeDetails({ type, layout, params, fin, plantation }: { type: ProjectType; layout: Layout; params: Params; fin: Finance; plantation?: string }) {
  if (type === 'villas') return <VillaDetails layout={layout} params={params} />;
  if (type === 'farm') return <FarmDetails layout={layout} params={params} fin={fin} plantation={plantation} />;
  return <PlotsDetails layout={layout} params={params} fin={fin} />;
}
