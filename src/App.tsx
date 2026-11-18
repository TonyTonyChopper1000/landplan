import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUi } from '@/state/ui';
import { startDeriving } from '@/state/derived';
import { hydrate, startAutosave } from '@/state/persist';
import { useMedia, useMobile, useWide } from '@/lib/useMedia';
import { TopBar } from '@/features/shell/TopBar';
import { LeftRail, PanelStack, RailIcons } from '@/features/shell/LeftRail';
import { BottomDock } from '@/features/shell/BottomDock';
import { TabBar } from '@/features/shell/TabBar';
import { CommandPalette } from '@/features/shell/CommandPalette';
import { useShortcuts } from '@/features/shell/useShortcuts';
import { StudioView } from '@/features/studio/StudioView';
import { Inspector } from '@/features/studio/Inspector';
import { OptimizerDrawer } from '@/features/studio/OptimizerDrawer';
import { ScheduleView } from '@/features/schedule/ScheduleView';
import { FeasibilityView } from '@/features/feasibility/FeasibilityView';
import { FinancialsView } from '@/features/financials/FinancialsView';
import { RegulationsView } from '@/features/regulations/RegulationsView';
import { CompareView } from '@/features/compare/CompareView';
import { ExportDrawer } from '@/features/reports/ExportDrawer';
import { AssistantDrawer } from '@/features/assistant/AssistantDrawer';
import { Icon } from '@/components/ui/Icon';

const ThreeView = lazy(() => import('@/features/three/ThreeView'));

function Drawer({ children, label, width = 380 }: { children: ReactNode; label: string; width?: number }) {
  const mobile = useMobile();
  return (
    <motion.aside
      aria-label={label}
      initial={mobile ? { y: '100%' } : { x: width }}
      animate={mobile ? { y: 0 } : { x: 0 }}
      exit={mobile ? { y: '100%' } : { x: width }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed z-40 border-line bg-asphalt-2 shadow-2xl max-md:inset-x-0 max-md:bottom-0 max-md:h-[78vh] max-md:rounded-t-[8px] max-md:border-t md:top-12 md:right-0 md:bottom-0 md:border-l"
      style={mobile ? undefined : { width: `min(${width}px, 100vw)` }}
    >
      {children}
    </motion.aside>
  );
}

function DrawerHost() {
  const drawer = useUi((s) => s.drawer);
  const wide = useWide();
  const close = () => useUi.setState({ drawer: 'none' });
  return (
    <AnimatePresence>
      {drawer === 'optimizer' && (
        <Drawer key="opt" label="Optimizer" width={420}>
          <OptimizerDrawer />
        </Drawer>
      )}
      {drawer === 'assistant' && (
        <Drawer key="ai" label="Assistant" width={400}>
          <AssistantDrawer />
        </Drawer>
      )}
      {drawer === 'export' && (
        <Drawer key="ex" label="Export" width={360}>
          <ExportDrawer />
        </Drawer>
      )}
      {drawer === 'inspector' && !wide && (
        <Drawer key="insp" label="Inspector" width={320}>
          <div className="flex h-full flex-col">
            <div className="flex justify-end p-1">
              <button type="button" aria-label="Close inspector" onClick={close} className="p-2 text-lane-dim hover:text-lane">
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Inspector />
            </div>
          </div>
        </Drawer>
      )}
      {drawer === 'params' && (
        <Drawer key="params" label="Parameters">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-line">
              <RailIcons vertical={false} />
              <button type="button" aria-label="Close parameters" onClick={close} className="p-2 text-lane-dim hover:text-lane">
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PanelStack />
            </div>
          </div>
        </Drawer>
      )}
    </AnimatePresence>
  );
}

function Toast() {
  const msg = useUi((s) => s.toast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center">
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[4px] border border-blueprint/50 bg-asphalt-2 px-3 py-2 text-[12px] shadow-[var(--glow-blue)]">
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Route() {
  const tab = useUi((s) => s.tab);
  switch (tab) {
    case 'studio':
      return <StudioView />;
    case '3d':
      return (
        <Suspense fallback={<div className="drafting-grid flex h-full items-center justify-center text-[12px] text-lane-dim">Loading 3D massing…</div>}>
          <ThreeView />
        </Suspense>
      );
    case 'schedule':
      return <ScheduleView />;
    case 'feasibility':
      return <FeasibilityView />;
    case 'financials':
      return <FinancialsView />;
    case 'regulations':
      return <RegulationsView />;
    case 'compare':
      return <CompareView />;
  }
}

export function App() {
  const theme = useUi((s) => s.theme);
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const md = useMedia('(min-width: 768px)');
  useShortcuts();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    let stopA = () => {};
    let stopB = () => {};
    hydrate().finally(() => {
      stopA = startDeriving();
      stopB = startAutosave(setSavedAt);
      setReady(true);
    });
    return () => {
      stopA();
      stopB();
    };
  }, []);
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[48px_minmax(0,1fr)_auto] overflow-hidden">
      <TopBar savedAt={savedAt} />
      <div className="flex min-h-0">
        {md && <LeftRail />}
        <main className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <div className="relative min-h-0 flex-1">{ready ? <Route /> : <div className="drafting-grid h-full" />}</div>
        </main>
      </div>
      <BottomDock />
      {!md && (
        <button
          type="button"
          onClick={() => useUi.setState({ drawer: 'params' })}
          className="fixed right-4 bottom-[96px] z-30 flex h-11 items-center gap-2 rounded-full bg-signal px-4 text-[13px] font-medium text-[#140800] shadow-[var(--glow-signal)]"
        >
          <Icon name="menu" size={16} /> Parameters
        </button>
      )}
      <DrawerHost />
      <CommandPalette />
      <Toast />
    </div>
  );
}
