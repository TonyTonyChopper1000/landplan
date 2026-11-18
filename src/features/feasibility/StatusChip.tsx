import type { CheckStatus } from '@/engine/checks';
import { Badge } from '@/components/ui/controls';
import { t } from '@/i18n';

const TONE: Record<CheckStatus, 'green' | 'red' | 'blue' | 'unk' | 'signal' | 'dim'> = {
  pass: 'green',
  fail: 'red',
  warn: 'signal',
  na: 'unk',
  'not-checked': 'unk',
  conflict: 'blue',
  overridden: 'dim',
};
const GLYPH: Record<CheckStatus, string> = { pass: '✓', fail: '✕', warn: '!', na: '–', 'not-checked': '?', conflict: '⇄', overridden: '✎' };

export function StatusChip({ status }: { status: CheckStatus }) {
  return (
    <Badge tone={TONE[status]} className="w-[118px] justify-start">
      <span aria-hidden className="mono w-3 text-center">{GLYPH[status]}</span>
      {t(`status.${status}`)}
    </Badge>
  );
}
