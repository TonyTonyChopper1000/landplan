import { lazy, Suspense, useState } from 'react';
import { useDerived } from '@/state/derived';
import { useUi } from '@/state/ui';
import { useWide } from '@/lib/useMedia';
import { PlanCanvas } from './PlanCanvas';
import { Inspector } from './Inspector';
import { NoPlots } from './EmptyState';

const MapTrace = lazy(() => import('./MapTrace'));
const SatellitePlan = lazy(() => import('./SatellitePlan'));

export function StudioView() {
  const layout = useDerived((s) => s.layout);
  const error = useDerived((s) => s.error);
  const params = useDerived((s) => s.params);
  const mapTrace = useUi((s) => s.mapTrace);
  const wide = useWide();
  const [sat, setSat] = useState(false);
  const site = params?.site;
  const geo = !!site && (site.source === 'drawn' || (site.source === 'import' && !(site.anchor.lat === 17.385 && site.anchor.lon === 78.4867)));
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
        {layout && sat && geo && (
          <Suspense fallback={<div className="skeleton absolute inset-0" />}>
            <SatellitePlan layout={layout} />
          </Suspense>
        )}
        {layout && (
          <button
            type="button"
            onClick={() => setSat((v) => !v)}
            disabled={!geo}
            aria-pressed={sat && geo}
            title={geo ? 'Show the layout on satellite imagery' : 'Trace the parcel on the map or import KML to see it on satellite imagery'}
            className="absolute top-3 left-3 z-20 rounded-full border border-line bg-asphalt-2/90 px-3 py-1 text-[12px] backdrop-blur hover:text-lane disabled:opacity-40 aria-pressed:bg-lane aria-pressed:text-asphalt"
          >
            Satellite
          </button>
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
