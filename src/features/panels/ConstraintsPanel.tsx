import { useProject, setParam } from '@/state/project';
import { useUi, type Tool } from '@/state/ui';
import { bufferSpec, lakeHa } from '@/engine/constraints';
import type { Constraint, ConstraintKind } from '@/engine/types';
import { Button, Caps, NumberInput, Toggle } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';

const KINDS: { kind: ConstraintKind; label: string; how: string }[] = [
  { kind: 'lake', label: 'Lake FTL', how: 'Click points, double-click to close' },
  { kind: 'nala', label: 'Nala', how: 'Click points, double-click to finish' },
  { kind: 'ht', label: 'HT line', how: 'Click points, double-click to finish' },
  { kind: 'rail', label: 'Railway edge', how: 'Click points, double-click to finish' },
  { kind: 'heritage', label: 'Heritage point', how: 'Click once' },
];

export function ConstraintsPanel() {
  const cs = useProject((s) => s.params.constraints);
  const credit = useProject((s) => s.params.countBufferAsOpen);
  const tool = useUi((s) => s.tool);
  const upd = (id: string, patch: Partial<Constraint>) =>
    setParam(
      'constraints',
      cs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {KINDS.map((k) => (
          <Button
            key={k.kind}
            size="sm"
            variant={tool === k.kind ? 'blue' : 'outline'}
            aria-pressed={tool === k.kind}
            onClick={() => useUi.setState({ tool: tool === k.kind ? 'select' : (k.kind as Tool), tab: 'studio' })}
            className="justify-start"
          >
            <Icon name="plus" size={12} /> {k.label}
          </Button>
        ))}
      </div>
      {tool !== 'select' && tool !== 'lasso' && tool !== 'parcel' && (
        <p className="rounded-[4px] border border-blueprint/40 bg-blueprint/5 p-2 text-[11px] text-blueprint">
          {KINDS.find((k) => k.kind === tool)?.how}. Esc cancels.
        </p>
      )}
      {cs.length === 0 ? (
        <p className="text-[11px] text-lane-dim">No constraints drawn. Buffers are generated from the rule library and deducted from the developable area.</p>
      ) : (
        <div className="space-y-1.5">
          {cs.map((c) => {
            const spec = bufferSpec(c);
            return (
              <div key={c.id} className="rounded-[4px] border border-line p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium">{KINDS.find((k) => k.kind === c.kind)?.label}</span>
                  <span className="mono text-[10.5px] text-blueprint">{spec.rule}</span>
                  <button type="button" aria-label="Delete constraint" className="text-lane-dim hover:text-brake-ink" onClick={() => setParam('constraints', cs.filter((x) => x.id !== c.id))}>
                    <Icon name="trash" size={13} />
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-lane-dim">{spec.label}</div>
                {c.kind === 'lake' && (
                  <label className="mt-1 grid grid-cols-[1fr_96px] items-center gap-2 text-[11px]">
                    Lake area (whole water body)
                    <NumberInput label="Lake area" unit="ha" step={0.5} min={0} value={Math.round(lakeHa(c) * 100) / 100} onChange={(v) => upd(c.id, { lakeHa: v })} />
                  </label>
                )}
                {c.kind === 'nala' && (
                  <label className="mt-1 grid grid-cols-[1fr_96px] items-center gap-2 text-[11px]">
                    Nala width
                    <NumberInput label="Nala width" unit="m" step={0.5} min={0} value={c.widthM ?? 6} onChange={(v) => upd(c.id, { widthM: v })} />
                  </label>
                )}
                {c.kind === 'ht' && (
                  <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11px]">
                    <NumberInput label="Voltage" unit="kV" step={1} min={0} value={c.voltageKv ?? 132} onChange={(v) => upd(c.id, { voltageKv: v })} />
                    <NumberInput label="Tower base width" unit="m" step={0.5} min={0} value={c.towerBase ?? 8} onChange={(v) => upd(c.id, { towerBase: v })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Caps className="pt-1">Open-space credit</Caps>
      <Toggle label="Count buffers toward open space" hint="Rule 16(1)(e)(ii). HT belts never count (HT-GREEN)." checked={credit} onChange={(v) => setParam('countBufferAsOpen', v)} />
    </div>
  );
}
