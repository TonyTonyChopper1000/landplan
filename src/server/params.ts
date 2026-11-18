import { defaultParams } from '../engine/defaults';
import type { Params } from '../engine/types';
import { ParamsSchema } from '../schemas';
import { Problem } from './http';

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge plain objects; arrays and scalars replace. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObj(patch) || !isObj(base)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) && !/^(premiums|ruleChoices|overrides|documents|inventory)$/.test(k) ? deepMerge(out[k], v) : v === undefined ? out[k] : v;
  // records are merged shallowly but still merged
  for (const k of ['premiums', 'ruleChoices', 'overrides', 'documents', 'inventory'])
    if (isObj(patch[k]) && isObj((base as Record<string, unknown>)[k])) out[k] = { ...((base as Record<string, unknown>)[k] as object), ...(patch[k] as object) };
  return out as T;
}

export function resolveParams(input: unknown): Params {
  const merged = deepMerge(defaultParams(), input ?? {});
  return validate(merged);
}

export function validate(merged: unknown): Params {
  const r = ParamsSchema.safeParse(merged);
  if (!r.success)
    throw new Problem(400, 'Invalid parameters', 'The params object failed validation.', {
      errors: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  return merged as Params;
}
