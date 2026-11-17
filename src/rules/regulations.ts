// Seed rule library. Researched 17 Nov 2026. Every engine check references these by id.
// Rules change by GO: verify each against the current text before relying on it.

export type RuleCategory =
  | 'Open space'
  | 'Roads'
  | 'Plots'
  | 'Mortgage'
  | 'Buffers'
  | 'Utilities & SI'
  | 'NOCs'
  | 'Process'
  | 'Built form';
export type RuleAuthority = 'HMDA' | 'DTCP' | 'MUNICIPAL';
export type SourceType = 'official' | 'go-copy' | 'secondary';
export type RuleStatus = 'in-force' | 'conflict' | 'verify';

export type Rule = {
  id: string;
  title: string;
  category: RuleCategory;
  authorities: RuleAuthority[];
  reference: string;
  value: unknown;
  valueLabel: string;
  summary: string;
  sourceUrl: string;
  sourceType: SourceType;
  status: RuleStatus;
  conflictsWith?: string[];
  conflictGroup?: string;
  lastVerified: '2026-11-17';
  usedBy: string[];
};

export type RoadBand = { maxLen: number; row: number; splay: number; carriageway: string };

export const ROAD_TABLE: RoadBand[] = [
  { maxLen: 600, row: 12, splay: 3, carriageway: '6 m' },
  { maxLen: 1000, row: 18, splay: 4.5, carriageway: '11 m' },
  { maxLen: Infinity, row: 24, splay: 6, carriageway: 'per IRC' },
];

const FAQ = 'https://tgbpass.telangana.gov.in/html/docs/FAQ_Layout.docx.pdf';
const LAYOUT_RULES = 'https://www.scribd.com/document/628855812/Layout-Rules-telangana';
const GO168 = 'https://www.scribd.com/doc/238258500/GOMsNo168';
const LRS = 'https://www.hmda.gov.in/wp-content/uploads/2020/07/LRS1.pdf';
const ALL: RuleAuthority[] = ['HMDA', 'DTCP', 'MUNICIPAL'];
const V = '2026-11-17' as const;

type Seed = Omit<Rule, 'lastVerified' | 'usedBy'> & { usedBy?: string[] };

