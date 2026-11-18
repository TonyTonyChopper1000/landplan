import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDerived } from '@/state/derived';
import { useProject } from '@/state/project';
import { useUi } from '@/state/ui';
import { bbox, pointInPoly, pointInRegion, polyToPath, regionToPath, type Pt } from '@/engine/geometry';
import type { ConstraintKind, Layout } from '@/engine/types';
import { usePanZoom } from './usePanZoom';
import { ConstraintLayer, Defs, Dimensions, NumbersLayer, OpenLabels, OpenLayer, ParcelLayer, PlotsLayer, RoadsLayer, regionsOf } from './layers';
import { DraftShape, ParcelEditor, finishConstraint } from './editors';
import { Coords, Legend, NorthArrow, ScaleBar, Stamp, Toolbar } from './Overlays';
import { PlotsCanvas } from './PlotsCanvas';
import { PlotTooltip } from './PlotTooltip';

const CANVAS_THRESHOLD = 600;
const DRAW_TOOLS = ['lake', 'nala', 'ht', 'rail', 'heritage'];

function hitPlot(layout: Layout, w: Pt): number | null {
  for (const p of layout.plots) {
    const r = p.rect;
    if (Math.hypot(p.centroid.x - w.x, p.centroid.y - w.y) > Math.hypot(r.x1 - r.x0, r.y1 - r.y0)) continue;
    if (pointInRegion(w, p.region)) return p.no;
  }
  return null;
}

