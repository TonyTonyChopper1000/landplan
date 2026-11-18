import { create } from 'zustand';
import type { Dir8, PlotStatus } from '@/engine/types';

export type CameraMode = 'aerial' | 'arrival' | 'plan' | 'walk';
export type LightPreset = 'morning' | 'noon' | 'golden' | 'night' | 'custom';
export type ContextMode = 'satellite' | '3d' | 'off';
export type Quality = 'mobile' | 'high' | 'ultra';
export type SizeChip = 'all' | 'small' | 'medium' | 'large' | 'custom';
export type Sheet = null | 'filter' | 'layers' | 'info' | 'gallery' | 'share' | 'download' | 'search';

export type Filter = {
  status: PlotStatus[];
  budget: [number, number] | null; // rupees
  size: SizeChip;
  custom: [number, number]; // m²
  facing: Dir8[];
  frontage: number; // min metres
  cornerOnly: boolean;
};

export const EMPTY_FILTER: Filter = { status: [], budget: null, size: 'all', custom: [0, 0], facing: [], frontage: 0, cornerOnly: false };

export const PRESET_MINUTES: Record<Exclude<LightPreset, 'custom'>, number> = { morning: 7 * 60 + 40, noon: 12 * 60 + 20, golden: 17 * 60 + 35, night: 19 * 60 + 15 };

export const todayDoy = () => {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
};

type S = {
  day: number;
  minutes: number;
  preset: LightPreset;
  camera: CameraMode;
  layers: { status: boolean; labels: boolean; future: boolean; amenities: boolean; context: ContextMode };
  selected: number | null;
  focus: { no: number; k: number } | null;
  filter: Filter;
  sheet: Sheet;
  quality: Quality;
  ultraBlocked: string | null;
  gallery: { url: string; name: string }[];
  filming: boolean;
  menu: 'plots' | 'amenities' | 'film' | null;
  heading: number;
  recenter: number;
  tracing: boolean;
  set: (p: Partial<S>) => void;
};

export const useRender = create<S>()((set) => ({
  day: todayDoy(),
  minutes: PRESET_MINUTES.noon,
  preset: 'noon',
  camera: 'aerial',
  layers: { status: true, labels: true, future: false, amenities: true, context: 'satellite' },
  selected: null,
  focus: null,
  filter: EMPTY_FILTER,
  sheet: null,
  quality: 'high',
  ultraBlocked: null,
  gallery: [],
  filming: false,
  menu: null,
  heading: 0,
  recenter: 0,
  tracing: false,
  set: (p) => set(p),
}));

export const STATUS_COLOURS: Record<PlotStatus, string> = {
  Available: '#2fae5a',
  Booked: '#f2b632',
  Sold: '#d94848',
  Held: '#8c939c',
  Mortgaged: '#7d8796',
};
export const STATUS_LABEL: Record<PlotStatus, string> = { Available: 'Available', Booked: 'Booked', Sold: 'Sold', Held: 'Builder', Mortgaged: 'Mortgaged' };

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Mobile preset on phones and low-end GPUs; Ultra needs WebGL2 + float render targets. */
export function detectQuality(gl?: WebGLRenderingContext | WebGL2RenderingContext | null): { quality: Quality; ultraBlocked: string | null } {
  let ultraBlocked: string | null = null;
  const isGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  if (!isGl2) ultraBlocked = 'Ultra needs WebGL 2, which this browser does not provide.';
  else if (!gl!.getExtension('EXT_color_buffer_float')) ultraBlocked = 'Ultra needs float render targets, which this GPU does not support.';
  let renderer = '';
  try {
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    renderer = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    renderer = '';
  }
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;
  const lowGpu = /swiftshader|llvmpipe|mali-4|mali-t|adreno \(tm\) [345]\d\d|powervr|intel\(r\) hd graphics [2-5]/i.test(renderer);
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
  return { quality: coarse || small || lowGpu || cores <= 4 ? 'mobile' : 'high', ultraBlocked };
}

/** Preset times that follow the real sun on the chosen day: golden ≈ 8° up in the evening, night = blue hour ≈ 6.5° below. */
export function presetMinutes(p: Exclude<LightPreset, 'custom'>, day: number, sun: (d: number, m: number) => number): number {
  if (p === 'morning' || p === 'noon') return PRESET_MINUTES[p];
  const target = p === 'golden' ? 8 : -6.5;
  for (let m = 900; m <= 1260; m += 5) if (sun(day, m) <= target) return m;
  return PRESET_MINUTES[p];
}
