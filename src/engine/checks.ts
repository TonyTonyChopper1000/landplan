import { CONFLICT_GROUPS, rule } from '../rules/regulations';
import { PROFILES, appliesTo } from '../rules/profiles';
import { lakeHa } from './constraints';
import { ACRE, HECTARE, polyDistance } from './geometry';
import { mortgagedArea } from './mortgage';
import { base, choice, m2, pct, type Check } from './checkutil';
import { geometryChecks2 } from './checks2';
import type { Layout, Params } from './types';

export * from './checkutil';

export function runChecks(layout: Layout): Check[] {
  const p = layout.params;
  const net = layout.netLayout || layout.gross;
  const area = (use: string) => layout.open.filter((o) => o.use === use).reduce((s, o) => s + o.area, 0);
  const park = area('park');
  const util = area('util');
  const social = area('social');
  const credit = p.countBufferAsOpen
    ? layout.buffers.filter((b) => b.kind !== 'ht').reduce((s, b) => s + b.area, 0)
    : 0;
  const checks: Check[] = [];

  // OS-10
  {
    const c = base('chk-os-total', 'Public-purpose reservation ≥10% of net layout area', ['OS-10', 'BF-OS', 'HT-GREEN']);
    const share = ((park + util + social + credit) / net) * 100;
    c.actual = pct(share);
    c.required = `≥ 10% of ${m2(net)} net`;
    c.status = share >= 10 - 1e-9 ? 'pass' : 'fail';
    c.note = credit ? `Includes ${m2(credit)} of buffer counted per Rule 16(1)(e)(ii).` : undefined;
    c.highlight = { open: layout.open.map((o) => o.id) };
    if (c.status === 'fail') {
      const want = Math.min(30, Math.ceil(Math.max(p.open.total, 1) * (10 / Math.max(share, 0.1)) + 0.5));
      c.fixes = [{ label: `Raise open space to ${want}%`, patch: { open: { total: want, park: Math.max(p.open.park, want - p.open.util - p.open.social) } } }];
    }
    checks.push(c);
  }
  // Open-space split (conflict group)
  {
    const pick = choice(p, 'os-split');
    const c = base('chk-os-split', 'Open-space split', ['OS-SPLIT-105', 'OS-SPLIT-MUN']);
    if (!pick) {
      c.status = 'conflict';
      c.note = 'GO 105 FAQ (9 + 1) and the municipal rules text (7.5 + 1 + 1) disagree. Pick one in Regulations.';
    } else {
      const v = rule(pick).value as { park: number; util: number; social: number };
      const ok = (park / net) * 100 >= v.park - 1e-6 && (util / net) * 100 >= v.util - 1e-6 && (social / net) * 100 >= v.social - 1e-6;
      c.ruleIds = [pick];
      c.actual = `${pct((park / net) * 100)} / ${pct((util / net) * 100)} / ${pct((social / net) * 100)}`;
      c.required = `${v.park}% / ${v.util}% / ${v.social}% (park / util / SI)`;
      c.status = ok ? 'pass' : 'fail';
      if (!ok)
        c.fixes = [{ label: `Apply ${v.park}/${v.util}/${v.social} split`, patch: { mode: 'rules', open: { park: v.park, util: v.util, social: v.social } } }];
    }
    checks.push(c);
  }
  checks.push(...geometryChecks2(layout, { park, util, social, net }));

  // Mortgage
  {
    const pick = choice(p, 'mortgage');
    const c = base('chk-mortgage', 'Mortgage share of plotted area', ['MG-15', 'MG-25']);
    const share = layout.plotted ? (mortgagedArea(layout.plots) / layout.plotted) * 100 : 0;
    c.actual = pct(share);
    if (!pick) {
      c.status = 'conflict';
      c.note = 'GO 105 FAQ says 15%; HMDA FAQs say 25%. Pick one in Regulations.';
    } else {
      const v = rule(pick).value as number;
      c.ruleIds = [pick];
      c.required = `≥ ${v}% (whole plots)`;
      c.status = share >= v - 1e-9 ? 'pass' : 'fail';
      if (c.status === 'fail') c.fixes = [{ label: `Set mortgage to ${v}%`, patch: { money: { mortPct: v } } }];
    }
    c.highlight = { plots: layout.plots.filter((x) => x.mortgaged).map((x) => x.no) };
    checks.push(c);
  }
  // Works window
  {
    const c = base('chk-works', 'Mortgage release within development-works window', ['MG-WORKS']);
    const v = rule('MG-WORKS').value as number;
    c.actual = `${p.money.releaseMonths} months`;
    c.required = `≤ ${v} months`;
    c.status = p.money.releaseMonths <= v ? 'pass' : 'fail';
    checks.push(c);
  }
  // Water NOC
  {
    const c = base('chk-noc-water', 'Irrigation + Revenue NOC trigger', ['NOC-WATER']);
    const water = p.constraints.filter((x) => x.kind === 'lake' || x.kind === 'nala');
    if (!water.length) {
      c.status = 'na';
      c.note = 'No lake or nala drawn.';
    } else {
      const v = rule('NOC-WATER').value as { lake: number; nala: number };
      const hit = water.some((w) => {
        const lim = w.kind === 'lake' ? v.lake : v.nala;
        const shape = w.kind === 'lake' ? w.pts : w.pts;
        return polyDistance(layout.parcel, shape.length >= 3 ? shape : [...shape, ...shape.slice().reverse()]) <= lim;
      });
      c.status = hit ? 'warn' : 'pass';
      c.actual = hit ? 'Within trigger distance' : 'Outside trigger distance';
      c.required = `NOC if ≤${v.lake} m of lake / ≤${v.nala} m of nala`;
      c.note = hit ? 'NOCs from Irrigation and Revenue are required. Add to the document checklist.' : undefined;
      c.highlight = { buffers: water.map((w) => w.id) };
    }
    checks.push(c);
  }
  // EC and facilities by size
  {
    const c = base('chk-ec', 'State EIA environmental clearance', ['EC-50HA']);
    const ha = layout.gross / HECTARE;
    c.actual = `${ha.toFixed(2)} ha`;
    c.required = 'EC needed if ≥ 50 ha';
    c.status = ha >= 50 ? 'warn' : 'pass';
    checks.push(c);
    const f = base('chk-facilities', 'Extra education/health/commercial facilities', ['FAC-50AC']);
    const ac = layout.gross / ACRE;
    f.actual = `${ac.toFixed(2)} acres`;
    f.required = 'Appendix C facilities if ≥ 50 acres';
    f.status = ac >= 50 ? (social > 0 ? 'pass' : 'fail') : 'pass';
    checks.push(f);
  }
  return finalize(checks, p);
}

