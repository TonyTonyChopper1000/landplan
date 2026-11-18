import { ACRE, GUNTA, SQYD } from '@/engine/geometry';

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const inr2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const fmtInt = (n: number) => inr0.format(Math.round(n));
export const fmt1 = (n: number) => inr1.format(n);
export const fmt2 = (n: number) => inr2.format(n);
/** ₹1,23,45,678 */
export const rupees = (n: number) => `₹${inr0.format(Math.round(n))}`;
export const crore = (n: number) => `₹${inr2.format(n / 1e7)} Cr`;
export const lakh = (n: number) => `₹${inr1.format(n / 1e5)} L`;
/** Pick lakh or crore by size. */
export const money = (n: number) => (Math.abs(n) >= 1e7 ? crore(n) : lakh(n));
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;

export type Units = 'm2' | 'sqyd' | 'acre';
export function area(m2: number, u: Units): string {
  if (u === 'sqyd') return `${fmtInt(m2 / SQYD)} sq yd`;
  if (u === 'acre') {
    const ac = Math.floor(m2 / ACRE + 1e-9);
    const g = (m2 - ac * ACRE) / GUNTA;
    return ac ? `${ac} ac ${g.toFixed(1)} gn` : `${g.toFixed(2)} gn`;
  }
  return `${fmtInt(m2)} m²`;
}
export const acres = (m2: number) => `${(m2 / ACRE).toFixed(2)} ac`;
export const metres = (m: number, d = 1) => `${m.toFixed(d)} m`;
