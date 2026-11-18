import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { defaultParams } from '@/engine/defaults';
import type { Params } from '@/engine/types';

export function encodeParams(p: Params): string {
  return compressToEncodedURIComponent(JSON.stringify(p));
}

/** Merge decoded params over defaults so older links keep working as parameters are added. */
export function decodeParams(s: string): Params | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const raw = JSON.parse(json) as Partial<Params>;
    const d = defaultParams();
    const out = { ...d } as Record<string, unknown>;
    for (const k of Object.keys(d) as (keyof Params)[]) {
      const v = raw[k];
      if (v === undefined) continue;
      const dv = d[k];
      out[k] = dv && typeof dv === 'object' && !Array.isArray(dv) && v && typeof v === 'object' && !Array.isArray(v) ? { ...dv, ...v } : v;
    }
    return out as Params;
  } catch {
    return null;
  }
}

export function readHash(): Params | null {
  const m = /[#&]s=([^&]+)/.exec(window.location.hash);
  return m ? decodeParams(m[1]) : null;
}

export function writeHash(p: Params): void {
  const next = `#s=${encodeParams(p)}`;
  if (window.location.hash !== next) history.replaceState(null, '', next);
}

export function shareUrl(p: Params): string {
  return `${window.location.origin}${window.location.pathname}#s=${encodeParams(p)}`;
}
