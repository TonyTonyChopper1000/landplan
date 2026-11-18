import { AnimatePresence, motion } from 'motion/react';
import { useUi, type PanelId } from '@/state/ui';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/controls';
import { t } from '@/i18n';
import { SitePanel } from '@/features/panels/SitePanel';
import { ConstraintsPanel } from '@/features/panels/ConstraintsPanel';
import { BuiltPanel, MoneyPanel, OpenPanel, PlotsPanel, RoadsPanel } from '@/features/panels/MorePanels';
import type { ReactNode } from 'react';

export const PANELS: { id: PanelId; icon: string; label: string; body: () => ReactNode }[] = [
  { id: 'site', icon: 'site', label: t('panel.site'), body: () => <SitePanel /> },
  { id: 'constraints', icon: 'constraints', label: t('panel.constraints'), body: () => <ConstraintsPanel /> },
  { id: 'plots', icon: 'plots', label: t('panel.plots'), body: () => <PlotsPanel /> },
  { id: 'roads', icon: 'roads', label: t('panel.roads'), body: () => <RoadsPanel /> },
  { id: 'open', icon: 'open', label: t('panel.open'), body: () => <OpenPanel /> },
  { id: 'built', icon: 'built', label: t('panel.built'), body: () => <BuiltPanel /> },
  { id: 'money', icon: 'money', label: t('panel.money'), body: () => <MoneyPanel /> },
];

export function RailIcons({ vertical = true }: { vertical?: boolean }) {
  const panel = useUi((s) => s.panel);
  return (
    <nav aria-label="Parameter panels" className={cx('flex gap-1', vertical ? 'flex-col p-1.5' : 'overflow-x-auto px-2 py-1')}>
      {PANELS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-label={p.label}
          aria-pressed={panel === p.id}
          title={p.label}
          onClick={() => useUi.setState({ panel: panel === p.id && vertical ? null : p.id })}
          className={cx(
            'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] transition-colors',
            panel === p.id ? 'bg-asphalt-3 text-signal' : 'text-lane-dim hover:bg-asphalt-3 hover:text-lane',
          )}
        >
          {panel === p.id && vertical && <span className="absolute top-2 bottom-2 left-[-6px] w-[2px] bg-signal" />}
          <Icon name={p.icon} size={17} />
        </button>
      ))}
    </nav>
  );
}

/** Accordion of all parameter panels; the rail picks which one is open. */
export function PanelStack() {
  const panel = useUi((s) => s.panel);
  return (
    <div className="flex flex-col">
      {PANELS.map((p) => {
        const open = panel === p.id;
        return (
          <section key={p.id} className="border-b border-line">
            <h2>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => useUi.setState({ panel: open ? null : p.id })}
                className="flex h-9 w-full items-center gap-2 px-3 text-left hover:bg-asphalt-3"
              >
                <Icon name={p.icon} size={14} className={open ? 'text-signal' : 'text-lane-dim'} />
                <span className="caps flex-1 text-[11.5px]">{p.label}</span>
                <Icon name="chevron" size={12} className={cx('text-lane-dim transition-transform', open && 'rotate-90')} />
              </button>
            </h2>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pt-1 pb-3">{p.body()}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

export function LeftRail() {
  const panel = useUi((s) => s.panel);
  return (
    <aside className="flex min-h-0 border-r border-line bg-asphalt-2">
      <RailIcons />
      {panel && (
        <div className="w-[292px] min-h-0 overflow-y-auto border-l border-line">
          <PanelStack />
        </div>
      )}
    </aside>
  );
}
