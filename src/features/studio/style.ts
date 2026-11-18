import type { Plot } from '@/engine/types';

export function bandColor(p: Pick<Plot, 'sizeSqYd' | 'irregular'>): string {
  if (p.irregular) return 'var(--band-irr)';
  if (p.sizeSqYd <= 200) return 'var(--band-1)';
  if (p.sizeSqYd <= 300) return 'var(--band-2)';
  if (p.sizeSqYd <= 450) return 'var(--band-3)';
  return 'var(--band-4)';
}

export const BAND_LEGEND = [
  { label: '≤200', color: 'var(--band-1)' },
  { label: '201–300', color: 'var(--band-2)' },
  { label: '301–450', color: 'var(--band-3)' },
  { label: '450+', color: 'var(--band-4)' },
  { label: 'Irregular', color: 'var(--band-irr)' },
];

export const OPEN_FILL: Record<string, string> = {
  park: 'var(--park)',
  util: 'var(--util)',
  social: 'var(--social)',
};
export const OPEN_LABEL: Record<string, string> = { park: 'PARK', util: 'UTILITY', social: 'SOCIAL INFRA' };
