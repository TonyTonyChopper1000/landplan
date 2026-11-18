import { useState } from 'react';
import type { Rule } from '@/rules/regulations';
import { useProject, setParam } from '@/state/project';
import { useUi } from '@/state/ui';
import { Badge, Button } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';

const SRC: Record<Rule['sourceType'], { label: string; tone: 'green' | 'blue' | 'signal' }> = {
  official: { label: 'Official', tone: 'green' },
  'go-copy': { label: 'GO copy', tone: 'blue' },
  secondary: { label: 'Secondary', tone: 'signal' },
};
const STATUS: Record<Rule['status'], { label: string; tone: 'green' | 'blue' | 'signal' }> = {
  'in-force': { label: 'In force', tone: 'green' },
  conflict: { label: 'Conflict', tone: 'blue' },
  verify: { label: 'Verify', tone: 'signal' },
};

export function RuleCard({ r }: { r: Rule }) {
  const ov = useProject((s) => s.params.overrides[r.id]);
  const overrides = useProject((s) => s.params.overrides);
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(ov?.value ?? '');
  const [why, setWhy] = useState(ov?.reason ?? '');
  return (
    <article className="flex flex-col rounded-[4px] border border-line bg-asphalt-2 p-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="mono text-[11px] text-blueprint">{r.id}</div>
          <h3 className="text-[13px] leading-snug font-medium">{r.title}</h3>
        </div>
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
      </header>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="num rounded-[3px] bg-asphalt-3 px-1.5 py-0.5 text-[11.5px] text-lane">{r.valueLabel}</span>
        <span className="mono text-[11px] text-lane-dim">{r.reference}</span>
      </div>
      <p className="mt-2 flex-1 text-[12px] text-lane-dim">{r.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={SRC[r.sourceType].tone}>{SRC[r.sourceType].label}</Badge>
        <span className="num text-[10.5px] text-lane-dim">verified {r.lastVerified}</span>
        <span className="text-[10.5px] text-lane-dim">· {r.authorities.join(' / ')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {r.usedBy.length ? (
          <button type="button" onClick={() => useUi.setState({ tab: 'feasibility' })} className="rounded-[3px] border border-line px-1.5 py-0.5 text-[10.5px] text-lane-dim hover:border-blueprint hover:text-blueprint">
            used by {r.usedBy.length} check{r.usedBy.length > 1 ? 's' : ''} →
          </button>
        ) : null}
        <a href={r.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-[3px] border border-line px-1.5 py-0.5 text-[10.5px] text-lane-dim hover:border-blueprint hover:text-blueprint">
          <Icon name="link" size={11} /> Source
        </a>
        <Button size="sm" variant={ov ? 'blue' : 'ghost'} onClick={() => setEdit((e) => !e)} className="ml-auto h-6">
          {ov ? 'Overridden' : 'Override'}
        </Button>
      </div>
      {edit && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Custom value" aria-label="Override value" className="h-7 w-full rounded-[4px] border border-line bg-asphalt px-2 text-[12px] outline-none focus:border-signal" />
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (required)" aria-label="Override reason" className="h-7 w-full rounded-[4px] border border-line bg-asphalt px-2 text-[12px] outline-none focus:border-signal" />
          <div className="flex gap-1.5">
            <Button size="sm" variant="signal" disabled={!val.trim() || !why.trim()} onClick={() => { setParam('overrides', { ...overrides, [r.id]: { value: val.trim(), reason: why.trim() } }); setEdit(false); }}>
              Apply override
            </Button>
            {ov && (
              <Button size="sm" variant="outline" onClick={() => { const { [r.id]: _, ...rest } = overrides; void _; setParam('overrides', rest); setVal(''); setWhy(''); setEdit(false); }}>
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
