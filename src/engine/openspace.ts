import { difference, intersect } from './clip';
import { rectPoly, regionArea, regionCentroid, type Rect, type Region } from './geometry';
import { netLayoutArea } from './areas';
import type { Prepared, WorkBlock } from './layout';
import type { OpenParcel } from './types';

type Use = OpenParcel['use'];

/** Carve a strip of at least `target` m² from the road end of a block. */
function carve(b: WorkBlock, target: number): { strip: Region; rest: Region; len: number; atEnd: boolean } | null {
  const atEnd = b.endRoad[1] || !b.endRoad[0];
  const [xa, xb] = b.fill;
  const maxLen = xb - xa;
  const h = b.rect.y1 - b.rect.y0;
  let len = Math.max(1, Math.ceil((target / h) * 2) / 2);
  for (let guard = 0; guard < 400 && len <= maxLen; guard++) {
    const r: Rect = atEnd ? { ...b.rect, x0: xb - len, x1: xb } : { ...b.rect, x0: xa, x1: xa + len };
    const strip = intersect(b.fillRegion, [rectPoly(r)]);
    if (regionArea(strip) >= target - 1e-6) {
      return { strip, rest: difference(b.fillRegion, [rectPoly(r)]), len, atEnd };
    }
    len += 0.5;
  }
  return null;
}

function order(prep: Prepared, blocks: WorkBlock[], theta: number): WorkBlock[] {
  const placement = prep.params.mode === 'rules' ? prep.params.open.placement : 'central';
  const byDist = [...blocks].sort((a, b) => a.dist - b.dist || a.id - b.id);
  if (placement === 'distributed' && byDist.length > 2) {
    const chosen: WorkBlock[] = [byDist[0]];
    const rest = byDist.slice(1);
    const cen = (b: WorkBlock) => regionCentroid(b.region);
    while (rest.length) {
      let best = 0;
      let bestD = -1;
      rest.forEach((b, i) => {
        const c = cen(b);
        const d = Math.min(...chosen.map((x) => Math.hypot(cen(x).x - c.x, cen(x).y - c.y)));
        if (d > bestD + 1e-9) {
          bestD = d;
          best = i;
        }
      });
      chosen.push(rest.splice(best, 1)[0]);
    }
    return chosen;
  }
  if (placement === 'buffer' && prep.buffers.length) {
    const cos = Math.cos(-theta);
    const sin = Math.sin(-theta);
    const targets = prep.buffers.map((b) => {
      const c = regionCentroid(b.region);
      const dx = c.x - prep.origin.x;
      const dy = c.y - prep.origin.y;
      return { x: prep.origin.x + dx * cos - dy * sin, y: prep.origin.y + dx * sin + dy * cos };
    });
    const d = (b: WorkBlock) => {
      const c = regionCentroid(b.region);
      return Math.min(...targets.map((t) => Math.hypot(t.x - c.x, t.y - c.y)));
    };
    return [...blocks].sort((a, b) => d(a) - d(b) || a.id - b.id);
  }
  return byDist;
}

/** Mark open-space blocks (mutates blocks). Returns open parcels in the rotated frame. */
export function assignOpen(prep: Prepared, blocks: WorkBlock[], _depth: number, theta: number): OpenParcel[] {
  const p = prep.params;
  const out: OpenParcel[] = [];
  const push = (use: Use, region: Region, area: number) =>
    out.push({ id: `${use}-${out.length + 1}`, use, region, area });

  if (p.mode !== 'rules') {
    const target = prep.gross * (p.open.total / 100);
    let cum = 0;
    for (const b of order(prep, blocks, theta)) {
      if (cum >= target) break;
      b.use = 'park';
      cum += b.area;
      push('park', b.region, b.area);
    }
    return out;
  }

  const net = netLayoutArea(prep);
  const credit = p.countBufferAsOpen
    ? prep.buffers.filter((b) => b.kind !== 'ht').reduce((s, b) => s + b.area, 0)
    : 0;
  const parkPct = Math.max(p.open.park, p.open.total - p.open.util - p.open.social);
  const parkT = Math.max(0, (net * parkPct) / 100 - credit);
  const utilT = (net * p.open.util) / 100;
  const siT = (net * p.open.social) / 100;

  const parks: WorkBlock[] = [];
  let cum = 0;
  if (parkT + utilT > 0) {
    for (const b of order(prep, blocks, theta)) {
      if (cum >= parkT + utilT) break;
      b.use = 'park';
      cum += b.area;
      parks.push(b);
    }
  }
  const parkRegions = new Map<number, Region>(parks.map((b) => [b.id, b.region]));

  if (utilT > 0) {
    const host = parks[parks.length - 1] ?? order(prep, blocks, theta).find((b) => b.use === 'plots');
    const c = host && carve(host, utilT);
    if (host && c) {
      push('util', c.strip, regionArea(c.strip));
      if (host.use === 'park') parkRegions.set(host.id, c.rest);
      else {
        host.fillRegion = c.rest;
        host.fill = c.atEnd ? [host.fill[0], host.fill[1] - c.len] : [host.fill[0] + c.len, host.fill[1]];
      }
    }
  }
  for (const b of parks) {
    const r = parkRegions.get(b.id) ?? b.region;
    push('park', r, regionArea(r));
  }
  if (siT > 0) {
    const host = order(prep, blocks, theta).find((b) => b.use === 'plots');
    const c = host && carve(host, siT);
    if (host && c) {
      push('social', c.strip, regionArea(c.strip));
      host.fillRegion = c.rest;
      host.fill = c.atEnd ? [host.fill[0], host.fill[1] - c.len] : [host.fill[0] + c.len, host.fill[1]];
    }
  }
  return out;
}
