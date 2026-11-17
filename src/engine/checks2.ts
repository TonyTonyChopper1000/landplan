import { rule } from '../rules/regulations';
import { PROFILES } from '../rules/profiles';
import { intersect } from './clip';
import { constraintFootprint } from './constraints';
import { pointInRegion, regionArea, segDist, type Pt, type Region } from './geometry';

function pointToRegion(p: Pt, r: Region): number {
  if (pointInRegion(p, r)) return 0;
  let d = Infinity;
  for (const ring of r) for (let i = 0; i < ring.length; i++) d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % ring.length]));
  return d;
}
import { choice, nearRoad, outer, touchesAny, type Check } from './checkutil';
import { coverageFor } from './massing';
import type { ConstraintKind, Layout } from './types';

const m = (n: number) => `${n.toFixed(1)} m`;

function mk(id: string, title: string, ruleIds: string[]): Check {
  const verify = ruleIds.some((r) => {
    const rr = rule(r.split(':')[0]);
    return rr.status === 'verify' || rr.sourceType === 'secondary';
  });
  return { id, title, ruleIds, status: 'not-checked', actual: '—', required: '—', verify };
}

export function geometryChecks2(
  layout: Layout,
  a: { park: number; util: number; social: number; net: number },
): Check[] {
  const p = layout.params;
  const out: Check[] = [];
  const parks = layout.open.filter((o) => o.use === 'park');
  const utils = layout.open.filter((o) => o.use === 'util');
  const sis = layout.open.filter((o) => o.use === 'social');
  const plotsNear = (ring: ReturnType<typeof outer>) =>
    layout.plots.filter((pl) => touchesAny(ring, outer(pl.region))).map((pl) => pl.no);

  // SI cap (HMDA MP 2031)
  {
    const c = mk('chk-si-cap', 'Social infra inside 10% (≤2.5%)', ['OS-SI-MP2031']);
    const share = (a.social / a.net) * 100;
    c.actual = `${share.toFixed(2)}%`;
    c.required = '≤ 2.5% of net';
    c.status = share <= 2.5 + 1e-9 ? 'pass' : 'fail';
    out.push(c);
  }
  // Pocket size
  {
    const c = mk('chk-os-pocket', 'Minimum open-space pocket', ['OS-450']);
    const min = p.open.minPocket;
    const small = parks.filter((o) => o.area < min);
    c.actual = parks.length ? `smallest ${Math.round(Math.min(...parks.map((o) => o.area)))} m²` : 'no pockets';
    c.required = `each ≥ ${min} m²`;
    c.status = !parks.length ? 'na' : small.length ? 'fail' : 'pass';
    c.highlight = { open: small.map((o) => o.id) };
    if (small.length) c.fixes = [{ label: 'Place open space centrally', patch: { open: { placement: 'central' } } }];
    out.push(c);
  }
  // Adjacency
  {
    const c = mk('chk-os-adj', 'Open space does not abut plots', ['OS-ADJ']);
    const bad = parks.map((o) => ({ o, plots: plotsNear(outer(o.region)) })).filter((x) => x.plots.length);
    c.status = !parks.length ? 'na' : bad.length ? 'fail' : 'pass';
    c.actual = bad.length ? `${bad.length} pocket(s) touch plots` : 'road-bounded';
    c.required = 'bounded by roads';
    c.highlight = { open: bad.map((x) => x.o.id), plots: bad.flatMap((x) => x.plots) };
    if (bad.length) c.fixes = [{ label: 'Use whole-block central parks', patch: { open: { placement: 'central' } } }];
    out.push(c);
  }
  {
    const c = mk('chk-ut-adj', 'Utilities: no plot contact, road frontage', ['UT-ADJ']);
    const bad = utils.filter((u) => plotsNear(outer(u.region)).length || !nearRoad(layout, outer(u.region)));
    c.status = !utils.length ? (p.open.util > 0 ? 'fail' : 'na') : bad.length ? 'fail' : 'pass';
    c.actual = !utils.length ? 'no utility parcel' : bad.length ? `${bad.length} parcel(s) fail` : 'ok';
    c.required = 'abuts road, not plots';
    c.highlight = { open: bad.map((u) => u.id), plots: bad.flatMap((u) => plotsNear(outer(u.region))) };
    out.push(c);
  }
  {
    const c = mk('chk-si-adj', 'Social infra separate from open space and utilities', ['SI-ADJ']);
    const others = [...parks, ...utils].flatMap((o) => outer(o.region));
    const bad = sis.filter((s) => touchesAny(outer(s.region), others));
    c.status = !sis.length ? 'na' : bad.length ? 'fail' : 'pass';
    c.actual = !sis.length ? 'no SI parcel' : bad.length ? `${bad.length} parcel(s) touch` : 'separate';
    c.required = 'no shared boundary';
    c.highlight = { open: bad.map((s) => s.id) };
    out.push(c);
  }
  // Roads
  {
    const c = mk('chk-road-row', 'Road ROW by run length', ['RD-TABLE']);
    const bad = layout.roadRuns.filter((r) => r.requiredRow !== null && r.width + 0.01 < r.requiredRow);
    c.actual = bad.length ? `${bad.length} of ${layout.roadRuns.length} runs too narrow` : `${layout.roadRuns.length} runs ok`;
    c.required = '≤600 m: 12 m · ≤1000 m: 18 m · >1000 m: 24 m';
    c.status = !layout.roadRuns.length ? 'na' : bad.length ? 'fail' : 'pass';
    c.highlight = { runs: bad.map((r) => r.id) };
    if (bad.length)
      c.fixes = [
        { label: 'Auto-upgrade long runs to 18 m', patch: { mode: 'rules', roads: { hierarchy: true } } },
        { label: 'Widen spine to 18 m', patch: { roads: { spine: 18 } } },
      ];
    out.push(c);
  }
  {
    const c = mk('chk-splays', 'Junction splays cut per table', ['RD-TABLE']);
    const cut = regionArea(layout.splays);
    c.status = p.mode === 'rules' && p.roads.splays ? 'pass' : 'fail';
    c.actual = c.status === 'pass' ? `${Math.round(cut)} m² cut` : 'not cut';
    c.required = '3 m / 4.5 m / 6 m by ROW';
    if (c.status === 'fail') c.fixes = [{ label: 'Cut junction splays', patch: { mode: 'rules', roads: { splays: true } } }];
    out.push(c);
  }
  {
    const prof = PROFILES[p.site.authority];
    let req = 12;
    let ids = ['RD-TABLE'];
    let conflict = false;
    if (prof.frontageRule === 'RD-HMDA-122') {
      const pick = choice(p, 'hmda-frontage');
      ids = ['RD-HMDA-122'];
      if (!pick) conflict = true;
      else req = pick.endsWith(':LRS') ? 9 : 12.2;
    }
    const c = mk('chk-frontage', `Frontage & spine width (${prof.short} rule)`, ids);
    const w = Math.min(layout.frontage, layout.spine);
    c.actual = `${m(layout.frontage)} / ${m(layout.spine)}`;
    c.required = conflict ? '12.2 m or 9 m (unresolved)' : `≥ ${req} m`;
    c.status = conflict ? 'conflict' : w + 1e-9 >= req ? 'pass' : 'fail';
    if (conflict) c.note = 'HMDA 12.2 m design minimum vs 9 m LRS standard. Pick one in Regulations.';
    if (c.status === 'fail') c.fixes = [{ label: `Widen roads to ${req} m`, patch: { roads: { frontage: req, spine: req } } }];
    out.push(c);
  }
  {
    const c = mk('chk-approach', 'Approach road', ['RD-APPROACH']);
    const s = p.site;
    c.actual = `${m(s.approachExisting)} existing · ${m(s.approachMP)} MP`;
    c.required = 'existing ≥ 9 m; 18 m required';
    if (s.approachExisting < 9) c.status = 'fail';
    else {
      c.status = 'pass';
      if (s.approachExisting < Math.max(18, s.approachMP)) {
        const half = s.approachExisting >= 15 && s.approachMP <= 18;
        c.note = `Widen equally both sides to ${Math.max(18, s.approachMP)} m; road impact fee ${half ? '50%' : '100%'} of DC.`;
      }
    }
    out.push(c);
  }
  // Plots
  {
    const c = mk('chk-plot-min', 'Minimum plot 50 m² and 6 m wide', ['PL-MIN']);
    const v = rule('PL-MIN').value as { area: number; width: number };
    const bad = layout.plots.filter((pl) => pl.area < v.area - 1e-9 || pl.width < v.width - 1e-9);
    c.actual = bad.length ? `${bad.length} plot(s) under` : `min ${layout.plots.length ? Math.min(...layout.plots.map((x) => x.width)).toFixed(2) : '—'} m wide`;
    c.required = `≥ ${v.area} m², ≥ ${v.width} m`;
    c.status = !layout.plots.length ? 'na' : bad.length ? 'fail' : 'pass';
    c.highlight = { plots: bad.map((x) => x.no) };
    if (bad.length) c.fixes = [{ label: 'Enforce 6 m minimum width', patch: { mode: 'rules', plots: { minWidth: 6, minPlotM2: 50 } } }];
    out.push(c);
  }
  // Buffers
  const bufferCheck = (kind: ConstraintKind, id: string, title: string, ids: string[]) => {
    const c = mk(id, title, ids);
    const cs = p.constraints.filter((x) => x.kind === kind);
    if (!cs.length) {
      c.status = 'na';
      c.note = 'None drawn.';
      return c;
    }
    const foot = cs.flatMap((x) => constraintFootprint(x));
    const hit = layout.plots.filter((pl) => regionArea(intersect(pl.region, foot)) > 0.01).map((pl) => pl.no);
    const buf = layout.buffers.filter((b) => b.kind === kind);
    c.actual = `${Math.round(buf.reduce((s, b) => s + b.area, 0)).toLocaleString('en-IN')} m² deducted`;
    c.required = buf.map((b) => b.label).join(' · ') || 'outside parcel';
    c.status = hit.length ? 'fail' : 'pass';
    c.highlight = { plots: hit, buffers: cs.map((x) => x.id) };
    return c;
  };
  out.push(bufferCheck('lake', 'chk-buffer-lake', 'Lake FTL buffer', ['BF-LAKE-L', 'BF-LAKE-S']));
  out.push(bufferCheck('nala', 'chk-buffer-nala', 'Nala buffer', ['BF-NALA-W', 'BF-NALA-N']));
  out.push(bufferCheck('ht', 'chk-buffer-ht', 'HT line green belt + safety', ['HT-SAFE', 'HT-GREEN']));
  out.push(bufferCheck('rail', 'chk-buffer-rail', 'Railway buffer', ['BF-RAIL']));
  {
    const c = mk('chk-heritage', 'Protected monument zones', ['HER-ASI']);
    const hs = p.constraints.filter((x) => x.kind === 'heritage' && x.pts.length);
    if (!hs.length) {
      c.status = 'na';
      c.note = 'None drawn.';
    } else {
      const d = Math.min(...hs.map((h) => Math.min(...layout.plots.map((pl) => pointToRegion(h.pts[0], pl.region)))));
      c.actual = Number.isFinite(d) ? `nearest plot ${m(d)}` : 'no plots';
      c.required = '> 100 m; 100–200 m needs NMA permission';
      c.status = d < 100 ? 'fail' : d < 200 ? 'warn' : 'pass';
      c.highlight = { buffers: hs.map((h) => h.id) };
    }
    out.push(c);
  }
  {
    const c = mk('chk-coverage', 'Ground coverage derived from setbacks', ['SB-FRONT']);
    const cov = coverageFor(layout);
    c.actual = `${(cov * 100).toFixed(1)}% average`;
    c.required = 'front 1.5 / 2 / 3 m by plot size';
    c.status = layout.plots.length ? 'pass' : 'na';
    out.push(c);
  }
  return out;
}
