// Procedural canvas textures (deterministic, no downloads).
import * as THREE from 'three';
import { mulberry32 } from '@/engine/prng';

function canvas(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat = true, srgb = true): THREE.CanvasTexture {
  const el = document.createElement('canvas');
  el.width = el.height = size;
  const c = el.getContext('2d')!;
  draw(c, size);
  const t = new THREE.CanvasTexture(el);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function noise(c: CanvasRenderingContext2D, s: number, base: string, spread: number, n: number, seed: number, alpha = 0.18) {
  c.fillStyle = base;
  c.fillRect(0, 0, s, s);
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const v = Math.floor((r() - 0.5) * spread);
    c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${(Math.abs(v) / spread) * alpha})`;
    const sz = 1 + r() * 2.5;
    c.fillRect(r() * s, r() * s, sz, sz);
  }
}

export type Textures = ReturnType<typeof makeTextures>;

export function makeTextures() {
  return {
    asphalt: canvas(256, (c, s) => noise(c, s, '#3a3d42', 120, 9000, 1, 0.22)),
    pavers: canvas(256, (c, s) => {
      c.fillStyle = '#b9837a';
      c.fillRect(0, 0, s, s);
      const r = mulberry32(2);
      const bw = s / 8;
      const bh = s / 16;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 9; x++) {
          const off = y % 2 ? bw / 2 : 0;
          const t = 0.85 + r() * 0.25;
          c.fillStyle = `rgb(${Math.round(205 * t)},${Math.round(140 * t)},${Math.round(128 * t)})`;
          c.fillRect(x * bw - off + 1, y * bh + 1, bw - 2, bh - 2);
        }
    }),
    lawn: canvas(512, (c, s) => {
      // Mowed stripes: two greens in bands, with grass noise.
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#5f9e3c' : '#6fae45';
        c.fillRect(0, (i * s) / 8, s, s / 8);
      }
      const r = mulberry32(3);
      for (let i = 0; i < 14000; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(30,70,20,0.18)' : 'rgba(170,210,110,0.14)';
        c.fillRect(r() * s, r() * s, 1, 2 + r() * 2);
      }
    }),
    soil: canvas(256, (c, s) => noise(c, s, '#ffffff', 90, 7000, 4, 0.16), true, true),
    murrum: canvas(256, (c, s) => noise(c, s, '#b8794b', 140, 9000, 5, 0.3)),
    stone: canvas(256, (c, s) => {
      const r = mulberry32(6);
      c.fillStyle = '#8b7e6e';
      c.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 16 + Math.floor(r() * 10)) {
        let x = -r() * 40;
        const h = 14 + r() * 10;
        while (x < s) {
          const w = 30 + r() * 50;
          const t = 0.7 + r() * 0.45;
          c.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(135 * t)},${Math.round(115 * t)})`;
          c.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
          x += w;
        }
      }
    }),
    fields: canvas(1024, (c, s) => {
      const r = mulberry32(7);
      c.fillStyle = '#7f9a52';
      c.fillRect(0, 0, s, s);
      const greens = ['#6f8f45', '#8aa55a', '#9aa865', '#a69a62', '#7a9850', '#93864f', '#5f8240'];
      for (let i = 0; i < 70; i++) {
        c.fillStyle = greens[Math.floor(r() * greens.length)];
        c.save();
        c.translate(r() * s, r() * s);
        c.rotate((r() - 0.5) * 0.4);
        c.fillRect(-80, -50, 80 + r() * 160, 50 + r() * 110);
        c.restore();
      }
      for (let i = 0; i < 20000; i++) {
        c.fillStyle = r() > 0.5 ? 'rgba(40,60,20,0.12)' : 'rgba(210,200,140,0.08)';
        c.fillRect(r() * s, r() * s, 2, 2);
      }
    }),
    kerb: canvas(64, (c, s) => {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? '#1d1d1d' : '#f2c200';
        c.fillRect((i * s) / 4, 0, s / 4, s);
      }
    }),
    hatch: canvas(64, (c, s) => {
      c.clearRect(0, 0, s, s);
      c.strokeStyle = 'rgba(255,107,26,0.85)';
      c.lineWidth = 6;
      for (let i = -s; i < 2 * s; i += 16) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i + s, s);
        c.stroke();
      }
    }),
    glow: canvas(128, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,214,150,0.95)');
      g.addColorStop(0.35, 'rgba(255,190,110,0.45)');
      g.addColorStop(1, 'rgba(255,170,90,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }, false),
    water: canvas(256, (c, s) => {
      const g = c.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#2f8fb0');
      g.addColorStop(1, '#2a6f95');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      const r = mulberry32(9);
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 90; i++) {
        c.beginPath();
        const x = r() * s;
        const y = r() * s;
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 10, y - 3, x + 22, y);
        c.stroke();
      }
    }),
    track: canvas(128, (c, s) => {
      c.fillStyle = '#b5473a';
      c.fillRect(0, 0, s, s);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 1; i < 4; i++) c.fillRect(0, (i * s) / 4 - 1, s, 2);
    }),
    turf: canvas(256, (c, s) => {
      c.fillStyle = '#3f9a3f';
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        c.fillRect(0, (i * s) / 6, s, s / 6);
      }
    }),
  };
}

export function disposeTextures(t: Textures) {
  Object.values(t).forEach((x) => x.dispose());
}
