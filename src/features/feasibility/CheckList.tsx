import type { Check } from '@/engine/checks';
import { useUi } from '@/state/ui';
import { applyFix } from '@/state/actions';
import { Badge, Button } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { StatusChip } from './StatusChip';

export function focusCheck(c: Check) {
  if (!c.highlight) return;
  useUi.setState({ highlight: { checkId: c.id, h: c.highlight }, tab: 'studio' });
}

export function CheckRow({ c }: { c: Check }) {
  const active = useUi((s) => s.highlight?.checkId === c.id);
  const canFocus = !!c.highlight && Object.values(c.highlight).some((v) => v && v.length);
  return (
    <li className={`grid grid-cols-1 gap-2 border-b border-line px-3 py-2.5 md:grid-cols-[130px_1fr_auto] md:items-start ${active ? 'bg-brake/5' : ''}`}>
      <StatusChip status={c.status} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium">{c.title}</span>
          {c.verify && <Badge tone="signal">Verify source</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {c.ruleIds.map((r) => (
            <button key={r} type="button" onClick={() => useUi.setState({ tab: 'regulations' })} className="mono rounded-[2px] border border-line px-1 text-[10.5px] text-blueprint hover:border-blueprint" title="Open in Regulations">
              {r.replace(':LRS', ' (LRS)')}
            </button>
          ))}
        </div>
        <div className="num mt-1 grid grid-cols-[64px_1fr] gap-x-2 text-[11.5px]">
          <span className="text-lane-dim">Actual</span>
          <span>{c.actual}</span>
          <span className="text-lane-dim">Required</span>
          <span>{c.required}</span>
        </div>
        {c.note && <p className="mt-1 text-[11.5px] text-lane-dim">{c.note}</p>}
        {c.fixes && c.fixes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.fixes.map((f) => (
              <Button key={f.label} size="sm" variant="blue" onClick={() => applyFix(f.patch, f.label)}>
                <Icon name="bolt" size={12} /> {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {canFocus && (c.status === 'fail' || c.status === 'warn') && (
        <Button size="sm" variant="outline" onClick={() => focusCheck(c)} title="Highlight offending geometry on the plan">
          <Icon name="target" size={13} /> Show on plan
        </Button>
      )}
    </li>
  );
}

export function CheckList({ checks }: { checks: Check[] }) {
  const order = { fail: 0, warn: 1, conflict: 2, overridden: 3, pass: 4, 'not-checked': 5, na: 6 } as const;
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);
  return <ul className="rounded-[4px] border border-line">{sorted.map((c) => <CheckRow key={c.id} c={c} />)}</ul>;
}
