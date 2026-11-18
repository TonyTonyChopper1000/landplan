import { DOCUMENT_CHECKS } from '@/rules/regulations';
import { useProject, setParam } from '@/state/project';
import type { DocStatus } from '@/engine/types';
import { Select } from '@/components/ui/controls';

const OPTS: { value: DocStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'na', label: 'N/A' },
];

export function DocChecks() {
  const docs = useProject((s) => s.params.documents);
  const set = (id: string, patch: Partial<{ status: DocStatus; note: string }>) =>
    setParam('documents', { ...docs, [id]: { ...(docs[id] ?? { status: 'pending', note: '' }), ...patch } });
  const done = DOCUMENT_CHECKS.filter((d) => docs[d.id]?.status === 'done').length;
  return (
    <div className="rounded-[4px] border border-line">
      <div className="num flex items-center justify-between border-b border-line px-3 py-2 text-[11.5px] text-lane-dim">
        <span>Manual checklist — evidence is tracked here, not verified by the engine</span>
        <span>
          {done}/{DOCUMENT_CHECKS.length} done
        </span>
      </div>
      <ul>
        {DOCUMENT_CHECKS.map((d) => {
          const cur = docs[d.id] ?? { status: 'pending' as DocStatus, note: '' };
          return (
            <li key={d.id} className="grid grid-cols-1 items-center gap-2 border-b border-line px-3 py-2 last:border-0 md:grid-cols-[1fr_120px_1fr_auto]">
              <span className="text-[12.5px]">
                {d.title}
                {d.rule && <span className="mono ml-1.5 text-[10.5px] text-blueprint">{d.rule}</span>}
              </span>
              <Select label={`${d.title} status`} value={cur.status} options={OPTS} onChange={(v) => set(d.id, { status: v })} />
              <input aria-label={`${d.title} note`} value={cur.note} onChange={(e) => set(d.id, { note: e.target.value })} placeholder="Reference / note" className="h-7 rounded-[4px] border border-line bg-asphalt px-2 text-[12px] outline-none focus:border-signal" />
              <label className="cursor-pointer rounded-[4px] border border-dashed border-line px-2 py-1 text-[11px] text-lane-dim hover:border-blueprint hover:text-blueprint">
                Evidence…
                <input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && set(d.id, { note: `${cur.note ? cur.note + ' · ' : ''}📎 ${e.target.files[0].name}` })} />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
