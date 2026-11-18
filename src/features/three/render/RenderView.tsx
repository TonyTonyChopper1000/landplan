// Render mode: detailed, project-type-aware scene + sales viewer overlay. Lazy-loaded.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { istDate, sunPosition } from '../sun';
import type { Layout } from '@/engine/types';
import type { ProjectDetails, ProjectType } from '@/features/projects/types';
import { useUi } from '@/state/ui';
import { buildScene, type Built } from './build';
import { Cameras } from './Cameras';
import { AmenityLabels, PlotLabels, RoadLabels } from './Labels';
import { Plots } from './Plots';
import { Effects, Stage, useSun } from './Stage';
import { EsriGround, ProceduralGround } from './context/Ground';
import { Overlay } from './ui/Overlay';
import { registry } from './ui/registry';
import { detectQuality, PRESET_MINUTES, presetMinutes, todayDoy, useRender, type ContextMode } from './store';
import './render.css';

const GoogleTiles = lazy(() => import('./context/GoogleTiles'));
const PathTracer = lazy(() => import('./ui/PathTracer'));

export type RenderProps = {
  layout: Layout;
  type: ProjectType;
  name: string;
  details: Partial<ProjectDetails>;
  projectId?: string;
  publicView?: boolean;
  initialPlot?: number;
  onExit?: () => void;
};

const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? '';

export function isGeoreferenced(layout: Layout) {
  const s = layout.params.site;
  // A DXF import has no location: its anchor stays at the default, so it is not georeferenced.
  return s.source === 'drawn' || (s.source === 'import' && !(s.anchor.lat === 17.385 && s.anchor.lon === 78.4867));
}

function Heading() {
  const { camera, invalidate } = useThree();
  const set = useRender((s) => s.set);
  const last = useRef(0);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    camera.getWorldDirection(v);
    const h = (Math.atan2(v.x, -v.z) * 180) / Math.PI;
    if (Math.abs(h - last.current) > 1) {
      last.current = h;
      set({ heading: h });
    }
  });
  useEffect(() => {
    registry.invalidate = invalidate;
  }, [invalidate]);
  return null;
}

function Scene({ built, lat, lon, context, onContextFail }: { built: Built; lat: number; lon: number; context: ContextMode; onContextFail: () => void }) {
  const units = useUi((s) => s.units);
  const sun = useSun(lat, lon);
  const quality = useRender((s) => s.quality);
  const tracing = useRender((s) => s.tracing);
  const geo = isGeoreferenced(built.ctx.layout);
  const anchor = built.ctx.layout.params.site.anchor;
  const amenities = useRender((s) => s.layers.amenities);
  return (
    <>
      <Stage built={built} lat={lat} lon={lon} />
      <primitive object={built.root} />
      <ProceduralGround built={built} showTrees={context !== '3d'} />
      {context === 'satellite' && geo && <EsriGround built={built} anchor={anchor} onFail={onContextFail} />}
      {context === '3d' && geo && GOOGLE_KEY && (
        <Suspense fallback={null}>
          <GoogleTiles built={built} anchor={anchor} apiKey={GOOGLE_KEY} onFail={onContextFail} />
        </Suspense>
      )}
      <Plots built={built} />
      <PlotLabels ctx={built.ctx} top={built.type.pads.top} units={built.ctx.type === 'farm' ? 'acre' : units} />
      <RoadLabels ctx={built.ctx} />
      {amenities && <AmenityLabels ctx={built.ctx} />}
      <Cameras ctx={built.ctx} />
      <Heading />
      {!tracing && <Effects night={sun.night} dof={false} />}
      {quality === 'ultra' && (
        <Suspense fallback={null}>
          <PathTracer />
        </Suspense>
      )}
    </>
  );
}

