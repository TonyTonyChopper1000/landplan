import { useProject, setSection } from '@/state/project';
import { ROAD_TABLE } from '@/rules/regulations';
import { DIRS } from '@/engine/types';
import { Caps, Field, NumberInput, Row, Segmented, Select, Toggle } from '@/components/ui/controls';
import { SQYD } from '@/engine/geometry';

export function PlotsPanel() {
  const pl = useProject((s) => s.params.plots);
  const mode = useProject((s) => s.params.mode);
  return (
    <div>
      <Field label="Plot depth" unit="ft" value={pl.depthFt} min={30} max={100} step={1} onChange={(v) => setSection('plots', { depthFt: v })} />
      <Field label="Block length" unit="m" value={pl.blockLen} min={60} max={300} step={5} onChange={(v) => setSection('plots', { blockLen: v })} />
      <Caps className="pt-2 pb-1">Sizes · weight</Caps>
      <div className="space-y-1">
        {pl.sizes.map((s, i) => {
          const w = (s.sqyd * SQYD) / (pl.depthFt * 0.3048);
          return (
            <div key={s.sqyd} className="grid grid-cols-[18px_1fr_auto_64px] items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                aria-label={`${s.sqyd} sq yd plots`}
                checked={s.on}
                onChange={(e) => setSection('plots', { sizes: pl.sizes.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)) })}
                className="h-3.5 w-3.5 accent-[var(--signal)]"
              />
              <span className={s.on ? '' : 'text-lane-dim'}>
                <span className="num">{s.sqyd}</span> sq yd
              </span>
              <span className={`num text-[11px] ${w < 6 ? 'text-brake-ink' : 'text-lane-dim'}`}>{w.toFixed(2)} m</span>
              <NumberInput label={`Weight for ${s.sqyd} sq yd`} value={s.weight} min={0} max={9} step={1} onChange={(v) => setSection('plots', { sizes: pl.sizes.map((x, j) => (j === i ? { ...x, weight: Math.round(v) } : x)) })} />
            </div>
          );
        })}
      </div>
      <Field label="Min plot area" unit="m²" value={Math.round(pl.minPlotM2 * 10) / 10} min={20} max={200} step={0.5} onChange={(v) => setSection('plots', { minPlotM2: v })} />
      <Field label="Min plot width" unit="m" hint={mode === 'parity' ? '(rule-aware)' : undefined} value={pl.minWidth} min={0} max={15} step={0.5} onChange={(v) => setSection('plots', { minWidth: v })} />
      <Toggle label="Allow mixed depths per block" hint="Rule-aware: top row uses 1.25× depth" checked={pl.mixedDepths} onChange={(v) => setSection('plots', { mixedDepths: v })} />
      <Caps className="pt-2 pb-1">Width packing</Caps>
      <Segmented label="Width packing" value={pl.packing} onChange={(v) => setSection('plots', { packing: v })} options={[{ value: 'cycle', label: 'v1 cycle' }, { value: 'dp', label: 'Optimal (DP, whole feet)' }]} />
      <Caps className="pt-2 pb-1">Plot numbering</Caps>
      <Segmented label="Plot numbering" value={pl.numbering} onChange={(v) => setSection('plots', { numbering: v })} options={[{ value: 'v1', label: 'Generation order' }, { value: 'serpentine', label: 'Serpentine from entry' }]} />
    </div>
  );
}

