import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rect } from '@/engine/geometry';

export type View = { s: number; tx: number; ty: number };

/** Pan/zoom with wheel, drag and inertia. World y is up; screen y = −y·s + ty. */
export function usePanZoom(el: React.RefObject<HTMLElement | null>, bounds: Rect | null) {
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const v = useRef(view);
  v.current = view;
  const vel = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const fitted = useRef(false);

  const fit = useCallback(() => {
    const node = el.current;
    if (!node || !bounds) return;
    const w = node.clientWidth;
    const h = node.clientHeight;
    const bw = bounds.x1 - bounds.x0 || 1;
    const bh = bounds.y1 - bounds.y0 || 1;
    const s = Math.min((w - 96) / bw, (h - 96) / bh);
    setView({ s, tx: w / 2 - ((bounds.x0 + bounds.x1) / 2) * s, ty: h / 2 + ((bounds.y0 + bounds.y1) / 2) * s });
  }, [el, bounds]);

  useEffect(() => {
    if (!fitted.current && bounds && el.current?.clientWidth) {
      fitted.current = true;
      fit();
    }
  }, [bounds, fit, el]);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const ro = new ResizeObserver(() => fitted.current && fit());
    ro.observe(node);
    return () => ro.disconnect();
  }, [el, fit]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((p) => {
      const s = Math.min(60, Math.max(0.05, p.s * factor));
      const k = s / p.s;
      return { s, tx: cx - (cx - p.tx) * k, ty: cy - (cy - p.ty) * k };
    });
  }, []);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [el, zoomAt]);

  const drag = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const onPanStart = (e: React.PointerEvent) => {
    cancelAnimationFrame(raf.current);
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    vel.current = { x: 0, y: 0 };
  };
  const onPanMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return false;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 3) return false;
    d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    vel.current = { x: (dx / dt) * 16, y: (dy / dt) * 16 };
    d.x = e.clientX;
    d.y = e.clientY;
    d.t = now;
    setView((p) => ({ ...p, tx: p.tx + dx, ty: p.ty + dy }));
    return true;
  };
  const onPanEnd = () => {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    if (!moved || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return moved;
    const step = () => {
      vel.current = { x: vel.current.x * 0.92, y: vel.current.y * 0.92 };
      if (Math.hypot(vel.current.x, vel.current.y) < 0.2) return;
      setView((p) => ({ ...p, tx: p.tx + vel.current.x, ty: p.ty + vel.current.y }));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return moved;
  };

  const toWorld = useCallback((sx: number, sy: number) => ({ x: (sx - v.current.tx) / v.current.s, y: -(sy - v.current.ty) / v.current.s }), []);

  return { view, setView, fit, zoomAt, onPanStart, onPanMove, onPanEnd, toWorld, dragging: () => !!drag.current?.moved };
}
