import { useProject, setSection, setParam } from '@/state/project';
import { useUi } from '@/state/ui';
import { go105 } from '@/state/actions';
import { PRESETS, PRESET_LABELS, presetParcel } from '@/engine/parcel';
import { PROFILES } from '@/rules/profiles';
import { ACRE, GUNTA, area as polyArea } from '@/engine/geometry';
import type { Authority, PresetId } from '@/engine/types';
import { Button, Caps, Field, Segmented, Select } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { fmtInt } from '@/lib/format';
import { BearingsEditor } from './BearingsEditor';
import { ImportParcel } from './ImportParcel';

export function SitePanel() {
  const site = useProject((s) => s.params.site);
  const mode = useProject((s) => s.params.mode);
  const custom = site.source !== 'preset' && site.polygon && site.polygon.length >= 3;
  const a = custom ? polyArea(site.polygon!) : site.acres * ACRE;
  const startDraw = () => {
    if (!site.polygon) setSection('site', { polygon: presetParcel(site.preset, site.acres) });
    setSection('site', { source: 'drawn' });
    useUi.setState({ tool: 'parcel', tab: 'studio' });
  };
  return (
    <div className="space-y-2">
      <Segmented
        label="Engine mode"
        value={mode}
        onChange={(v) => setParam('mode', v)}
        options={[
          { value: 'parity', label: 'v1 parity' },
          { value: 'rules', label: 'Rule-aware' },
        ]}
      />
      <Button variant="blue" className="w-full" onClick={go105}>
        <Icon name="shield" size={14} /> Apply GO 105 standards
      </Button>
      <div className="rounded-[4px] border border-line bg-asphalt p-2">
        <Caps>Live parcel area</Caps>
        <div className="num mt-1 grid grid-cols-3 gap-1 text-[12px]">
          <span>
            {(a / ACRE).toFixed(3)}
            <span className="text-lane-dim"> ac</span>
          </span>
          <span>
            {fmtInt(a)}
            <span className="text-lane-dim"> m²</span>
          </span>
          <span>
            {(a / GUNTA).toFixed(1)}
            <span className="text-lane-dim"> gn</span>
          </span>
        </div>
      </div>
      <Caps className="pt-1">Parcel source</Caps>
      <Segmented
        label="Parcel source"
        value={site.source}
        onChange={(v) => {
          if (v !== 'preset' && !site.polygon) setSection('site', { polygon: presetParcel(site.preset, site.acres) });
          setSection('site', { source: v });
          if (v === 'drawn') useUi.setState({ tool: 'parcel' });
        }}
        options={[
          { value: 'preset', label: 'Preset' },
          { value: 'drawn', label: 'Draw' },
          { value: 'table', label: 'Bearings' },
          { value: 'import', label: 'Import' },
        ]}
      />
      {site.source === 'preset' && (
        <>
          <div className="grid grid-cols-5 gap-1 pt-1">
            {(Object.keys(PRESETS) as PresetId[]).map((id) => {
              const pts = PRESETS[id];
              const xs = pts.map((q) => q[0]);
              const ys = pts.map((q) => q[1]);
              const w = Math.max(...xs);
              const h = Math.max(...ys);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={site.preset === id}
                  title={PRESET_LABELS[id]}
                  onClick={() => setSection('site', { preset: id })}
                  className={`flex aspect-square items-center justify-center rounded-[4px] border ${site.preset === id ? 'border-signal bg-signal/10' : 'border-line hover:border-lane-dim'}`}
                >
                  <svg viewBox={`-0.1 -0.1 ${w + 0.2} ${h + 0.2}`} className="h-7 w-7">
                    <polygon
                      points={pts.map(([x, y]) => `${x},${h - y}`).join(' ')}
                      fill="none"
                      stroke={site.preset === id ? 'var(--signal)' : 'var(--blueprint)'}
                      strokeWidth={0.06}
                    />
                  </svg>
                  <span className="sr-only">{PRESET_LABELS[id]}</span>
                </button>
              );
            })}
          </div>
          <Field label="Extent" unit="ac" value={site.acres} min={1} max={120} step={0.5} onChange={(v) => setSection('site', { acres: v })} />
        </>
      )}
      {site.source === 'drawn' && (
        <div className="space-y-1.5 text-[12px] text-lane-dim">
          <p>Drag vertices on the plan. Click an edge midpoint to add a vertex; Alt-click a vertex to delete it. Vertices snap to 1 m.</p>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={startDraw}>
              <Icon name="edit" size={13} /> Edit on plan
            </Button>
            <Button variant="outline" size="sm" onClick={() => useUi.setState({ mapTrace: true, tab: 'studio' })}>
              <Icon name="map" size={13} /> Trace on map
            </Button>
          </div>
        </div>
      )}
      {site.source === 'table' && <BearingsEditor />}
      {site.source === 'import' && <ImportParcel />}
      <Field label="North offset" unit="°" value={site.northOffset} min={-180} max={180} step={1} onChange={(v) => setSection('site', { northOffset: v })} />
      <Caps className="pt-1">Authority profile</Caps>
      <Select
        label="Authority profile"
        value={site.authority}
        onChange={(v) => setSection('site', { authority: v as Authority })}
        options={Object.values(PROFILES).map((p) => ({ value: p.id, label: p.label }))}
      />
      <Field label="Existing approach road" unit="m" value={site.approachExisting} min={0} max={60} step={0.5} onChange={(v) => setSection('site', { approachExisting: v })} />
      <Field label="Master-plan road width" unit="m" value={site.approachMP} min={0} max={60} step={0.5} onChange={(v) => setSection('site', { approachMP: v })} />
      <Field label="Road-affected strip" unit="m²" value={site.roadAffected} min={0} max={10000} step={10} onChange={(v) => setSection('site', { roadAffected: v })} />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <label className="text-[11px] text-lane-dim">
          Survey nos.
          <input className="mt-1 h-7 w-full rounded-[4px] border border-line bg-asphalt px-2 text-[12px] text-lane outline-none focus:border-signal" value={site.surveyNos} onChange={(e) => setSection('site', { surveyNos: e.target.value })} placeholder="e.g. 112/A, 113" />
        </label>
        <label className="text-[11px] text-lane-dim">
          Revision
          <input className="mono mt-1 h-7 w-full rounded-[4px] border border-line bg-asphalt px-2 text-[12px] text-lane outline-none focus:border-signal" value={site.revision} onChange={(e) => setSection('site', { revision: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
