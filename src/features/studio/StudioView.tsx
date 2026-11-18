import { lazy, Suspense } from 'react';
import { useDerived } from '@/state/derived';
import { useUi } from '@/state/ui';
import { useWide } from '@/lib/useMedia';
import { PlanCanvas } from './PlanCanvas';
import { Inspector } from './Inspector';
import { NoPlots } from './EmptyState';

const MapTrace = lazy(() => import('./MapTrace'));

export function StudioView() {
  const layout = useDerived((s) => s.layout);
  const error = useDerived((s) => s.error);
  const params = useDerived((s) => s.params);
  const mapTrace = useUi((s) => s.mapTrace);
  const wide = useWide();
  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        {layout ? <PlanCanvas layout={layout} /> : <div className="drafting-grid h-full" />}
        {layout && params && layout.plots.length === 0 && <NoPlots params={params} />}
        {error && (
          <div className="absolute inset-x-6 top-16 rounded-[4px] border border-brake/60 bg-asphalt-2 p-3 text-[12px]">
            <strong className="text-brake-ink">The engine could not build this layout.</strong> {error}
          </div>
        )}
        {mapTrace && (
          <Suspense fallback={<div className="skeleton absolute inset-0" />}>
            <MapTrace />
          </Suspense>
        )}
      </div>
      {wide && (
        <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-line bg-asphalt-2" aria-label="Inspector">
          <Inspector />
        </aside>
      )}
    </div>
  );
}
