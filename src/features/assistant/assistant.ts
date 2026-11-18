import type { Check, Fix } from '@/engine/checks';
import { RULES_BY_ID } from '@/rules/regulations';

export type AssistantContext = {
  question: string;
  checks: Check[];
  summary: { plots: number; grossAcres: number; saleablePct: number; marginPct: number; authority: string; mode: string };
};
export type Answer = { text: string; fixes: Fix[]; citations: string[] };

/** Interface the real backend will implement. Mocked locally for this phase. */
export type AskAssistant = (ctx: AssistantContext) => Promise<Answer>;

function explain(c: Check): Answer {
  const rules = c.ruleIds.map((r) => RULES_BY_ID[r.split(':')[0]]).filter(Boolean);
  const src = rules.map((r) => `${r.id} (${r.reference})`).join(', ');
  const base =
    c.status === 'conflict'
      ? `“${c.title}” has two sources that disagree: ${src}. Pick one in Regulations and add a note — the choice is kept per project as an audit trail.`
      : `“${c.title}” ${c.status === 'fail' ? 'fails' : 'needs action'}: actual ${c.actual}, required ${c.required}. Source: ${src}.`;
  const why = rules[0]?.summary ? ` The rule says: ${rules[0].summary}` : '';
  const note = c.note ? ` ${c.note}` : '';
  return { text: base + why + note, fixes: c.fixes ?? [], citations: c.ruleIds };
}

export const askAssistant: AskAssistant = async (ctx) => {
  await new Promise((r) => setTimeout(r, 380));
  const q = ctx.question.toLowerCase();
  const failing = ctx.checks.filter((c) => c.status === 'fail' || c.status === 'warn' || c.status === 'conflict');
  const named = ctx.checks.find((c) => q.includes(c.id) || q.includes(c.title.toLowerCase().slice(0, 18)) || c.ruleIds.some((r) => q.includes(r.toLowerCase())));
  if (named) return explain(named);
  if (/(why|fail|fix|wrong|issue|problem)/.test(q) && failing.length) {
    const first = explain(failing[0]);
    const more = failing.length > 1 ? ` ${failing.length - 1} other check${failing.length > 2 ? 's' : ''} also need attention: ${failing.slice(1, 4).map((c) => c.title).join('; ')}.` : '';
    return { ...first, text: first.text + more, fixes: failing.flatMap((c) => c.fixes ?? []).slice(0, 4) };
  }
  const s = ctx.summary;
  return {
    text: `This ${s.grossAcres.toFixed(2)}-acre ${s.authority} layout yields ${s.plots} plots (${s.saleablePct.toFixed(1)}% saleable) at a ${s.marginPct.toFixed(1)}% margin on the ${s.mode} engine. ${failing.length ? `${failing.length} check(s) need attention — ask “why does it fail?”.` : 'All computed checks pass or are not applicable.'} Remember: this is a yield study, not a submission drawing.`,
    fixes: [],
    citations: [],
  };
};