export default function RenderView(props: RenderProps) {
  const { layout, type, name, details, publicView } = props;
  const [built, setBuilt] = useState<Built | null>(null);
  const [progress, setProgress] = useState<{ p: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(!!publicView);
  const set = useRender((s) => s.set);
  const quality = useRender((s) => s.quality);
  const context = useRender((s) => s.layers.context);
  const lat = isGeoreferenced(layout) ? layout.params.site.anchor.lat : 17.385;
  const lon = isGeoreferenced(layout) ? layout.params.site.anchor.lon : 78.4867;
  const roadNamesKey = `lp-roadnames-${props.projectId ?? 'scratch'}`;
  const [roadNames, setRoadNames] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(roadNamesKey) ?? '{}');
    } catch {
      return {};
    }
  });

  // Fresh viewer state per mount; deep link ?plot=N and ?quality=… honoured.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const geo = isGeoreferenced(layout);
    set({
      selected: null,
      focus: null,
      sheet: null,
      camera: 'aerial',
      day: todayDoy(),
      minutes: PRESET_MINUTES.noon,
      preset: 'noon',
      layers: { status: true, labels: true, future: false, amenities: true, context: geo && GOOGLE_KEY ? '3d' : 'satellite' },
      filter: { status: [], budget: null, size: 'all', custom: [0, 0], facing: [], frontage: 0, cornerOnly: false },
    });
    const qq = q.get('quality');
    if (qq === 'mobile' || qq === 'high' || qq === 'ultra') set({ quality: qq });
    const t = q.get('light');
    if (t === 'morning' || t === 'noon' || t === 'golden' || t === 'night') set({ preset: t, minutes: presetMinutes(t, todayDoy(), (dd, mm) => sunPosition(istDate(dd, mm), lat, lon).elevation) });
    const cam = q.get('camera');
    if (cam === 'plan' || cam === 'walk' || cam === 'aerial') set({ camera: cam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, set]);

  useEffect(() => {
    if (!started) return;
    const signal = { cancelled: false };
    let result: Built | null = null;
    setError(null);
    buildScene(layout, type, name, details, roadNames, (p, label) => setProgress({ p, label }), signal)
      .then((b) => {
        if (signal.cancelled) {
          b?.dispose();
          return;
        }
        result = b;
        setBuilt(b);
        setProgress(null);
        const plot = props.initialPlot ?? Number(new URLSearchParams(window.location.search).get('plot'));
        if (plot && b?.ctx.layout.plots.some((p) => p.no === plot)) setTimeout(() => set({ selected: plot, focus: { no: plot, k: Date.now() } }), 400);
      })
      .catch((e: Error) => setError(e.message || 'Render failed'));
    return () => {
      signal.cancelled = true;
      setBuilt(null);
      result?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, layout, type, name, details, roadNames]);

  const onContextFail = useCallback(() => {
    const c = useRender.getState().layers.context;
    const layers = useRender.getState().layers;
    set({ layers: { ...layers, context: c === '3d' ? 'satellite' : 'off' } });
  }, [set]);

  const renameRoad = (id: string, text: string) => {
    const next = { ...roadNames, [id]: text };
    setRoadNames(next);
    try {
      localStorage.setItem(roadNamesKey, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };

  const dpr: [number, number] = quality === 'mobile' ? [1, 1.25] : [1, 2];
  if (!started)
    return (
      <div className="rv-root rv-poster">
        <div className="rv-poster-card">
          <div className="rv-eyebrow">Render mode</div>
          <h2 className="rv-serif">{name || 'Untitled project'}</h2>
          <p>
            Builds a detailed scene for this {type === 'villas' ? 'villa community' : type === 'farm' ? 'farm-plot venture' : 'plotted layout'} from the current layout: roads with
            markings, compound wall and gate, gardens and amenities{type === 'villas' ? ', every villa from its setbacks' : type === 'farm' ? ', plantation rows and fencing' : ', levelled plot pads'}. Takes a few seconds.
          </p>
          <button className="rv-cta" onClick={() => setStarted(true)} data-testid="generate-render">
            Generate render
          </button>
        </div>
      </div>
    );

  return (
    <div className="rv-root" data-testid="render-view" data-ready={built ? 'true' : 'false'}>
      <Canvas
        shadows="soft"
        flat
        dpr={dpr}
        frameloop={quality === 'mobile' ? 'demand' : 'always'}
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 38, near: 0.5, far: 20000, position: [200, 200, 200] }}
        onCreated={({ gl, scene, camera, setDpr }) => {
          registry.gl = gl;
          registry.setDpr = setDpr;
          registry.scene = scene;
          registry.camera = camera;
          const d = detectQuality(gl.getContext());
          const forced = new URLSearchParams(window.location.search).get('quality');
          set({ ultraBlocked: d.ultraBlocked, ...(forced ? {} : { quality: d.quality }) });
        }}
        aria-label="3D render of the project"
      >
        {built && <Scene built={built} lat={lat} lon={lon} context={context} onContextFail={onContextFail} />}
      </Canvas>
      {built && <Overlay built={built} props={props} lat={lat} lon={lon} context={context} geo={isGeoreferenced(layout)} googleAvailable={!!GOOGLE_KEY && isGeoreferenced(layout)} onRenameRoad={renameRoad} />}
      {!built && !error && (
        <div className="rv-progress" role="status">
          <div className="rv-serif rv-progress-title">{name}</div>
          <div className="rv-bar">
            <div style={{ width: `${Math.round((progress?.p ?? 0.02) * 100)}%` }} />
          </div>
          <div className="rv-progress-label">{progress?.label ?? 'Preparing'}…</div>
        </div>
      )}
      {error && (
        <div className="rv-progress" role="alert">
          <div>Could not build the render: {error}</div>
          <button className="rv-cta" onClick={() => setStarted(false)}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