export function PlanCanvas({ layout, interactive = true }: { layout: Layout; interactive?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const bounds = useMemo(() => bbox(layout.parcel), [layout.parcel]);
  const pz = usePanZoom(box, bounds);
  const { view } = pz;
  const genKey = useUi((s) => s.genKey);
  const tool = useUi((s) => s.tool);
  const hover = useUi((s) => s.hover);
  const selected = useUi((s) => s.selected);
  const highlight = useUi((s) => s.highlight);
  const constraints = useProject((s) => s.params.constraints);
  const northOffset = useProject((s) => s.params.site.northOffset);
  const origin = useDerived((s) => s.layout?.parcel);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [screen, setScreen] = useState<{ x: number; y: number } | null>(null);
  const [lasso, setLasso] = useState<Pt[] | null>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setDraft([]), [tool]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft([]);
        setLasso(null);
        useUi.setState({ tool: 'select', highlight: null });
      }
      if (e.key === 'Enter' && DRAW_TOOLS.includes(tool)) finishConstraint(tool as ConstraintKind, draft);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [tool, draft]);

  const local = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return;
    const l = local(e);
    const w = pz.toWorld(l.x, l.y);
    if (DRAW_TOOLS.includes(tool)) {
      if (tool === 'heritage') finishConstraint('heritage', [w]);
      else setDraft((d) => [...d, w]);
      return;
    }
    if (tool === 'lasso' || e.shiftKey) {
      setLasso([w]);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    pz.onPanStart(e);
  };
  const onMove = (e: React.PointerEvent) => {
    const l = local(e);
    const w = pz.toWorld(l.x, l.y);
    setCursor(w);
    setScreen(l);
    if (lasso) {
      setLasso((ls) => (ls ? [...ls, w] : ls));
      return;
    }
    if (pz.onPanMove(e)) return;
    if (interactive && tool === 'select') {
      const h = hitPlot(layout, w);
      if (h !== hover) useUi.setState({ hover: h });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (lasso) {
      const sel = lasso.length > 2 ? layout.plots.filter((p) => pointInPoly(p.centroid, lasso)).map((p) => p.no) : [];
      useUi.setState({ selected: e.altKey ? selected.filter((n) => !sel.includes(n)) : Array.from(new Set([...(e.metaKey || e.ctrlKey ? selected : []), ...sel])) });
      setLasso(null);
      return;
    }
    const moved = pz.onPanEnd();
    if (!moved && interactive && tool === 'select') {
      const l = local(e);
      const h = hitPlot(layout, pz.toWorld(l.x, l.y));
      const multi = e.metaKey || e.ctrlKey;
      useUi.setState({
        selected: h === null ? (multi ? selected : []) : multi ? (selected.includes(h) ? selected.filter((n) => n !== h) : [...selected, h]) : [h],
        drawer: h !== null && window.innerWidth < 1280 ? 'inspector' : useUi.getState().drawer,
      });
    }
  };

  const hl = highlight ? regionsOf(layout, highlight.h) : [];
  const hlRuns = highlight?.h.runs ? layout.roadRuns.filter((r) => highlight.h.runs!.includes(r.id)) : [];
  const selRegion = regionsOf(layout, { plots: selected });
  const hovered = hover !== null ? layout.plots.find((p) => p.no === hover) : undefined;
  const useCanvas = layout.plots.length > CANVAS_THRESHOLD;
  const gridPx = 10 * view.s;
  const cursorCls = DRAW_TOOLS.includes(tool) || tool === 'lasso' ? 'cursor-crosshair' : 'cursor-crosshair';
  void origin;

  return (
    <div
      ref={box}
      className={`drafting-grid relative h-full w-full touch-none overflow-hidden select-none ${cursorCls}`}
      style={{
        backgroundSize: `${gridPx * 10}px ${gridPx * 10}px, ${gridPx * 10}px ${gridPx * 10}px, ${gridPx}px ${gridPx}px, ${gridPx}px ${gridPx}px`,
        backgroundPosition: `${view.tx}px ${view.ty}px`,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => {
        setCursor(null);
        setScreen(null);
        if (hover !== null) useUi.setState({ hover: null });
      }}
      onDoubleClick={() => DRAW_TOOLS.includes(tool) && finishConstraint(tool as ConstraintKind, draft)}
      role="application"
      aria-label={`Site plan, ${layout.plots.length} plots. The Schedule tab lists every plot.`}
    >
      {useCanvas && size.w > 0 && <PlotsCanvas layout={layout} view={view} w={size.w} h={size.h} />}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <Defs />
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <ParcelLayer layout={layout} />
          <ConstraintLayer layout={layout} constraints={constraints} />
          <OpenLayer layout={layout} genKey={genKey} />
          <RoadsLayer layout={layout} genKey={genKey} />
          {!useCanvas && <PlotsLayer layout={layout} genKey={genKey} />}
          <OpenLabels layout={layout} s={view.s} />
          <NumbersLayer layout={layout} s={view.s} />
          {selRegion.length > 0 && <path d={regionToPath(selRegion)} fill="var(--signal)" fillOpacity={0.12} stroke="var(--signal)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {hl.length > 0 && <path className="pulse-outline" d={regionToPath(hl)} fill="var(--brake)" fillOpacity={0.12} stroke="var(--brake)" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {hlRuns.map((r) => (
            <line key={r.id} className="pulse-outline" x1={r.a.x} y1={-r.a.y} x2={r.b.x} y2={-r.b.y} stroke="var(--brake)" vectorEffect="non-scaling-stroke" />
          ))}
          {hovered && <path d={regionToPath(hovered.region)} fill="none" stroke="var(--lane)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          {hovered && <Dimensions p={hovered} theta={layout.theta} origin={centroidOf(layout)} s={view.s} />}
          {lasso && <path d={polyToPath(lasso)} fill="var(--signal)" fillOpacity={0.08} stroke="var(--signal)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
          {DRAW_TOOLS.includes(tool) && <DraftShape kind={tool as ConstraintKind} pts={draft} cursor={cursor} />}
          {tool === 'parcel' && interactive && <ParcelEditor s={view.s} toWorld={pz.toWorld} />}
        </g>
      </svg>
      {interactive && (
        <>
          <Stamp />
          <NorthArrow offset={northOffset} />
          <Toolbar onZoom={(f) => pz.zoomAt(f, size.w / 2, size.h / 2)} onFit={pz.fit} />
          <ScaleBar s={view.s} />
          <Legend />
          <Coords p={cursor} />
          {hovered && screen && <PlotTooltip plot={hovered} x={screen.x} y={screen.y} w={size.w} />}
        </>
      )}
    </div>
  );
}

function centroidOf(layout: Layout): Pt {
  const p = layout.parcel;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i];
    const r = p[(i + 1) % p.length];
    const f = q.x * r.y - r.x * q.y;
    a += f;
    cx += (q.x + r.x) * f;
    cy += (q.y + r.y) * f;
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