/** Apply authority applicability and overrides. */
function finalize(checks: Check[], p: Params): Check[] {
  return checks.map((c) => {
    const ids = c.ruleIds.map((r) => r.split(':')[0]);
    if (ids.length && ids.every((r) => !appliesTo(r, p.site.authority))) {
      return { ...c, status: 'na', note: `Not in the ${PROFILES[p.site.authority].short} profile.`, fixes: undefined };
    }
    const ov = ids.find((r) => p.overrides[r]);
    if (ov) {
      const o = p.overrides[ov];
      return { ...c, status: 'overridden', note: `Overridden on ${ov}: ${o.value} — ${o.reason}` };
    }
    return c;
  });
}

export type Tally = { verified: number; failing: number; conflict: number; notChecked: number; total: number };
export function tally(checks: Check[]): Tally {
  const t: Tally = { verified: 0, failing: 0, conflict: 0, notChecked: 0, total: checks.length };
  for (const c of checks) {
    if (c.status === 'pass' || c.status === 'overridden') t.verified++;
    else if (c.status === 'fail' || c.status === 'warn') t.failing++;
    else if (c.status === 'conflict') t.conflict++;
    else t.notChecked++;
  }
  return t;
}

export const CONFLICT_GROUP_IDS = Object.keys(CONFLICT_GROUPS);
export { lakeHa };
