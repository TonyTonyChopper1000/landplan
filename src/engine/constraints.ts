import { rule } from '../rules/regulations';
import { bufferLine, circle, intersect, offsetRegion, union } from './clip';
import { HECTARE, area, ensureCCW, regionArea, type Region } from './geometry';
import type { Buffer, Constraint } from './types';

export type BufferSpec = { radius: number; rule: string; label: string };

export function lakeHa(c: Constraint): number {
  return c.lakeHa ?? (c.pts.length >= 3 ? area(c.pts) / HECTARE : 0);
}

/** Pick the governing buffer rule for a constraint. Distances come from the rule library. */
export function bufferSpec(c: Constraint): BufferSpec {
  switch (c.kind) {
    case 'lake': {
      const big = lakeHa(c) >= 10;
      const r = rule(big ? 'BF-LAKE-L' : 'BF-LAKE-S');
      return { radius: r.value as number, rule: r.id, label: `${r.value} m FTL buffer` };
    }
    case 'nala': {
      const w = c.widthM ?? 6;
      const r = rule(w > 10 ? 'BF-NALA-W' : 'BF-NALA-N');
      return { radius: w / 2 + (r.value as number), rule: r.id, label: `${r.value} m nala buffer` };
    }
    case 'ht': {
      const safe = (rule('HT-SAFE').value as { ht: number }).ht;
      const base = c.towerBase ?? 8;
      return { radius: base / 2 + safe, rule: 'HT-SAFE', label: `${base} m green belt + ${safe} m safety` };
    }
    case 'rail': {
      const r = rule('BF-RAIL');
      return { radius: r.value as number, rule: r.id, label: `${r.value} m railway buffer` };
    }
    case 'heritage': {
      const v = rule('HER-ASI').value as { prohibited: number };
      return { radius: v.prohibited, rule: 'HER-ASI', label: `${v.prohibited} m prohibited zone` };
    }
  }
}

/** The excluded footprint of a constraint (feature + buffer). */
export function constraintFootprint(c: Constraint): Region {
  const spec = bufferSpec(c);
  if (c.kind === 'lake') {
    if (c.pts.length < 3) return [];
    return offsetRegion([ensureCCW(c.pts)], spec.radius);
  }
  if (c.kind === 'heritage') return c.pts.length ? [circle(c.pts[0], spec.radius, 64)] : [];
  return c.pts.length >= 2 ? bufferLine(c.pts, spec.radius) : [];
}

export function buildBuffers(constraints: Constraint[], clipTo: Region): Buffer[] {
  return constraints
    .map((c) => {
      const spec = bufferSpec(c);
      const region = intersect(constraintFootprint(c), clipTo);
      return { id: c.id, kind: c.kind, rule: spec.rule, region, area: regionArea(region), label: spec.label };
    })
    .filter((b) => b.region.length > 0);
}

export function bufferUnion(buffers: Buffer[]): Region {
  if (!buffers.length) return [];
  return union(buffers.flatMap((b) => b.region));
}
