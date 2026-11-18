import { lazy, Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useDerived } from '@/state/derived';
import { useProject } from '@/state/project';
import { coverageFor } from '@/engine/massing';
import { Button, Caps, Field } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { sunPosition, istDate } from './sun';
import { Scene } from './Scene';
import { useWorkspace } from '@/state/workspace';

const RenderView = lazy(() => import('./render/RenderView'));

function ModeToggle({ mode, onChange }: { mode: 'massing' | 'render'; onChange: (m: 'massing' | 'render') => void }) {
  return (
    <div className="absolute top-3 right-3 z-10 flex rounded-full border border-line bg-asphalt-2/90 p-0.5 text-[12px] backdrop-blur" role="group" aria-label="3D mode">
      {(['massing', 'render'] as const).map((m) => (
        <button key={m} onClick={() => onChange(m)} aria-pressed={mode === m} className={`rounded-full px-3 py-1 ${mode === m ? 'bg-lane text-asphalt' : 'text-lane-dim hover:text-lane'}`}>
          {m === 'massing' ? 'Massing' : 'Render'}
        </button>
      ))}
    </div>
  );
}

const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const fmtDay = (d: number) => istDate(d, 720).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export default function ThreeView() {
  const layout = useDerived((s) => s.layout);
  const built = useProject((s) => s.params.built);
  const [day, setDay] = useState(172);
  const [minutes, setMinutes] = useState(15 * 60 + 30);
  const [fly, setFly] = useState(false);
  const [mode, setMode] = useState<'massing' | 'render'>('massing');
  const meta = useWorkspace((s) => s.meta);
  const projectName = useProject((s) => s.params.site.projectName);
  const sun = useMemo(() => sunPosition(istDate(day, minutes)), [day, minutes]);
  if (!layout) return null;
  const size = Math.max(layout.bounds.x1 - layout.bounds.x0, layout.bounds.y1 - layout.bounds.y0);
  const cov = coverageFor(layout);
  if (mode === 'render')
    return (
      <div className="relative h-full">
        <Suspense fallback={<div className="h-full bg-asphalt" />}>
          <RenderView layout={layout} type={meta?.type ?? 'plots'} name={meta?.name || projectName || 'Untitled layout'} details={meta?.details ?? {}} projectId={meta?.id} />
        </Suspense>
        <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 max-md:top-auto max-md:bottom-[140px]">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>
    );
  return (
    <div className="relative h-full">
      <ModeToggle mode={mode} onChange={setMode} />
      <Canvas shadows frameloop={fly ? 'always' : 'demand'} camera={{ position: [size * 0.75, size * 0.7, size * 0.95], fov: 40, near: 1, far: size * 10 }} dpr={[1, 2]} aria-label="3D massing view">
        <Scene layout={layout} sun={sun} fly={fly} onFlyEnd={() => setFly(false)} />
      </Canvas>
      <div className="absolute top-3 left-3 w-[min(300px,calc(100%-24px))] rounded-[4px] border border-line bg-asphalt-2/90 p-3 backdrop-blur">
        <Caps>Sun path · Hyderabad 17.385°N</Caps>
        <Field label="Date" hint={fmtDay(day)} value={day} min={1} max={365} step={1} onChange={setDay} />
        <Field label="Time (IST)" hint={fmtTime(minutes)} value={minutes} min={300} max={1200} step={5} onChange={setMinutes} />
        <div className="num mt-1 flex justify-between text-[11px] text-lane-dim">
          <span>elev {sun.elevation.toFixed(1)}°</span>
          <span>az {sun.azimuth.toFixed(1)}°</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant={fly ? 'blue' : 'outline'} onClick={() => setFly((f) => !f)}>
            <Icon name="play" size={12} /> {fly ? 'Stop fly-through' : 'Fly-through'}
          </Button>
        </div>
      </div>
      <div className="num absolute right-3 bottom-3 rounded-[4px] max-md:bottom-[84px] max-md:left-3 border border-line bg-asphalt-2/90 px-3 py-2 text-[11px] backdrop-blur">
        <div>
          G+{built.floors} · {built.floorHeight} m floors · {((built.floors + 1) * built.floorHeight).toFixed(1)} m high
        </div>
        <div className="text-lane-dim">Ground coverage {(cov * 100).toFixed(1)}% (derived from setbacks{built.setbacks ? '' : ' — off'})</div>
        <div className="text-lane-dim">Irregular plots shown as pads only</div>
      </div>
    </div>
  );
}