const seed: Seed[] = [
  { id: 'OS-10', title: 'Public-purpose reservation', category: 'Open space', authorities: ALL, reference: 'GO Ms 105 (2021)', value: 0.1, valueLabel: '≥10% of layout area', summary: 'At least 10% of the net layout area is reserved for public purposes (open space, utilities, social infrastructure).', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-os-total'] },
  { id: 'OS-SPLIT-105', title: 'Open-space split', category: 'Open space', authorities: ALL, reference: 'GO 105 FAQ Q9', value: { park: 9, util: 1, social: 0 }, valueLabel: '9% green + 1% utilities', summary: 'Of the 10% reservation, 9% is green/parks and 1% is utilities.', sourceUrl: FAQ, sourceType: 'official', status: 'conflict', conflictsWith: ['OS-SPLIT-MUN'], conflictGroup: 'os-split', usedBy: ['chk-os-split'] },
  { id: 'OS-SPLIT-MUN', title: 'Open-space split (municipal layout rules text)', category: 'Open space', authorities: ['MUNICIPAL', 'DTCP'], reference: 'TS Municipal Layout Rules', value: { park: 7.5, util: 1, social: 1 }, valueLabel: '7.5% parks + 1% SI + 1% utilities', summary: 'The municipal layout rules text splits the reservation into 7.5% parks, 1% social infrastructure and 1% utilities.', sourceUrl: LAYOUT_RULES, sourceType: 'go-copy', status: 'conflict', conflictsWith: ['OS-SPLIT-105'], conflictGroup: 'os-split', usedBy: ['chk-os-split'] },
  { id: 'OS-SI-MP2031', title: 'Social infra inside 10% (HMDA MP 2031)', category: 'Open space', authorities: ['HMDA'], reference: 'HMDA Master Plan 2031', value: 2.5, valueLabel: 'up to 2.5%', summary: 'Up to 2.5% social infrastructure may sit inside the 10% reservation under the HMDA Master Plan 2031.', sourceUrl: 'https://www.grihashakti.com/knowledge-centre/hmda-master-plan-hyderabad.aspx', sourceType: 'secondary', status: 'verify', usedBy: ['chk-si-cap'] },
  { id: 'OS-ADJ', title: 'Open space must not abut individual plots', category: 'Open space', authorities: ALL, reference: 'GO 105 FAQ Q10', value: true, valueLabel: 'boolean', summary: 'Open-space parcels must be bounded by roads, not by individual plots.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-os-adj'] },
  { id: 'UT-ADJ', title: 'Utility area must not touch plots; must abut a road', category: 'Utilities & SI', authorities: ALL, reference: 'GO 105 FAQ Q11', value: true, valueLabel: 'boolean', summary: 'Utility parcels must have road frontage and must not share a boundary with plots.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-ut-adj'] },
  { id: 'SI-ADJ', title: 'Social infra must not abut open space or utilities', category: 'Utilities & SI', authorities: ALL, reference: 'GO 105 FAQ Q12', value: true, valueLabel: 'boolean', summary: 'Social-infrastructure parcels must be separate from open space and utility parcels.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-si-adj'] },
  { id: 'SI-USE', title: 'Permitted SI uses (saleable for these only)', category: 'Utilities & SI', authorities: ALL, reference: 'GO 105 FAQ Q13–14', value: ['pharmacy', 'clinic', 'school', 'play school', 'crèche', 'dispensary', 'convenience shops'], valueLabel: '7 permitted uses', summary: 'SI parcels may be sold only for pharmacy, clinic, school, play school, crèche, dispensary or convenience shops.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['doc-si-use'] },
  { id: 'OS-450', title: 'Minimum open-space pocket', category: 'Open space', authorities: ['HMDA'], reference: 'HMDA guidance (v1)', value: 450, valueLabel: '450 m²', summary: 'Each open-space pocket should be at least 450 m² to count.', sourceUrl: LRS, sourceType: 'official', status: 'verify', usedBy: ['chk-os-pocket'] },
  { id: 'RD-TABLE', title: 'Road width by run length', category: 'Roads', authorities: ALL, reference: 'GO 105 Rule 5(3) Table I', value: ROAD_TABLE, valueLabel: '≤600 m: 12 m · ≤1000 m: 18 m · >1000 m: 24 m', summary: '≤600 m: ROW 12 m, splay 3 m, carriageway 6 m · 600–1000 m: 18 m, 4.5 m, 11 m · >1000 m: 24 m, 6 m, per IRC.', sourceUrl: LAYOUT_RULES, sourceType: 'go-copy', status: 'in-force', usedBy: ['chk-road-row', 'chk-splays', 'chk-spine'] },
  { id: 'RD-APPROACH', title: 'Approach road', category: 'Roads', authorities: ALL, reference: 'GO 105 FAQ Q1–7', value: { existingMin: 9, required: 18 }, valueLabel: 'existing ≥9 m; required 18 m', summary: 'Existing approach ≥9 m; required 18 m; widen equally both sides + road impact fee 100% of DC (50% if existing 15 m vs MP 18 m).', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-approach'] },
  { id: 'PL-MIN', title: 'Minimum plot', category: 'Plots', authorities: ALL, reference: 'GO 105 FAQ Q15–16', value: { area: 50, width: 6 }, valueLabel: '50 m² · 6 m wide', summary: 'Every plot must be at least 50 m² in area and 6 m wide.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-plot-min'] },
  { id: 'MG-15', title: 'Mortgage', category: 'Mortgage', authorities: ALL, reference: 'GO 105 FAQ Q17–19', value: 15, valueLabel: '15% of plotted area', summary: '15% of plotted area, registered deed, whole plots only, before tentative layout release.', sourceUrl: FAQ, sourceType: 'official', status: 'conflict', conflictsWith: ['MG-25'], conflictGroup: 'mortgage', usedBy: ['chk-mortgage'] },
  { id: 'MG-25', title: 'HMDA procedure', category: 'Mortgage', authorities: ['HMDA'], reference: 'HMDA FAQs', value: 25, valueLabel: '25% mortgaged', summary: 'Mortgage 25% of plots; sell 75% after approval.', sourceUrl: 'https://www.hmda.gov.in/faqs/', sourceType: 'official', status: 'conflict', conflictsWith: ['MG-15'], conflictGroup: 'mortgage', usedBy: ['chk-mortgage'] },
  { id: 'MG-WORKS', title: 'Development works window before release', category: 'Mortgage', authorities: ALL, reference: 'GO 276 (2010)', value: 36, valueLabel: '3 years', summary: 'Development works must complete within 3 years, after which mortgaged plots are released.', sourceUrl: 'https://www.scribd.com/document/567802534/Number-class', sourceType: 'go-copy', status: 'verify', usedBy: ['chk-works'] },
  { id: 'BF-LAKE-L', title: 'Lake/tank/kunta ≥10 ha', category: 'Buffers', authorities: ALL, reference: 'GO 168 (2012)', value: 30, valueLabel: '30 m from FTL', summary: '30 m from FTL (including walking/cycling track) for water bodies of 10 ha or more.', sourceUrl: 'https://www.deccanchronicle.com/southern-states/telangana/hydraa-demolitions-all-you-want-to-know-about-ftl-buffer-zone-1819329', sourceType: 'secondary', status: 'in-force', usedBy: ['chk-buffer-lake'] },
  { id: 'BF-LAKE-S', title: 'Lake/kunta <10 ha, shikam', category: 'Buffers', authorities: ALL, reference: 'GO 168', value: 9, valueLabel: '9 m from FTL', summary: '9 m from FTL for water bodies under 10 ha and shikam lands.', sourceUrl: GO168, sourceType: 'go-copy', status: 'in-force', usedBy: ['chk-buffer-lake'] },
  { id: 'BF-NALA-W', title: 'Canal/vagu/nala/drain >10 m wide', category: 'Buffers', authorities: ALL, reference: 'GO 168', value: 9, valueLabel: '9 m from boundary', summary: '9 m buffer from the boundary of canals, vagus, nalas and drains wider than 10 m.', sourceUrl: GO168, sourceType: 'go-copy', status: 'in-force', usedBy: ['chk-buffer-nala'] },
  { id: 'BF-NALA-N', title: 'Nala ≤10 m wide', category: 'Buffers', authorities: ALL, reference: 'GO 168 (secondary summary)', value: 2, valueLabel: '2 m from boundary', summary: '2 m buffer from nalas up to 10 m wide.', sourceUrl: 'https://1acre.in/lakes', sourceType: 'secondary', status: 'verify', usedBy: ['chk-buffer-nala'] },
  { id: 'BF-OS', title: 'Buffer may count toward open space', category: 'Buffers', authorities: ALL, reference: 'Rule 16(1)(e)(ii), FAQ Q22', value: true, valueLabel: 'boolean', summary: 'Buffer area may count toward open space; a lake/river buffer may carry a ≥12 m road.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-os-total'] },
  { id: 'BF-RAIL', title: 'Railway buffer', category: 'Buffers', authorities: ALL, reference: 'FAQ Q23', value: 30, valueLabel: '30 m (may include road)', summary: '30 m buffer from the railway boundary; it may include a road.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-buffer-rail'] },
  { id: 'NOC-WATER', title: 'Irrigation + Revenue NOC trigger', category: 'NOCs', authorities: ALL, reference: 'GO 168 / FAQ Q21', value: { lake: 200, nala: 50 }, valueLabel: '200 m lake · 50 m nala', summary: 'Irrigation and Revenue NOCs are required within 200 m of a lake/river or 50 m of a nala.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-noc-water'] },
  { id: 'HT-SAFE', title: 'Electrical clearances', category: 'Buffers', authorities: ALL, reference: 'Rule 3(c)(i), FAQ Q30', value: { ht: 3, lt: 1.5 }, valueLabel: 'HT 3 m · LT 1.5 m', summary: 'HT 3 m, LT 1.5 m; tower line: green belt = tower base width + ≥10 m road each side.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-buffer-ht'] },
  { id: 'HT-GREEN', title: 'HT green belt is in addition to the 10% open space', category: 'Buffers', authorities: ALL, reference: 'GO amendment Rule 3(c)(ii)', value: true, valueLabel: 'boolean', summary: 'The HT-line green belt does not count toward the 10% open space.', sourceUrl: 'https://www.scribd.com/document/625576139/GO-s', sourceType: 'go-copy', status: 'in-force', usedBy: ['chk-os-total'] },
  { id: 'HER-ASI', title: 'Protected monument', category: 'NOCs', authorities: ALL, reference: 'AMASR Act / FAQ Q28', value: { prohibited: 100, regulated: 200 }, valueLabel: '0–100 m prohibited · 100–200 m NMA', summary: '0–100 m prohibited; 100–200 m needs NMA permission.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-heritage'] },
  { id: 'EC-50HA', title: 'State EIA environmental clearance', category: 'NOCs', authorities: ALL, reference: 'FAQ Q27', value: 50, valueLabel: 'layouts ≥50 ha', summary: 'Layouts of 50 ha or more need State EIA environmental clearance.', sourceUrl: FAQ, sourceType: 'official', status: 'in-force', usedBy: ['chk-ec'] },
  { id: 'FAC-50AC', title: 'Extra education/health/commercial facilities', category: 'Utilities & SI', authorities: ALL, reference: 'FAQ Q20 (Appendix C)', value: 50, valueLabel: 'layouts ≥50 acres', summary: 'Layouts of 50 acres or more must provide education, health and commercial facilities per Appendix C.', sourceUrl: FAQ, sourceType: 'official', status: 'verify', usedBy: ['chk-facilities'] },
  { id: 'SB-FRONT', title: 'Front setback for massing preview', category: 'Built form', authorities: ALL, reference: 'GO 168 Table III', value: [{ max: 200, m: 1.5 }, { max: 300, m: 2 }, { max: Infinity, m: 3 }], valueLabel: '1.5 / 2 / 3 m', summary: '<200 m²: 1.5 m · 200–300 m²: 2 m · ≥300 m²: 3 m.', sourceUrl: 'https://infralens.in/dcr/setbacks/warangal', sourceType: 'secondary', status: 'verify', usedBy: ['chk-coverage'] },
  { id: 'PR-BUILDNOW', title: 'Filing route', category: 'Process', authorities: ALL, reference: '—', value: 'BuildNow', valueLabel: 'BuildNow', summary: 'BuildNow replaced TG-bPASS on 15 Dec 2025 for GHMC/HMDA/DTCP/municipalities.', sourceUrl: 'https://1acre.in/research/buildnow-telangana-building-permission-online', sourceType: 'secondary', status: 'in-force', usedBy: ['doc-buildnow'] },
  { id: 'RD-HMDA-122', title: 'HMDA frontage road (v1 rule)', category: 'Roads', authorities: ['HMDA'], reference: 'HMDA guidance vs LRS', value: { design: 12.2, lrs: 9 }, valueLabel: '12.2 m vs 9 m', summary: '12.2 m design minimum; 9 m is an LRS regularisation standard. Pick which to apply.', sourceUrl: LRS, sourceType: 'official', status: 'conflict', conflictGroup: 'hmda-frontage', usedBy: ['chk-frontage'] },
];

