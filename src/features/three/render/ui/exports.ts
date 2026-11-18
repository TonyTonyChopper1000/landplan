// Stills (1×/2×/4K PNG), the Arrival film (WebM) and a PDF brochure, all stamped.
import { plotPrice } from '@/engine/finance';
import { SQYD } from '@/engine/geometry';
import { money } from '@/lib/format';
import type { Built } from '../build';
import { statusOf } from '../Plots';
import { useRender } from '../store';
import { registry } from './registry';

export type StampInfo = { name: string; lpNumber?: string; authority?: string; attribution: string };

export function stampLine(s: StampInfo): string {
  return s.lpNumber ? `${s.authority === 'DTCP' ? 'DTCP' : 'HMDA'} LP No. ${s.lpNumber}` : 'Yield study only — not a submission drawing';
}

const frames = (n: number) =>
  new Promise<void>((res) => {
    const step = (k: number) => {
      registry.invalidate();
      if (k <= 0) res();
      else requestAnimationFrame(() => step(k - 1));
    };
    step(n);
  });

function drawStamp(g: CanvasRenderingContext2D, w: number, h: number, s: StampInfo) {
  const k = Math.max(1, h / 900);
  const pad = 18 * k;
  g.save();
  const band = 44 * k;
  const grad = g.createLinearGradient(0, h - band * 2, 0, h);
  grad.addColorStop(0, 'rgba(10,12,16,0)');
  grad.addColorStop(1, 'rgba(10,12,16,0.62)');
  g.fillStyle = grad;
  g.fillRect(0, h - band * 2, w, band * 2);
  g.fillStyle = '#ffffff';
  g.font = `600 ${15 * k}px ui-serif, Georgia, serif`;
  g.textBaseline = 'bottom';
  g.fillText(`${s.name}  ·  ${stampLine(s)}`, pad, h - pad);
  if (s.attribution) {
    g.font = `500 ${11 * k}px system-ui, sans-serif`;
    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillText(s.attribution, w - pad, h - pad);
  }
  g.restore();
}

export async function captureStill(scale: 1 | 2 | '4k', stamp: StampInfo): Promise<{ url: string; blob: Blob; name: string }> {
  const gl = registry.gl;
  if (!gl) throw new Error('Renderer not ready');
  const canvas = gl.domElement;
  const prev = gl.getPixelRatio();
  const target = scale === '4k' ? 3840 / canvas.clientWidth : scale;
  const max = gl.capabilities.maxTextureSize;
  const dpr = Math.min(target, max / Math.max(canvas.clientWidth, canvas.clientHeight));
  registry.setDpr?.(dpr);
  await frames(4);
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const g = out.getContext('2d')!;
  g.drawImage(canvas, 0, 0);
  drawStamp(g, out.width, out.height, stamp);
  registry.setDpr?.(prev);
  registry.invalidate();
  const blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), 'image/png'));
  const name = `${slug(stamp.name)}-${scale === '4k' ? '4k' : `${scale}x`}-${Date.now().toString(36)}.png`;
  const url = URL.createObjectURL(blob);
  useRender.setState((s) => ({ gallery: [{ url, name }, ...s.gallery].slice(0, 24) }));
  return { url, blob, name };
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'landplan';

export function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Plays Arrival + Aerial at 1080p and records a WebM with the stamp burnt in. */
export async function recordFilm(stamp: StampInfo, onTick?: (s: number) => void): Promise<{ url: string; name: string } | null> {
  const gl = registry.gl;
  if (!gl || typeof MediaRecorder === 'undefined') throw new Error('Recording is not supported in this browser');
  const canvas = gl.domElement;
  const prev = gl.getPixelRatio();
  registry.setDpr?.(Math.max(1, 1080 / canvas.clientHeight));
  await frames(3);
  const out = document.createElement('canvas');
  out.width = 1920;
  out.height = 1080;
  const g = out.getContext('2d')!;
  const stream = out.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let alive = true;
  const t0 = performance.now();
  const draw = () => {
    if (!alive) return;
    // Cover-fit the live canvas into 16:9.
    const s = Math.max(out.width / canvas.width, out.height / canvas.height);
    const w = canvas.width * s;
    const h = canvas.height * s;
    g.drawImage(canvas, (out.width - w) / 2, (out.height - h) / 2, w, h);
    drawStamp(g, out.width, out.height, stamp);
    onTick?.((performance.now() - t0) / 1000);
    requestAnimationFrame(draw);
  };
  rec.start(500);
  draw();
  useRender.setState({ filming: true, selected: null, sheet: null });
  await new Promise<void>((res) => {
    const unsub = useRender.subscribe((s) => {
      if (!s.filming) {
        unsub();
        res();
      }
    });
  });
  alive = false;
  await new Promise<void>((res) => {
    rec.onstop = () => res();
    rec.stop();
  });
  registry.setDpr?.(prev);
  const blob = new Blob(chunks, { type: 'video/webm' });
  const name = `${slug(stamp.name)}-arrival.webm`;
  const url = URL.createObjectURL(blob);
  useRender.setState((s) => ({ gallery: [{ url, name }, ...s.gallery].slice(0, 24) }));
  return { url, name };
}

/** A4 landscape brochure: the current view, key facts, then the plot schedule. */
export async function brochure(built: Built, stamp: StampInfo, subtitle: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const still = await captureStill(2, stamp);
  const img = await new Promise<HTMLImageElement>((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.src = still.url;
  });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  const ar = img.width / img.height;
  const ih = Math.min(150, (W - 20) / ar);
  doc.addImage(img, 'PNG', 10, 10, ih * ar, ih);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(stamp.name, 10, 10 + ih + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, 10, 10 + ih + 19);
  const plots = built.ctx.layout.plots;
  const params = built.ctx.layout.params;
  const avail = plots.filter((p) => statusOf(p, params.inventory) === 'Available');
  const prices = avail.map((p) => plotPrice(p, params));
  const facts = [`${plots.length} plots`, `${avail.length} available`, prices.length ? `${money(Math.min(...prices))} – ${money(Math.max(...prices))}` : ''].filter(Boolean).join('   ·   ');
  doc.text(facts, 10, 10 + ih + 25);
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(stampLine(stamp) + (stamp.attribution ? `   ·   ${stamp.attribution}` : ''), 10, H - 6);
  // Schedule
  const cols = ['Plot', 'Sq yd', 'm²', 'Width × depth', 'Facing', 'Corner', 'Status', 'Price'];
  const xs = [10, 32, 54, 78, 120, 144, 166, 196];
  let y = 0;
  const header = () => {
    doc.addPage();
    doc.setTextColor(20);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(`${stamp.name} — plot schedule`, 10, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    cols.forEach((c, i) => doc.text(c, xs[i], 24));
    doc.setFont('helvetica', 'normal');
    y = 30;
  };
  header();
  for (const p of plots) {
    if (y > H - 12) header();
    const row = [String(p.no), String(Math.round(p.area / SQYD)), String(Math.round(p.area)), `${p.width.toFixed(1)} × ${p.depth.toFixed(1)} m`, p.facing, p.corner ? 'Yes' : '', statusOf(p, params.inventory), money(plotPrice(p, params))];
    row.forEach((c, i) => doc.text(c, xs[i], y));
    y += 5;
  }
  doc.save(`${slug(stamp.name)}-brochure.pdf`);
  void W;
}
