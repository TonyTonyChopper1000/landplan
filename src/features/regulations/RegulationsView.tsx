import { useMemo, useState } from 'react';
import { RULES, RULES_VERSION, type Rule, type RuleCategory } from '@/rules/regulations';
import { Button, Select } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { toast } from '@/state/ui';
import { t } from '@/i18n';
import { ConflictsLane } from './ConflictsLane';
import { RuleCard } from './RuleCard';

const CATS = Array.from(new Set(RULES.map((r) => r.category))) as RuleCategory[];

export function RegulationsView() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | RuleCategory>('all');
  const [auth, setAuth] = useState<'all' | 'HMDA' | 'DTCP' | 'MUNICIPAL'>('all');
  const [status, setStatus] = useState<'all' | Rule['status']>('all');
  const [src, setSrc] = useState<'all' | Rule['sourceType']>('all');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return RULES.filter(
      (r) =>
        (cat === 'all' || r.category === cat) &&
        (auth === 'all' || r.authorities.includes(auth)) &&
        (status === 'all' || r.status === status) &&
        (src === 'all' || r.sourceType === src) &&
        (!s || `${r.id} ${r.title} ${r.reference} ${r.summary}`.toLowerCase().includes(s)),
    );
  }, [q, cat, auth, status, src]);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] space-y-5 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Regulations</h1>
            <p className="num text-[12px] text-lane-dim">
              {RULES.length} rules · seed version {RULES_VERSION} · researched 17 Nov 2026
            </p>
          </div>
          <Button variant="outline" onClick={() => toast('Live rule updates arrive with the backend phase. Rules ship as versioned seed data.')}>
            <Icon name="rotate" size={13} /> Update rules
          </Button>
        </div>
        <div role="note" className="flex items-start gap-2 rounded-[4px] border border-signal/50 bg-signal/5 p-3 text-[12.5px]">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-signal" />
          <span>{t('app.rulesBanner')}</span>
        </div>
        <ConflictsLane />
        <section className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_repeat(4,160px)]">
            <label className="flex h-7 items-center gap-2 rounded-[4px] border border-line bg-asphalt px-2 focus-within:border-signal">
              <Icon name="search" size={13} className="text-lane-dim" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search id, title, GO…" aria-label="Search rules" className="w-full bg-transparent text-[12px] outline-none" />
            </label>
            <Select label="Category" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...CATS.map((c) => ({ value: c, label: c }))]} />
            <Select label="Authority" value={auth} onChange={setAuth} options={[{ value: 'all', label: 'All authorities' }, { value: 'HMDA', label: 'HMDA' }, { value: 'DTCP', label: 'DTCP' }, { value: 'MUNICIPAL', label: 'Municipal' }]} />
            <Select label="Status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Any status' }, { value: 'in-force', label: 'In force' }, { value: 'conflict', label: 'Conflict' }, { value: 'verify', label: 'Verify' }]} />
            <Select label="Source type" value={src} onChange={setSrc} options={[{ value: 'all', label: 'Any source' }, { value: 'official', label: 'Official' }, { value: 'go-copy', label: 'GO copy' }, { value: 'secondary', label: 'Secondary' }]} />
          </div>
          <p className="num text-[11px] text-lane-dim">{list.length} shown</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <RuleCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
