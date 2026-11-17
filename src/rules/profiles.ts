import type { Authority } from '../engine/types';
import { RULES, type Rule, type RuleAuthority } from './regulations';

export type Profile = {
  id: Authority;
  label: string;
  short: string;
  /** Which rule governs the minimum frontage/spine road width. */
  frontageRule: 'RD-HMDA-122' | 'RD-TABLE';
  /** Default choices for conflict groups (null = unresolved, shows "Sources conflict"). */
  defaults: Record<string, string | null>;
};

export const PROFILES: Record<Authority, Profile> = {
  HMDA: {
    id: 'HMDA',
    label: 'Hyderabad Metropolitan Development Authority',
    short: 'HMDA',
    frontageRule: 'RD-HMDA-122',
    defaults: { mortgage: null, 'os-split': null, 'hmda-frontage': null },
  },
  DTCP: {
    id: 'DTCP',
    label: 'Directorate of Town & Country Planning',
    short: 'DTCP',
    frontageRule: 'RD-TABLE',
    defaults: { mortgage: 'MG-15', 'os-split': null },
  },
  MUNICIPAL: {
    id: 'MUNICIPAL',
    label: 'Municipality (GO Ms 105 layout rules)',
    short: 'Municipal',
    frontageRule: 'RD-TABLE',
    defaults: { mortgage: 'MG-15', 'os-split': null },
  },
  CUSTOM: {
    id: 'CUSTOM',
    label: 'Custom profile (all rules, you choose)',
    short: 'Custom',
    frontageRule: 'RD-TABLE',
    defaults: { mortgage: null, 'os-split': null },
  },
};

export function rulesFor(a: Authority): Rule[] {
  if (a === 'CUSTOM') return RULES;
  const ra: RuleAuthority = a;
  return RULES.filter((r) => r.authorities.includes(ra));
}

export function appliesTo(ruleId: string, a: Authority): boolean {
  if (a === 'CUSTOM') return true;
  const r = RULES.find((x) => x.id === ruleId);
  return !!r && r.authorities.includes(a);
}
