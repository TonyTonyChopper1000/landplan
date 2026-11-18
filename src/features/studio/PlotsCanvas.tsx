import { useEffect, useRef } from 'react';
import type { Layout } from '@/engine/types';
import type { View } from './usePanZoom';
import { bandColor } from './style';

/** Canvas renderer used above ~600 plots; SVG stays for overlays. */
export function PlotsCanvas({ layout, view, w, h }: { layout: Layout; view: View; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const resolve = (v: string) => css.getPropertyValue(v.slice(4, -1)).trim() || '#888';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 0.8;
    for (const p of layout.plots) {
      const col = resolve(bandColor(p));
      ctx.beginPath();
      for (const ring of p.region) {
        ring.forEach((q, i) => {
          const x = q.x * view.s + view.tx;
          const y = -q.y * view.s + view.ty;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
      }
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = col;
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      ctx.stroke();
    }
  }, [layout, view, w, h]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0" style={{ width: w, height: h }} aria-hidden />;
}
