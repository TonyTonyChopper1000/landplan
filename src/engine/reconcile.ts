import { ACRE, GUNTA } from './geometry';

export type Reconciliation = { drawnM2: number; recordM2: number | null; areaMismatchPct: number | null; warning: string | null };

export function reconcile(drawnM2: number, recordAcres = 0, recordGuntas = 0, tolPct = 2): Reconciliation {
  const recordM2 = recordAcres * ACRE + recordGuntas * GUNTA;
  if (!recordM2) return { drawnM2, recordM2: null, areaMismatchPct: null, warning: null };
  const pct = ((drawnM2 - recordM2) / recordM2) * 100;
  return {
    drawnM2,
    recordM2,
    areaMismatchPct: pct,
    warning: Math.abs(pct) > tolPct ? `Drawn area differs from the record area by ${pct.toFixed(2)}% (tolerance ${tolPct}%)` : null,
  };
}

