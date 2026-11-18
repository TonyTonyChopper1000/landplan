import { useDerived } from '@/state/derived';
import { useProject } from '@/state/project';
import { go105 } from '@/state/actions';
import { Button, Caps } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { ComplianceRing } from '@/features/shell/ComplianceRing';
import { t } from '@/i18n';
import { CheckList } from './CheckList';
import { DocChecks } from './DocChecks';
import { AreaStatement, PlotMix, RoadRuns } from './Tables';

function Tally() {
  const tally = useDerived((s) => s.tally);
  const items = [
    { k: 'verified', label: t('ring.verified'), cls: 'text-green-ink' },
    { k: 'failing', label: t('ring.failing'), cls: 'text-brake-ink' },
    { k: 'conflict', label: t('ring.conflict'), cls: 'text-blueprint' },
    { k: 'notChecked', label: t('ring.notChecked'), cls: 'text-lane-dim' },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[4px] border border-line bg-asphalt-2 p-3">
      <ComplianceRing size={56} />
      {items.map((i) => (
        <div key={i.k}>
          <div className={`num text-2xl font-semibold ${i.cls}`}>{tally[i.k]}</div>
          <div className="caps text-[10px] text-lane-dim">{i.label}</div>
        </div>
      ))}
    </div>
  );
}

export function FeasibilityView() {
  const layout = useDerived((s) => s.layout);
  const checks = useDerived((s) => s.checks);
  const mode = useProject((s) => s.params.mode);
  if (!layout) return null;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Feasibility</h1>
            <p className="text-[12px] text-lane-dim">{t('app.disclaimer')}. Each check cites the rules it relies on; a check without a source never shows a tick.</p>
          </div>
          {mode === 'parity' && (
            <Button variant="blue" onClick={go105}>
              <Icon name="shield" size={14} /> {t('top.go105')}
            </Button>
          )}
        </div>
        <Tally />
        <section>
          <Caps className="pb-2">Geometry checks (computed)</Caps>
          <CheckList checks={checks} />
        </section>
        <section>
          <Caps className="pb-2">Document checks (manual)</Caps>
          <DocChecks />
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <Caps className="pb-2">Area statement</Caps>
            <AreaStatement layout={layout} />
          </div>
          <div>
            <Caps className="pb-2">Road runs</Caps>
            <RoadRuns layout={layout} />
          </div>
        </section>
        <section>
          <Caps className="pb-2">Plot mix</Caps>
          <PlotMix layout={layout} />
        </section>
      </div>
    </div>
  );
}
