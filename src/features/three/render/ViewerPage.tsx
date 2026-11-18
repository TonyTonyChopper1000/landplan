// Public viewer: /view/:projectId (and /view/demo-plots|villas|farm). Render mode only,
// editorial overlay + toolbar, no editing UI.
import { lazy, Suspense, useEffect, useState } from 'react';
import { generate } from '@/engine/layout';
import { mulberry32 } from '@/engine/prng';
import type { Layout, PlotStatus } from '@/engine/types';
import { loadProject } from '@/features/projects/repo';
import { defaultDetails, paramsFor, type ProjectDetails, type ProjectType } from '@/features/projects/types';

const RenderView = lazy(() => import('./RenderView'));

type Loaded = { layout: Layout; type: ProjectType; name: string; details: Partial<ProjectDetails>; id?: string };

const DEMO_NAMES: Record<ProjectType, string> = { plots: 'Kothwalguda Greens', villas: 'Aranya Villas', farm: 'Mango Meadows Farms' };

function demo(type: ProjectType): Loaded {
  const details: ProjectDetails = { ...defaultDetails(type), village: type === 'farm' ? 'Chevella' : 'Shankarpally', location: 'Rangareddy', surveyNos: '112/A, 113, 114/1' };
  const params = paramsFor(type, DEMO_NAMES[type], details);
  const layout0 = generate(params);
  // Sprinkle a believable sales state so status colours mean something.
  const r = mulberry32(5);
  const inventory: Record<number, { status?: PlotStatus }> = {};
  for (const p of layout0.plots) {
    const x = r();
    if (x < 0.22) inventory[p.no] = { status: 'Sold' };
    else if (x < 0.32) inventory[p.no] = { status: 'Booked' };
    else if (x < 0.36) inventory[p.no] = { status: 'Held' };
  }
  const layout = generate({ ...params, inventory });
  return { layout, type, name: DEMO_NAMES[type], details };
}

export function ViewerPage({ id }: { id: string }) {
  const [state, setState] = useState<Loaded | null | 'missing'>(null);
  useEffect(() => {
    let alive = true;
    const m = /^demo-(plots|villas|farm)$/.exec(id);
    if (m) {
      setState(demo(m[1] as ProjectType));
      return;
    }
    loadProject(id)
      .then((b) => {
        if (!alive) return;
        const sc = b?.scenarios.find((s) => s.id === b.activeId) ?? b?.scenarios[0];
        if (!b || !sc) return setState('missing');
        setState({ layout: generate(sc.params), type: b.meta.type, name: b.meta.name, details: b.meta.details, id: b.meta.id });
      })
      .catch(() => alive && setState('missing'));
    return () => {
      alive = false;
    };
  }, [id]);
  useEffect(() => {
    if (state && state !== 'missing') document.title = `${state.name} · 3D viewer`;
  }, [state]);
  if (state === 'missing')
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: '#0d1014', color: '#f6f3ec', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 500 }}>Project not found</h1>
          <p style={{ opacity: 0.7 }}>This viewer link may be out of date, or the project was saved only in another browser.</p>
        </div>
      </div>
    );
  return (
    <div style={{ height: '100dvh', background: '#0d1014' }}>
      {state && (
        <Suspense fallback={null}>
          <RenderView layout={state.layout} type={state.type} name={state.name} details={state.details} projectId={state.id ?? id} publicView />
        </Suspense>
      )}
    </div>
  );
}
