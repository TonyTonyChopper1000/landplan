import { rule } from '../rules/regulations';
import { PROFILES } from '../rules/profiles';
import { area, polyDistance, segDist, type Poly } from './geometry';
import type { Layout, Params } from './types';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'na' | 'not-checked' | 'conflict' | 'overridden';
export type ParamPatch = { [K in keyof Params]?: Params[K] extends object ? Partial<Params[K]> : Params[K] };
export type Fix = { label: string; patch: ParamPatch };
export type Highlight = { plots?: number[]; open?: string[]; runs?: string[]; buffers?: string[] };
export type Check = {
  id: string;
  title: string;
  ruleIds: string[];
  status: CheckStatus;
  actual: string;
  required: string;
  note?: string;
  verify?: boolean;
  highlight?: Highlight;
  fixes?: Fix[];
};

export function choice(params: Params, group: string): string | null {
  return params.ruleChoices[group]?.ruleId ?? PROFILES[params.site.authority].defaults[group] ?? null;
}

export const pct = (n: number) => `${n.toFixed(2)}%`;
export const m2 = (n: number) => `${Math.round(n).toLocaleString('en-IN')} m²`;
export const outer = (r: Poly[]): Poly[] => r.filter((p) => area(p) > 0.01);

export function touchesAny(a: Poly[], b: Poly[], tol = 0.05): boolean {
  return a.some((pa) => b.some((pb) => polyDistance(pa, pb) <= tol));
}

export function nearRoad(layout: Layout, poly: Poly[]): boolean {
  return layout.roadRuns.some((r) =>
    poly.some((p) => p.some((q) => segDist(q, r.a, r.b) <= r.width / 2 + 0.6)),
  );
}

export function base(id: string, title: string, ruleIds: string[]): Check {
  const verify = ruleIds.some((r) => {
    const x = r.split(':')[0];
    try {
      const rr = rule(x);
      return rr.status === 'verify' || rr.sourceType === 'secondary';
    } catch {
      return false;
    }
  });
  return { id, title, ruleIds, status: 'not-checked', actual: '—', required: '—', verify };
}

