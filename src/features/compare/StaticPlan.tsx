import type { Rect } from '@/engine/geometry';
import type { Layout } from '@/engine/types';
import { Defs, OpenLayer, ParcelLayer, PlotsLayer, RoadsLayer, ConstraintLayer } from '@/features/studio/layers';

export function StaticPlan({ layout, view, label }: { layout: Layout; view: Rect; label: string }) {
  const pad = 20;
  const vb = `${view.x0 - pad} ${-view.y1 - pad} ${view.x1 - view.x0 + 2 * pad} ${view.y1 - view.y0 + 2 * pad}`;
  return (
    <svg viewBox={vb} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      <Defs />
      <ParcelLayer layout={layout} />
      <ConstraintLayer layout={layout} constraints={layout.params.constraints} />
      <OpenLayer layout={layout} genKey={0} />
      <RoadsLayer layout={layout} genKey={0} />
      <PlotsLayer layout={layout} genKey={0} />
    </svg>
  );
}
