import { useUi, TABS, type Tab } from '@/state/ui';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/controls';
import { t } from '@/i18n';

const ICON: Record<Tab, string> = {
  studio: 'grid',
  '3d': 'cube',
  schedule: 'table',
  feasibility: 'shield',
  financials: 'chart',
  regulations: 'book',
  compare: 'compare',
};

export function TabBar() {
  const tab = useUi((s) => s.tab);
  return (
    <div role="tablist" aria-label="Views" className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-line bg-asphalt px-2">
      {TABS.map((id, i) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={tab === id}
          onClick={() => useUi.setState({ tab: id })}
          title={`${t(`tab.${id}`)} (${i + 1})`}
          className={cx(
            'relative flex h-8 shrink-0 items-center gap-1.5 px-3 text-[12px] transition-colors',
            tab === id ? 'text-lane' : 'text-lane-dim hover:text-lane',
          )}
        >
          <Icon name={ICON[id]} size={14} className={tab === id ? 'text-signal' : undefined} />
          {t(`tab.${id}`)}
          <span className="mono hidden text-[10px] text-lane-dim/60 lg:inline">{i + 1}</span>
          {tab === id && <span className="absolute inset-x-2 bottom-[-1px] h-[2px] bg-signal" />}
        </button>
      ))}
    </div>
  );
}
