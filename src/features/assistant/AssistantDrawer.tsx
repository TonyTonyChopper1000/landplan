import { useState } from 'react';
import { useDerived } from '@/state/derived';
import { useProject } from '@/state/project';
import { useUi } from '@/state/ui';
import { applyFix } from '@/state/actions';
import { ACRE } from '@/engine/geometry';
import { Button, Caps } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n';
import { askAssistant, type Answer } from './assistant';

type Msg = { role: 'user' | 'assistant'; text: string; answer?: Answer };

export function AssistantDrawer() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const checks = useDerived((s) => s.checks);
  const failing = checks.filter((c) => c.status === 'fail' || c.status === 'conflict' || c.status === 'warn');
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setQ('');
    setBusy(true);
    const { layout, fin } = useDerived.getState();
    const p = useProject.getState().params;
    const answer = await askAssistant({
      question,
      checks: useDerived.getState().checks,
      summary: {
        plots: layout?.plots.length ?? 0,
        grossAcres: (layout?.gross ?? 0) / ACRE,
        saleablePct: layout ? (layout.plotted / layout.gross) * 100 : 0,
        marginPct: fin?.marginPct ?? 0,
        authority: p.site.authority,
        mode: p.mode === 'rules' ? 'rule-aware' : 'v1 parity',
      },
    });
    setMsgs((m) => [...m, { role: 'assistant', text: answer.text, answer }]);
    setBusy(false);
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <Caps>{t('assistant.title')}</Caps>
          <div className="text-[10.5px] text-lane-dim">{t('assistant.mock')}</div>
        </div>
        <Button size="sm" title="Close" onClick={() => useUi.setState({ drawer: 'none' })}>
          <Icon name="close" />
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {!msgs.length && (
          <div className="space-y-2">
            <p className="text-[12px] text-lane-dim">Ask why a check fails. Suggested fixes apply in one click and can be undone (⌘Z).</p>
            {failing.slice(0, 5).map((c) => (
              <button key={c.id} type="button" onClick={() => void ask(`Why does ${c.title.toLowerCase()} ${c.status === 'conflict' ? 'conflict' : 'fail'}?`)} className="block w-full rounded-[4px] border border-line px-2.5 py-2 text-left text-[12px] hover:border-blueprint">
                Why does <em className="not-italic text-blueprint">{c.title}</em> {c.status === 'conflict' ? 'conflict' : 'fail'}?
              </button>
            ))}
            <button type="button" onClick={() => void ask('Summarise this layout')} className="block w-full rounded-[4px] border border-line px-2.5 py-2 text-left text-[12px] hover:border-blueprint">
              Summarise this layout
            </button>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'ml-8 rounded-[4px] bg-asphalt-3 px-3 py-2 text-[12.5px]' : 'mr-4 text-[12.5px] leading-relaxed'}>
            {m.text}
            {m.answer?.citations.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.answer.citations.map((c) => (
                  <span key={c} className="mono rounded-[2px] border border-line px-1 text-[10.5px] text-blueprint">{c}</span>
                ))}
              </div>
            ) : null}
            {m.answer?.fixes.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.answer.fixes.map((f) => (
                  <Button key={f.label} size="sm" variant="blue" onClick={() => applyFix(f.patch, f.label)}>
                    <Icon name="bolt" size={12} /> {f.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy && <div className="skeleton h-12 rounded-[4px]" />}
      </div>
      <form
        className="flex gap-2 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('assistant.placeholder')} aria-label="Message" className="h-8 flex-1 rounded-[4px] border border-line bg-asphalt px-2 text-[12.5px] outline-none focus:border-signal" />
        <Button type="submit" variant="signal" disabled={busy || !q.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}