export const RULES: Rule[] = seed.map((r) => ({ ...r, lastVerified: V, usedBy: r.usedBy ?? [] }));
export const RULES_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));
export const rule = (id: string): Rule => {
  const r = RULES_BY_ID[id];
  if (!r) throw new Error(`Unknown rule ${id}`);
  return r;
};

/** Conflict groups: the options the user can pick between. */
export const CONFLICT_GROUPS: Record<string, { title: string; options: { ruleId: string; label: string }[] }> = {
  mortgage: {
    title: 'Mortgage share',
    options: [
      { ruleId: 'MG-15', label: '15% (GO 105 FAQ)' },
      { ruleId: 'MG-25', label: '25% (HMDA FAQs)' },
    ],
  },
  'os-split': {
    title: 'Open-space split',
    options: [
      { ruleId: 'OS-SPLIT-105', label: '9 + 1 (GO 105 FAQ)' },
      { ruleId: 'OS-SPLIT-MUN', label: '7.5 + 1 + 1 (Municipal text)' },
    ],
  },
  'hmda-frontage': {
    title: 'HMDA frontage road',
    options: [
      { ruleId: 'RD-HMDA-122', label: '12.2 m design minimum' },
      { ruleId: 'RD-HMDA-122:LRS', label: '9 m (LRS standard)' },
    ],
  },
};

/** Manual document checks kept from v1. */
export const DOCUMENT_CHECKS: { id: string; title: string; rule?: string }[] = [
  { id: 'doc-landuse', title: 'Land-use conformity with master plan' },
  { id: 'doc-agri', title: 'Agricultural land conversion (NALA)' },
  { id: 'doc-jurisdiction', title: 'Jurisdiction confirmed (HMDA / DTCP / municipality)' },
  { id: 'doc-mp-giveup', title: 'Master-plan road give-up deed' },
  { id: 'doc-os-gift', title: 'Open-space gift deed + compound wall' },
  { id: 'doc-title', title: 'Title / EC / pattadar passbook' },
  { id: 'doc-services', title: 'Services drawings (water, sewer, storm, power)' },
  { id: 'doc-ltp', title: 'Licensed technical person signature' },
  { id: 'doc-buildnow', title: 'BuildNow submission', rule: 'PR-BUILDNOW' },
  { id: 'doc-si-use', title: 'SI parcels restricted to permitted uses', rule: 'SI-USE' },
];

export const RULES_VERSION = '2026.11.17';