export function RoadsPanel() {
  const r = useProject((s) => s.params.roads);
  return (
    <div>
      <Field label="Frontage road" unit="m" value={r.frontage} min={6} max={30} step={0.1} onChange={(v) => setSection('roads', { frontage: v })} />
      <Field label="Spine road" unit="m" value={r.spine} min={6} max={30} step={0.1} onChange={(v) => setSection('roads', { spine: v })} />
      <Field label="Boundary road" unit="m" value={r.boundary} min={0} max={18} step={0.5} onChange={(v) => setSection('roads', { boundary: v })} />
      <Toggle label="Cut junction splays per table" hint="Rule-aware mode" checked={r.splays} onChange={(v) => setSection('roads', { splays: v })} />
      <Toggle label="Auto-upgrade runs > 600 m to 18 m" hint="Rule-aware mode" checked={r.hierarchy} onChange={(v) => setSection('roads', { hierarchy: v })} />
      <Caps className="pt-2 pb-1">RD-TABLE · GO 105 Rule 5(3)</Caps>
      <table className="num w-full text-[11px]">
        <thead className="text-lane-dim">
          <tr>
            <th className="text-left font-normal">Run</th>
            <th className="text-right font-normal">ROW</th>
            <th className="text-right font-normal">Splay</th>
            <th className="text-right font-normal">C/way</th>
          </tr>
        </thead>
        <tbody>
          {ROAD_TABLE.map((b, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-0.5">{i === 0 ? '≤600 m' : i === 1 ? '≤1000 m' : '>1000 m'}</td>
              <td className="text-right">{b.row} m</td>
              <td className="text-right">{b.splay} m</td>
              <td className="text-right">{b.carriageway}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpenPanel() {
  const o = useProject((s) => s.params.open);
  return (
    <div>
      <Field label="Total reservation" unit="%" value={o.total} min={0} max={30} step={0.5} onChange={(v) => setSection('open', { total: v })} />
      <Field label="Parks / green" unit="%" value={o.park} min={0} max={30} step={0.5} onChange={(v) => setSection('open', { park: v })} />
      <Field label="Utilities" unit="%" value={o.util} min={0} max={5} step={0.5} onChange={(v) => setSection('open', { util: v })} />
      <Field label="Social infrastructure" unit="%" value={o.social} min={0} max={5} step={0.5} onChange={(v) => setSection('open', { social: v })} />
      <Caps className="pt-2 pb-1">Placement</Caps>
      <Segmented
        label="Open space placement"
        value={o.placement}
        onChange={(v) => setSection('open', { placement: v })}
        options={[
          { value: 'central', label: 'Central' },
          { value: 'distributed', label: 'Distributed' },
          { value: 'buffer', label: 'Along buffer' },
        ]}
      />
      <Field label="Min pocket size" unit="m²" value={o.minPocket} min={0} max={5000} step={50} onChange={(v) => setSection('open', { minPocket: v })} />
    </div>
  );
}

export function BuiltPanel() {
  const b = useProject((s) => s.params.built);
  return (
    <div>
      <Caps className="pb-1">Floors</Caps>
      <Segmented
        label="Floors"
        value={String(b.floors)}
        onChange={(v) => setSection('built', { floors: Number(v) })}
        options={[
          { value: '1', label: 'G+1' },
          { value: '2', label: 'G+2' },
          { value: '3', label: 'G+3' },
        ]}
      />
      <Field label="Floor height" unit="m" value={b.floorHeight} min={2.8} max={4.5} step={0.1} onChange={(v) => setSection('built', { floorHeight: v })} />
      <Toggle label="Setbacks by plot size" hint="SB-FRONT (verify) + assumed rear/side" checked={b.setbacks} onChange={(v) => setSection('built', { setbacks: v })} />
    </div>
  );
}

export function MoneyPanel() {
  const m = useProject((s) => s.params.money);
  return (
    <div>
      <Field label="Base rate" unit="₹/yd²" value={m.baseRate} min={5000} max={150000} step={500} onChange={(v) => setSection('money', { baseRate: v })} />
      <Field label="Dev cost (gross)" unit="₹/yd²" value={m.devCost} min={0} max={30000} step={100} onChange={(v) => setSection('money', { devCost: v })} />
      <Field label="Road cost" unit="₹/m" value={m.roadCostPerM} min={0} max={200000} step={500} onChange={(v) => setSection('money', { roadCostPerM: v })} />
      <Field label="Open-space cost" unit="₹/m²" value={m.openCostPerM2} min={0} max={20000} step={50} onChange={(v) => setSection('money', { openCostPerM2: v })} />
      <Field label="Land cost" unit="₹/ac" value={m.landCost} min={0} max={200000000} step={500000} onChange={(v) => setSection('money', { landCost: v })} />
      <Field label="Approval fees" unit="₹/m²" value={m.approvalFee} min={0} max={2000} step={10} onChange={(v) => setSection('money', { approvalFee: v })} />
      <Toggle label="Road impact fee" hint="100% of DC (50% if 15 m vs MP 18 m)" checked={m.roadImpactFee} onChange={(v) => setSection('money', { roadImpactFee: v })} />
      <Field label="Mortgage" unit="%" value={m.mortPct} min={0} max={50} step={1} onChange={(v) => setSection('money', { mortPct: v })} />
      <Row label="Mortgage policy">
        <Select label="Mortgage policy" value={m.mortPolicy} onChange={(v) => setSection('money', { mortPolicy: v })} options={[{ value: 'highest', label: 'Highest numbers' }, { value: 'contiguous', label: 'Contiguous blocks' }, { value: 'lowest-value', label: 'Lowest value' }]} />
      </Row>
      <Field label="Release after" unit="mo" value={m.releaseMonths} min={0} max={72} step={1} onChange={(v) => setSection('money', { releaseMonths: v })} />
      <Field label="Sales velocity" unit="/mo" value={m.velocity} min={1} max={60} step={1} onChange={(v) => setSection('money', { velocity: v })} />
      <Field label="Price escalation" unit="%/yr" value={m.escalation} min={0} max={20} step={0.5} onChange={(v) => setSection('money', { escalation: v })} />
      <Field label="Discount rate" unit="%" value={m.discount} min={0} max={30} step={0.5} onChange={(v) => setSection('money', { discount: v })} />
      <Caps className="pt-2 pb-1">Premiums</Caps>
      <div className="grid grid-cols-4 gap-1.5">
        {DIRS.map((d) => (
          <label key={d} className="text-[10.5px] text-lane-dim">
            <span className="mono">{d}</span>
            <NumberInput label={`${d} facing premium`} value={Math.round(m.premiums[d] * 100)} step={1} min={-30} max={30} unit="%" onChange={(v) => setSection('money', { premiums: { ...m.premiums, [d]: v / 100 } })} />
          </label>
        ))}
        <label className="col-span-2 text-[10.5px] text-lane-dim">
          Corner
          <NumberInput label="Corner premium" value={Math.round(m.corner * 100)} step={1} min={0} max={40} unit="%" onChange={(v) => setSection('money', { corner: v / 100 })} />
        </label>
        <label className="col-span-2 text-[10.5px] text-lane-dim">
          Irregular
          <NumberInput label="Irregular discount" value={Math.round(m.irregular * 100)} step={1} min={0} max={40} unit="%" onChange={(v) => setSection('money', { irregular: v / 100 })} />
        </label>
      </div>
    </div>
  );
}
