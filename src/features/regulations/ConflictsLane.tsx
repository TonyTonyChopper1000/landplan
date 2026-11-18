import { useState } from 'react';
import { CONFLICT_GROUPS, RULES_BY_ID } from '@/rules/regulations';
import { useProject, setParam } from '@/state/project';
import { choice } from '@/engine/checks';
import { Badge, Button, Caps } from '@/components/ui/controls';

function Group({ id }: { id: string }) {
  const params = useProject((s) => s.params);
  const g = CONFLICT_GROUPS[id];
  const current = choice(params, id);
  const saved = params.ruleChoices[id];
  const [note, setNote] = useState(saved?.note ?? '');
  const pick = (ruleId: string) =>
    setParam('ruleChoices', { ...params.ruleChoices, [id]: { ruleId, note, at: new Date().toISOString().slice(0, 16).replace('T', ' ') } });
  return (
    <div className="rounded-[4px] border border-blueprint/40 bg-blueprint/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">{g.title}</span>
        {current ? <Badge tone="green">Applied</Badge> : <Badge tone="blue">Sources conflict</Badge>}
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {g.options.map((o) => {
          const r = RULES_BY_ID[o.ruleId.split(':')[0]];
          const on = current === o.ruleId;
          return (
            <button
              key={o.ruleId}
              type="button"
              aria-pressed={on}
              onClick={() => pick(o.ruleId)}
              className={`rounded-[4px] border p-2 text-left transition-colors ${on ? 'border-signal bg-signal/5' : 'border-line hover:border-lane-dim'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="mono text-[11px] text-blueprint">{o.ruleId.replace(':LRS', ' · LRS')}</span>
                <span className={`h-3 w-3 rounded-full border ${on ? 'border-signal bg-signal' : 'border-line'}`} />
              </div>
              <div className="mt-1 text-[12.5px] font-medium">{o.label}</div>
              <div className="mt-0.5 text-[11.5px] text-lane-dim">{r?.reference}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this choice? (kept as an audit note)" aria-label={`Note for ${g.title}`} className="h-7 flex-1 rounded-[4px] border border-line bg-asphalt px-2 text-[12px] outline-none focus:border-signal" />
        {current && (
          <Button size="sm" variant="outline" onClick={() => pick(current)}>
            Save note
          </Button>
        )}
      </div>
      {saved && (
        <p className="num mt-1 text-[10.5px] text-lane-dim">
          Chose {saved.ruleId} on {saved.at}
          {saved.note ? ` — “${saved.note}”` : ''}
        </p>
      )}
    </div>
  );
}

export function ConflictsLane() {
  return (
    <section>
      <Caps className="pb-2">Conflicts — pick which to apply</Caps>
      <div className="grid gap-3 lg:grid-cols-3">
        {Object.keys(CONFLICT_GROUPS).map((id) => (
          <Group key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
