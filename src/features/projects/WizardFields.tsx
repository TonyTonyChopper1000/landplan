import { lazy, Suspense, useState, type ReactNode } from 'react';
import { PRESETS, PRESET_LABELS } from '@/engine/parcel';
import { PROFILES } from '@/rules/profiles';
import type { Authority, Params, PresetId } from '@/engine/types';
import { NumberInput, Select, Toggle, cx } from '@/components/ui/controls';
import type { ProjectDetails, ProjectType } from './types';

const BoundaryMap = lazy(() => import('./BoundaryMap'));

export function L({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={cx('flex flex-col gap-1.5', wide && 'md:col-span-2')}>
      <span className="text-[12.5px] font-medium">
        {label}
        {hint && <span className="ml-1.5 font-normal text-lane-dim">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const input =
  'h-9 rounded-[4px] border border-line bg-asphalt px-3 text-[13px] text-lane outline-none placeholder:text-lane-dim/60 focus:border-signal';

export function SiteStep({
  name,
  setName,
  d,
  set,
  params,
}: {
  name: string;
  setName: (v: string) => void;
  d: ProjectDetails;
  set: (p: Partial<ProjectDetails>) => void;
  params?: Params;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <L label="Project name" wide>
        <input
          autoFocus
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Shamshabad Greens Phase 1"
          maxLength={200}
        />
      </L>
      <L label="Location" hint="mandal / district">
        <input
          className={input}
          value={d.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="e.g. Shamshabad, Rangareddy"
        />
      </L>
      <L label="Village">
        <input
          className={input}
          value={d.village}
          onChange={(e) => set({ village: e.target.value })}
          placeholder="e.g. Kothwalguda"
        />
      </L>
      <L label="Survey numbers">
        <input
          className={input}
          value={d.surveyNos}
          onChange={(e) => set({ surveyNos: e.target.value })}
          placeholder="e.g. 112/A, 113, 114/1"
        />
      </L>
      <L label="Authority">
        <Select
          label="Authority"
          value={d.authority}
          onChange={(v) => set({ authority: v as Authority })}
          options={Object.values(PROFILES).map((p) => ({ value: p.id, label: p.label }))}
        />
      </L>
      <L label="Extent (title)" hint="acres + guntas">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Acres"
            unit="ac"
            value={d.acres}
            min={0.5}
            max={2000}
            step={0.5}
            onChange={(v) => set({ acres: v })}
            className="h-9"
          />
          <NumberInput
            label="Guntas"
            unit="gn"
            value={d.guntas}
            min={0}
            max={39}
            step={1}
            onChange={(v) => set({ guntas: v })}
            className="h-9"
          />
        </div>
      </L>
      <L label="Approach road" hint="existing / master-plan width">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Existing approach road"
            unit="m"
            value={d.approachExisting}
            min={0}
            max={60}
            step={0.5}
            onChange={(v) => set({ approachExisting: v })}
            className="h-9"
          />
          <NumberInput
            label="Master-plan road"
            unit="m"
            value={d.approachMP}
            min={0}
            max={60}
            step={0.5}
            onChange={(v) => set({ approachMP: v })}
            className="h-9"
          />
        </div>
      </L>
      <BoundaryChoice d={d} set={set} params={params} />
    </div>
  );
}

function BoundaryChoice({ d, set, params }: { d: ProjectDetails; set: (p: Partial<ProjectDetails>) => void; params?: Params }) {
  const [mode, setMode] = useState<'shape' | 'map'>(d.boundary ? 'map' : 'shape');
  return (
    <div className="md:col-span-2">
      <span className="text-[12.5px] font-medium">Land boundary</span>
      <div
        className="mt-2 mb-3 inline-flex rounded-[4px] border border-line p-0.5 text-[12.5px]"
        role="group"
        aria-label="Land boundary"
      >
        {(
          [
            ['shape', 'Standard shape'],
            ['map', 'Trace on map or import'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => (setMode(k), k === 'shape' && set({ boundary: undefined }))}
            className={cx(
              'rounded-[3px] px-3 py-1.5',
              mode === k ? 'bg-signal/15 text-lane' : 'text-lane-dim hover:text-lane',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'map' ? (
        <Suspense fallback={<div className="skeleton h-[420px] rounded-[4px]" />}>
          <BoundaryMap value={d.boundary} onChange={(b) => set({ boundary: b })} params={params} titleAcres={d.acres + d.guntas / 40} />
        </Suspense>
      ) : (
        <ShapePicker d={d} set={set} />
      )}
    </div>
  );
}

function ShapePicker({ d, set }: { d: ProjectDetails; set: (p: Partial<ProjectDetails>) => void }) {
  return (
    <div>
      <span className="text-[12.5px] text-lane-dim">
        An idealised parcel scaled to the extent above. Trace the real boundary for an accurate layout.
      </span>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const pts = PRESETS[id];
          const w = Math.max(...pts.map((q) => q[0]));
          const h = Math.max(...pts.map((q) => q[1]));
          const on = d.shape === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => set({ shape: id })}
              className={cx(
                'flex flex-col items-center gap-1 rounded-[4px] border p-2 text-[11px]',
                on
                  ? 'border-signal bg-signal/10 text-lane'
                  : 'border-line text-lane-dim hover:border-lane-dim',
              )}
            >
              <svg viewBox={`-0.1 -0.1 ${w + 0.2} ${h + 0.2}`} className="h-10 w-10" aria-hidden>
                <polygon
                  points={pts.map(([x, y]) => `${x},${h - y}`).join(' ')}
                  fill="none"
                  stroke={on ? 'var(--signal)' : 'var(--blueprint)'}
                  strokeWidth={0.05}
                />
              </svg>
              {PRESET_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PlanStep({
  type,
  d,
  set,
}: {
  type: ProjectType;
  d: ProjectDetails;
  set: (p: Partial<ProjectDetails>) => void;
}) {
  const unit = type === 'farm' ? '₹/sq yd' : '₹/sq yd';
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <L
        label="Base selling rate"
        hint={type === 'farm' ? `≈ ₹${Math.round((d.baseRate * 4840) / 1e5)} L per acre` : undefined}
      >
        <NumberInput
          label="Base rate"
          unit={unit}
          value={d.baseRate}
          min={100}
          max={300000}
          step={500}
          onChange={(v) => set({ baseRate: v })}
          className="h-9"
        />
      </L>
      <L label="Development cost" hint="per sq yd of gross land">
        <NumberInput
          label="Development cost"
          unit="₹/sq yd"
          value={d.devCost}
          min={0}
          max={50000}
          step={100}
          onChange={(v) => set({ devCost: v })}
          className="h-9"
        />
      </L>
      <L label="Land cost" hint="per acre (0 if owned)">
        <NumberInput
          label="Land cost"
          unit="₹/ac"
          value={d.landCostPerAcre}
          min={0}
          max={500000000}
          step={500000}
          onChange={(v) => set({ landCostPerAcre: v })}
          className="h-9"
        />
      </L>
      {type === 'villas' && (
        <L label="Villa height">
          <Select
            label="Floors"
            value={String(d.floors ?? 1)}
            onChange={(v) => set({ floors: Number(v) })}
            options={[
              { value: '1', label: 'G+1 (duplex)' },
              { value: '2', label: 'G+2 (triplex)' },
              { value: '3', label: 'G+3' },
            ]}
          />
        </L>
      )}
      {type === 'farm' && (
        <L label="Plantation">
          <input
            className={input}
            value={d.plantation ?? ''}
            onChange={(e) => set({ plantation: e.target.value })}
            placeholder="e.g. Mango, sandalwood"
          />
        </L>
      )}
      <div className="rounded-[4px] border border-line bg-asphalt p-3 md:col-span-2">
        <Toggle
          label="Rule-aware layout (GO 105 standards)"
          hint="Junction splays, 9 + 1 open-space split, 50 m² / 6 m minimum plots, 15% mortgage, cited compliance checks."
          checked={d.ruleAware}
          onChange={(v) => set({ ruleAware: v })}
        />
        {type === 'villas' && (
          <Toggle
            label="Clubhouse / amenity parcel"
            hint="Reserves 1% as a social-infrastructure parcel for the clubhouse."
            checked={!!d.clubhouse}
            onChange={(v) => set({ clubhouse: v })}
          />
        )}
      </div>
      <L label="LP number" hint="optional · once approved">
        <input
          className={input}
          value={d.lpNumber ?? ''}
          onChange={(e) => set({ lpNumber: e.target.value.slice(0, 60) })}
          placeholder="e.g. 000123/LO/Plg/HMDA/2026"
        />
      </L>
    </div>
  );
}
