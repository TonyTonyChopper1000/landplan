import type { ParamPatch } from '@/engine/checks';
import type { Params } from '@/engine/types';

/** Two-level merge of a ParamPatch into Params. */
export function applyPatch(p: Params, patch: ParamPatch): Params {
  const out = { ...p } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    const cur = (p as Record<string, unknown>)[k];
    out[k] = cur && typeof cur === 'object' && !Array.isArray(cur) && v && typeof v === 'object' ? { ...cur, ...v } : v;
  }
  return out as Params;
}
